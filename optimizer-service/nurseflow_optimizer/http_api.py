"""FastAPI adapter for the NurseFlow optimizer service."""

from __future__ import annotations

import json

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from .service import OptimizerServiceDependencies, run_optimizer_request

MAX_REQUEST_BYTES = 16_384


def create_app(dependencies: OptimizerServiceDependencies) -> FastAPI:
    """Create the HTTP surface around injected, testable service boundaries."""

    app = FastAPI(
        title="NurseFlow Optimizer",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )

    @app.get("/healthz")
    def healthcheck() -> dict[str, str]:
        return {"status": "healthy"}

    @app.get("/readyz")
    def readiness() -> dict[str, str]:
        # Reaching this route means configuration parsed and the application,
        # OR-Tools module, and injected boundaries loaded successfully.
        return {"status": "ready"}

    @app.post("/v1/assignment-runs")
    async def create_assignment_run(request: Request) -> JSONResponse:
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit():
            if int(content_length) > MAX_REQUEST_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"status": "invalid_input"},
                )

        raw_body = await request.body()
        if len(raw_body) > MAX_REQUEST_BYTES:
            return JSONResponse(
                status_code=413,
                content={"status": "invalid_input"},
            )

        try:
            request_body = json.loads(raw_body)
        except (UnicodeDecodeError, json.JSONDecodeError):
            return JSONResponse(
                status_code=422,
                content={"status": "invalid_input"},
            )
        if not isinstance(request_body, dict):
            return JSONResponse(
                status_code=422,
                content={"status": "invalid_input"},
            )

        # The CP-SAT call is synchronous and CPU-heavy. Running it in FastAPI's
        # worker thread keeps the event loop responsive for health probes.
        outcome = await run_in_threadpool(
            run_optimizer_request,
            request.headers.get("authorization"),
            request_body,
            dependencies,
        )
        return JSONResponse(status_code=outcome.http_status, content=outcome.body)

    return app
