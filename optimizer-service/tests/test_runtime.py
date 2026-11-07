from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from nurseflow_optimizer.runtime import create_app_from_environment


def create_configured_client(environment: dict[str, str]) -> TestClient:
    with patch.dict(os.environ, environment, clear=True):
        return TestClient(create_app_from_environment())


class RuntimeConfigurationTests(unittest.TestCase):
    def test_solver_token_enables_the_solve_route(self) -> None:
        client = create_configured_client({"NURSEFLOW_SOLVER_TOKEN": "token"})

        self.assertEqual(client.post("/v1/solve", json={}).status_code, 401)
        self.assertEqual(client.get("/healthz").status_code, 200)
        self.assertEqual(client.get("/readyz").status_code, 200)

    def test_assignment_run_route_no_longer_exists(self) -> None:
        client = create_configured_client({"NURSEFLOW_SOLVER_TOKEN": "token"})

        response = client.post(
            "/v1/assignment-runs",
            json={},
            headers={"Authorization": "Bearer token"},
        )

        self.assertEqual(response.status_code, 404)

    def test_missing_solver_token_fails_startup_clearly(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "NURSEFLOW_SOLVER_TOKEN"):
            create_configured_client({})

    def test_blank_solver_token_fails_startup_clearly(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "NURSEFLOW_SOLVER_TOKEN"):
            create_configured_client({"NURSEFLOW_SOLVER_TOKEN": "   "})

    def test_service_never_answers_cors_preflight(self) -> None:
        client = create_configured_client(
            {"NURSEFLOW_SOLVER_TOKEN": "token"}
        )

        response = client.options(
            "/v1/solve",
            headers={
                "Origin": "http://localhost:8081",
                "Access-Control-Request-Method": "POST",
            },
        )

        self.assertNotIn("access-control-allow-origin", response.headers)


if __name__ == "__main__":
    unittest.main()
