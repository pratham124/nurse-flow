from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from nurseflow_optimizer.http_api import MAX_REQUEST_BYTES, create_app
from nurseflow_optimizer.service import (
    FinalizedOptimizerRun,
    OptimizerAuthenticationError,
    OptimizerServiceDependencies,
    PreparedOptimizerRun,
)


class RejectingVerifier:
    def verify(self, authorization_header: str | None) -> str:
        raise OptimizerAuthenticationError("invalid")


class UnusedPrepareClient:
    def prepare(self, authorization_header, request):
        raise AssertionError("prepare should not be called")


class UnusedFinalizeClient:
    def finalize(self, service_token, prepared, output, fingerprint, version):
        return FinalizedOptimizerRun("failed", prepared.run_id or "missing")

    def mark_failed(self, service_token, run_id, outcome_code):
        raise AssertionError("failure should not be recorded")


class HttpApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        dependencies = OptimizerServiceDependencies(
            token_verifier=RejectingVerifier(),
            prepare_client=UnusedPrepareClient(),
            finalize_client=UnusedFinalizeClient(),
            service_token="private",
            optimizer_version="test",
        )
        cls.client = TestClient(create_app(dependencies))

    def test_health_and_readiness_are_generic(self) -> None:
        self.assertEqual(self.client.get("/healthz").json(), {"status": "healthy"})
        self.assertEqual(self.client.get("/readyz").json(), {"status": "ready"})

    def test_invalid_json_returns_typed_invalid_input(self) -> None:
        response = self.client.post(
            "/v1/assignment-runs",
            content=b"not-json",
            headers={"content-type": "application/json"},
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json(), {"status": "invalid_input"})

    def test_request_larger_than_limit_is_rejected(self) -> None:
        response = self.client.post(
            "/v1/assignment-runs",
            content=b"x" * (MAX_REQUEST_BYTES + 1),
            headers={"content-type": "application/json"},
        )
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json(), {"status": "invalid_input"})

    def test_missing_bearer_token_returns_unauthorized(self) -> None:
        response = self.client.post("/v1/assignment-runs", json={})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"status": "unauthorized"})


if __name__ == "__main__":
    unittest.main()
