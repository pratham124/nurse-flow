from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

import httpx
import jwt

from nurseflow_optimizer.auth import SupabaseJwtVerifier
from nurseflow_optimizer.service import (
    OptimizerAuthenticationError,
    OptimizerRunRequest,
)
from nurseflow_optimizer.supabase_clients import SupabasePrepareClient


class AuthenticationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.verifier = SupabaseJwtVerifier(
            jwks_url="https://project.example/auth/v1/.well-known/jwks.json",
            issuer="https://project.example/auth/v1",
            audience="authenticated",
        )

    def test_bearer_header_is_required(self) -> None:
        with self.assertRaises(OptimizerAuthenticationError):
            self.verifier.verify(None)
        with self.assertRaises(OptimizerAuthenticationError):
            self.verifier.verify("Basic abc")

    @patch("jwt.decode")
    @patch("jwt.PyJWKClient")
    def test_verified_subject_is_returned(self, jwks_class: Mock, decode: Mock) -> None:
        jwks_class.return_value.get_signing_key_from_jwt.return_value.key = "key"
        decode.return_value = {"sub": "auth-user-1"}

        subject = self.verifier.verify("Bearer signed-token")

        self.assertEqual(subject, "auth-user-1")
        decode.assert_called_once()
        options = decode.call_args.kwargs["options"]
        self.assertEqual(options["require"], ["exp", "iat", "iss", "aud", "sub"])

    @patch("jwt.PyJWKClient")
    def test_expired_token_is_rejected(self, jwks_class: Mock) -> None:
        jwks_class.return_value.get_signing_key_from_jwt.side_effect = (
            jwt.ExpiredSignatureError("expired")
        )

        with self.assertRaises(OptimizerAuthenticationError):
            self.verifier.verify("Bearer expired-token")


class SupabasePrepareClientTests(unittest.TestCase):
    def test_prepare_forwards_user_token_and_small_action_body(self) -> None:
        captured_request: httpx.Request | None = None

        def handle(request: httpx.Request) -> httpx.Response:
            nonlocal captured_request
            captured_request = request
            return httpx.Response(
                200,
                json={
                    "status": "prepared",
                    "runId": "run-1",
                    "shiftSnapshot": {"id": "shift-1"},
                },
            )

        http_client = httpx.Client(transport=httpx.MockTransport(handle))
        client = SupabasePrepareClient(
            base_url="https://project.example",
            api_key="publishable-key",
            http_client=http_client,
        )
        action = OptimizerRunRequest(
            shift_id="shift-1",
            client_mutation_id="mutation-1",
            expected_shift_revision="2026-08-22T12:00:00Z",
            expected_baseline_assignment_result_id=None,
        )

        prepared = client.prepare("Bearer user-token", action)

        self.assertEqual(prepared.run_id, "run-1")
        self.assertIsNotNone(captured_request)
        assert captured_request is not None
        self.assertEqual(captured_request.headers["authorization"], "Bearer user-token")
        self.assertEqual(captured_request.headers["apikey"], "publishable-key")
        self.assertNotIn(b"shiftSnapshot", captured_request.content)
        self.assertNotIn(b"patient", captured_request.content)

    def test_prepare_401_is_authentication_not_service_failure(self) -> None:
        http_client = httpx.Client(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(401, json={"message": "expired"})
            )
        )
        client = SupabasePrepareClient(
            base_url="https://project.example",
            api_key="publishable-key",
            http_client=http_client,
        )
        action = OptimizerRunRequest("shift", "mutation", "revision", None)

        with self.assertRaises(OptimizerAuthenticationError):
            client.prepare("Bearer expired", action)


if __name__ == "__main__":
    unittest.main()
