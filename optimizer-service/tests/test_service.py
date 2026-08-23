from __future__ import annotations

import unittest
from dataclasses import dataclass, field

from fixture_helpers import build_shift_snapshot, load_fixture_catalog
from nurseflow_optimizer.service import (
    FinalizedOptimizerRun,
    OptimizerAuthenticationError,
    OptimizerAuthorizationError,
    OptimizerRunRequest,
    OptimizerServiceDependencies,
    OptimizerServiceUnavailableError,
    PreparedOptimizerRun,
    run_optimizer_request,
)


class FakeTokenVerifier:
    def verify(self, authorization_header: str | None) -> str:
        if authorization_header != "Bearer valid-token":
            raise OptimizerAuthenticationError("invalid token")
        return "auth-user-1"


@dataclass
class FakePrepareClient:
    prepared: PreparedOptimizerRun
    error: Exception | None = None
    calls: list[OptimizerRunRequest] = field(default_factory=list)

    def prepare(
        self,
        authorization_header: str,
        request: OptimizerRunRequest,
    ) -> PreparedOptimizerRun:
        self.calls.append(request)
        if self.error:
            raise self.error
        return self.prepared


@dataclass
class FakeFinalizeClient:
    finalized: FinalizedOptimizerRun
    finalize_calls: int = 0
    failed_codes: list[str] = field(default_factory=list)

    def finalize(self, service_token, prepared, output, input_fingerprint, version):
        self.finalize_calls += 1
        return FinalizedOptimizerRun(
            status=self.finalized.status,
            run_id=prepared.run_id or "missing-run",
            result_id=(
                output.assignment_result.id
                if self.finalized.status == "saved"
                else self.finalized.result_id
            ),
        )

    def mark_failed(self, service_token: str, run_id: str, outcome_code: str) -> None:
        self.failed_codes.append(outcome_code)


class OptimizerServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        fixture = next(
            item
            for item in load_fixture_catalog()["fixtures"]
            if item["id"] == "one-nurse"
        )
        cls.snapshot = build_shift_snapshot(fixture)

    def dependencies(
        self,
        prepared: PreparedOptimizerRun,
        *,
        prepare_error: Exception | None = None,
        solve_budget_seconds: float = 50.0,
        finalize_status: str = "saved",
    ):
        prepare_client = FakePrepareClient(prepared, prepare_error)
        finalize_client = FakeFinalizeClient(
            FinalizedOptimizerRun(finalize_status, prepared.run_id or "run-1")
        )
        dependencies = OptimizerServiceDependencies(
            token_verifier=FakeTokenVerifier(),
            prepare_client=prepare_client,
            finalize_client=finalize_client,
            service_token="private-service-key",
            optimizer_version="test-version",
            solve_budget_seconds=solve_budget_seconds,
        )
        return dependencies, prepare_client, finalize_client

    @staticmethod
    def request_body() -> dict[str, object]:
        return {
            "shiftId": "shift-1",
            "clientMutationId": "mutation-1",
            "expectedShiftRevision": "2026-08-22T12:00:00Z",
            "expectedBaselineAssignmentResultId": None,
        }

    def test_missing_token_stops_before_prepare(self) -> None:
        dependencies, prepare_client, _ = self.dependencies(
            PreparedOptimizerRun("prepared", run_id="run-1")
        )

        outcome = run_optimizer_request(None, self.request_body(), dependencies)

        self.assertEqual(outcome.http_status, 401)
        self.assertEqual(outcome.body, {"status": "unauthorized"})
        self.assertEqual(prepare_client.calls, [])

    def test_client_cannot_send_a_shift_snapshot(self) -> None:
        dependencies, prepare_client, _ = self.dependencies(
            PreparedOptimizerRun("prepared", run_id="run-1")
        )
        body = self.request_body()
        body["nextShift"] = {"patient": "must never be trusted"}

        outcome = run_optimizer_request("Bearer valid-token", body, dependencies)

        self.assertEqual(outcome.http_status, 422)
        self.assertEqual(prepare_client.calls, [])

    def test_forbidden_prepare_never_reaches_solver_or_finalize(self) -> None:
        dependencies, _, finalize_client = self.dependencies(
            PreparedOptimizerRun("prepared", run_id="run-1"),
            prepare_error=OptimizerAuthorizationError("not the owner"),
        )

        outcome = run_optimizer_request(
            "Bearer valid-token", self.request_body(), dependencies
        )

        self.assertEqual(outcome.http_status, 403)
        self.assertEqual(finalize_client.finalize_calls, 0)

    def test_token_expiring_during_prepare_returns_unauthorized(self) -> None:
        dependencies, _, finalize_client = self.dependencies(
            PreparedOptimizerRun("prepared", run_id="run-1"),
            prepare_error=OptimizerAuthenticationError("expired"),
        )

        outcome = run_optimizer_request(
            "Bearer valid-token", self.request_body(), dependencies
        )

        self.assertEqual(outcome.http_status, 401)
        self.assertEqual(finalize_client.finalize_calls, 0)

    def test_prepared_run_solves_and_finalizes(self) -> None:
        prepared = PreparedOptimizerRun(
            "prepared",
            run_id="run-1",
            shift_snapshot=self.snapshot,
        )
        dependencies, _, finalize_client = self.dependencies(prepared)

        outcome = run_optimizer_request(
            "Bearer valid-token", self.request_body(), dependencies
        )

        self.assertEqual(outcome.http_status, 200)
        self.assertEqual(outcome.body["status"], "saved")
        self.assertEqual(outcome.body["runId"], "run-1")
        self.assertTrue(outcome.body["resultId"])
        self.assertEqual(finalize_client.finalize_calls, 1)

    def test_completed_retry_returns_saved_result_without_solving_again(self) -> None:
        prepared = PreparedOptimizerRun(
            "existing",
            run_id="run-1",
            run_status="succeeded",
            result_id="result-1",
        )
        dependencies, _, finalize_client = self.dependencies(prepared)

        outcome = run_optimizer_request(
            "Bearer valid-token", self.request_body(), dependencies
        )

        self.assertEqual(outcome.http_status, 200)
        self.assertEqual(outcome.body["resultId"], "result-1")
        self.assertEqual(finalize_client.finalize_calls, 0)

    def test_in_progress_run_returns_running_without_solving_again(self) -> None:
        prepared = PreparedOptimizerRun("in_progress", run_id="run-1")
        dependencies, _, finalize_client = self.dependencies(prepared)

        outcome = run_optimizer_request(
            "Bearer valid-token", self.request_body(), dependencies
        )

        self.assertEqual(outcome.http_status, 202)
        self.assertEqual(outcome.body["status"], "running")
        self.assertEqual(finalize_client.finalize_calls, 0)

    def test_stale_precondition_does_not_finalize(self) -> None:
        dependencies, _, finalize_client = self.dependencies(
            PreparedOptimizerRun("stale")
        )

        outcome = run_optimizer_request(
            "Bearer valid-token", self.request_body(), dependencies
        )

        self.assertEqual(outcome.http_status, 409)
        self.assertEqual(outcome.body["status"], "stale")
        self.assertEqual(finalize_client.finalize_calls, 0)

    def test_timeout_records_only_a_safe_failure_code(self) -> None:
        prepared = PreparedOptimizerRun(
            "prepared",
            run_id="run-1",
            shift_snapshot=self.snapshot,
        )
        dependencies, _, finalize_client = self.dependencies(
            prepared, solve_budget_seconds=0
        )

        outcome = run_optimizer_request(
            "Bearer valid-token", self.request_body(), dependencies
        )

        self.assertEqual(outcome.http_status, 504)
        self.assertEqual(outcome.body["status"], "timed_out")
        self.assertEqual(finalize_client.finalize_calls, 0)
        self.assertEqual(finalize_client.failed_codes, ["timed_out"])

    def test_stale_finalization_does_not_report_saved(self) -> None:
        prepared = PreparedOptimizerRun(
            "prepared",
            run_id="run-1",
            shift_snapshot=self.snapshot,
        )
        dependencies, _, _ = self.dependencies(
            prepared, finalize_status="stale"
        )

        outcome = run_optimizer_request(
            "Bearer valid-token", self.request_body(), dependencies
        )

        self.assertEqual(outcome.http_status, 409)
        self.assertEqual(outcome.body["status"], "stale")

    def test_unavailable_prepare_is_safe_and_retryable(self) -> None:
        dependencies, _, finalize_client = self.dependencies(
            PreparedOptimizerRun("prepared", run_id="run-1"),
            prepare_error=OptimizerServiceUnavailableError("offline"),
        )

        outcome = run_optimizer_request(
            "Bearer valid-token", self.request_body(), dependencies
        )

        self.assertEqual(outcome.http_status, 503)
        self.assertEqual(outcome.body["status"], "unavailable")
        self.assertEqual(finalize_client.finalize_calls, 0)


if __name__ == "__main__":
    unittest.main()
