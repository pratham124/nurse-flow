from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from ortools.sat.python import cp_model

from fixture_helpers import build_shift_snapshot, load_fixture_catalog
from nurseflow_optimizer.http_api import MAX_SOLVE_REQUEST_BYTES, create_app
from nurseflow_optimizer.optimizer import (
    DEFAULT_SOLVE_BUDGET_SECONDS,
    OptimizerSolveError,
    OptimizerTimedOutError,
)
from nurseflow_optimizer.service import (
    OptimizerServiceDependencies,
    SolverConfig,
)

SOLVER_TOKEN = "test-solver-token"
AUTH = {"Authorization": f"Bearer {SOLVER_TOKEN}"}


class SolveEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        fixture = next(
            item
            for item in load_fixture_catalog()["fixtures"]
            if item["id"] == "one-nurse"
        )
        cls.snapshot = build_shift_snapshot(fixture)
        cls.client = TestClient(
            create_app(
                solver_config=SolverConfig(
                    solver_token=SOLVER_TOKEN,
                    optimizer_version="test-version",
                )
            )
        )

    def body(self, **overrides):
        value = {"runId": "run-1", "shiftSnapshot": self.snapshot}
        value.update(overrides)
        return value

    def post(self, json_body=None, *, headers=AUTH, content=None):
        if content is not None:
            return self.client.post(
                "/v1/solve",
                content=content,
                headers={**headers, "content-type": "application/json"},
            )
        return self.client.post("/v1/solve", json=json_body, headers=headers)

    # Authentication

    def test_missing_token_is_unauthorized(self) -> None:
        response = self.post(self.body(), headers={})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"status": "unauthorized"})

    def test_wrong_token_is_unauthorized(self) -> None:
        response = self.post(
            self.body(), headers={"Authorization": "Bearer wrong-token"}
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"status": "unauthorized"})

    def test_non_bearer_scheme_is_unauthorized(self) -> None:
        response = self.post(
            self.body(), headers={"Authorization": f"Basic {SOLVER_TOKEN}"}
        )
        self.assertEqual(response.status_code, 401)

    def test_unauthorized_request_never_reaches_the_solver(self) -> None:
        with patch("nurseflow_optimizer.service.solve_optimizer") as solve:
            self.post(self.body(), headers={})
        solve.assert_not_called()

    # Body validation

    def test_oversized_body_is_rejected(self) -> None:
        response = self.post(content=b"x" * (MAX_SOLVE_REQUEST_BYTES + 1))
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json(), {"status": "invalid_input"})

    def test_malformed_json_is_invalid_input(self) -> None:
        response = self.post(content=b"not-json")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json(), {"status": "invalid_input"})

    def test_non_object_body_is_invalid_input(self) -> None:
        response = self.post(content=json.dumps([1, 2]).encode())
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json(), {"status": "invalid_input"})

    def test_unknown_field_is_invalid_input(self) -> None:
        response = self.post(self.body(extra="nope"))
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json(), {"status": "invalid_input"})

    def test_missing_fields_are_invalid_input(self) -> None:
        for body in ({"runId": "run-1"}, {"shiftSnapshot": self.snapshot}, {}):
            with self.subTest(body=list(body)):
                response = self.post(body)
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json(), {"status": "invalid_input"})

    def test_blank_or_non_string_run_id_is_invalid_input(self) -> None:
        for run_id in ("", "   ", 7, None):
            with self.subTest(run_id=run_id):
                response = self.post(self.body(runId=run_id))
                self.assertEqual(response.status_code, 422)

    def test_non_object_snapshot_is_invalid_input(self) -> None:
        for snapshot in ("text", [], None, 3):
            with self.subTest(snapshot=snapshot):
                response = self.post(self.body(shiftSnapshot=snapshot))
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json(), {"status": "invalid_input"})

    # Outcomes

    def test_valid_snapshot_is_solved_with_the_real_solver(self) -> None:
        response = self.post(self.body())

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(
            set(payload),
            {
                "assignmentResult",
                "flags",
                "objectives",
                "inputFingerprint",
                "optimizerVersion",
            },
        )
        self.assertEqual(payload["optimizerVersion"], "test-version")
        self.assertTrue(payload["assignmentResult"]["id"])
        self.assertIsInstance(payload["flags"], list)
        self.assertTrue(payload["inputFingerprint"])

    def test_solve_uses_the_default_budget(self) -> None:
        with patch(
            "nurseflow_optimizer.service.solve_optimizer",
            side_effect=OptimizerSolveError("stage", cp_model.UNKNOWN),
        ) as solve:
            self.post(self.body())

        self.assertEqual(
            solve.call_args.kwargs["solve_budget_seconds"],
            DEFAULT_SOLVE_BUDGET_SECONDS,
        )

    def test_invalid_snapshot_returns_invalid_input(self) -> None:
        response = self.post(self.body(shiftSnapshot={"patient": {"x": "private"}}))
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json(), {"status": "invalid_input"})

    def test_timeout_logs_safely_and_returns_504(self) -> None:
        timeout = OptimizerTimedOutError(
            "canonical_bed_owner:private-id", cp_model.UNKNOWN
        )
        with patch("nurseflow_optimizer.service.solve_optimizer", side_effect=timeout):
            with self.assertLogs(
                "nurseflow_optimizer.service", level="WARNING"
            ) as captured:
                response = self.post(self.body())

        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.json(), {"status": "timed_out"})
        log_text = "\n".join(captured.output)
        self.assertIn("run-1", log_text)
        self.assertNotIn("private-id", log_text)
        self.assertNotIn(SOLVER_TOKEN, log_text)

    def test_solver_error_returns_500_failed(self) -> None:
        with patch(
            "nurseflow_optimizer.service.solve_optimizer",
            side_effect=OptimizerSolveError("stage", cp_model.INFEASIBLE),
        ):
            response = self.post(self.body())
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"status": "failed"})

    def test_unexpected_error_returns_500_failed(self) -> None:
        with patch(
            "nurseflow_optimizer.service.solve_optimizer",
            side_effect=ValueError("boom with private detail"),
        ):
            response = self.post(self.body())
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"status": "failed"})
        self.assertNotIn("private", response.text)

    # Surface

    def test_solver_only_app_has_no_legacy_route(self) -> None:
        self.assertEqual(
            self.client.post("/v1/assignment-runs", json={}).status_code, 404
        )
        self.assertEqual(self.client.get("/healthz").json(), {"status": "healthy"})


class RouteSelectionTests(unittest.TestCase):
    def test_legacy_only_app_has_no_solve_route(self) -> None:
        from test_http_api import (
            RejectingVerifier,
            UnusedFinalizeClient,
            UnusedPrepareClient,
        )

        client = TestClient(
            create_app(
                OptimizerServiceDependencies(
                    token_verifier=RejectingVerifier(),
                    prepare_client=UnusedPrepareClient(),
                    finalize_client=UnusedFinalizeClient(),
                    service_token="private",
                    optimizer_version="test",
                )
            )
        )
        self.assertEqual(client.post("/v1/solve", json={}).status_code, 404)
        self.assertEqual(client.post("/v1/assignment-runs", json={}).status_code, 401)

    def test_app_needs_at_least_one_route_group(self) -> None:
        with self.assertRaises(ValueError):
            create_app()


if __name__ == "__main__":
    unittest.main()
