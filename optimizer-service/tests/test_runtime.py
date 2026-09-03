from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from nurseflow_optimizer.runtime import create_app_from_environment


LOCAL_WEB_ORIGIN = "http://localhost:8081"
ASSIGNMENT_RUN_PATH = "/v1/assignment-runs"


def create_runtime_client(local_web_origin: str | None) -> TestClient:
    environment = {}
    if local_web_origin is not None:
        environment["NURSEFLOW_LOCAL_WEB_ORIGIN"] = local_web_origin

    with (
        patch.dict(os.environ, environment, clear=True),
        patch(
            "nurseflow_optimizer.runtime.build_dependencies_from_environment",
            return_value=object(),
        ),
        patch(
            "nurseflow_optimizer.runtime.create_app",
            return_value=FastAPI(),
        ),
    ):
        return TestClient(create_app_from_environment())


def make_preflight_request(client: TestClient, origin: str):
    return client.options(
        ASSIGNMENT_RUN_PATH,
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        },
    )


class RuntimeCorsTests(unittest.TestCase):
    def test_configured_local_web_origin_is_allowed(self) -> None:
        client = create_runtime_client(LOCAL_WEB_ORIGIN)

        response = make_preflight_request(client, LOCAL_WEB_ORIGIN)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers["access-control-allow-origin"],
            LOCAL_WEB_ORIGIN,
        )

    def test_other_web_origins_remain_blocked(self) -> None:
        client = create_runtime_client(LOCAL_WEB_ORIGIN)

        response = make_preflight_request(client, "https://untrusted.example")

        self.assertEqual(response.status_code, 400)
        self.assertNotIn("access-control-allow-origin", response.headers)

    def test_cors_is_disabled_without_local_web_origin(self) -> None:
        client = create_runtime_client(None)

        response = make_preflight_request(client, LOCAL_WEB_ORIGIN)

        self.assertNotIn("access-control-allow-origin", response.headers)


if __name__ == "__main__":
    unittest.main()
