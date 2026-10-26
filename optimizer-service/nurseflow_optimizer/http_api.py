"""FastAPI adapter for the NurseFlow optimizer service."""

from __future__ import annotations

import json

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from .service import (
    OptimizerServiceDependencies,
    SolverConfig,
    is_valid_solver_token,
    run_optimizer_request,
    run_solver_request,
)

MAX_REQUEST_BYTES = 16_384
# A shift snapshot is much larger than the legacy action request.
MAX_SOLVE_REQUEST_BYTES = 1_048_576


def _invalid_input(status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"status": "invalid_input"})


async def _read_json_object(
    request: Request,
    max_bytes: int,
) -> dict | JSONResponse:
    """Read a size-limited JSON object, or return the typed error response."""

    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit():
        if int(content_length) > max_bytes:
            return _invalid_input(413)

    raw_body = await request.body()
    if len(raw_body) > max_bytes:
        return _invalid_input(413)

    try:
        request_body = json.loads(raw_body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return _invalid_input(422)
    if not isinstance(request_body, dict):
        return _invalid_input(422)
    return request_body


def create_app(
    dependencies: OptimizerServiceDependencies | None = None,
    solver_config: SolverConfig | None = None,
) -> FastAPI:
    """Create the HTTP surface around injected, testable service boundaries.

    Each route group is registered only when its configuration is supplied, so
    a disabled route answers 404 instead of failing at request time.
    """

    if dependencies is None and solver_config is None:
        raise ValueError("At least one route group must be configured.")

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

    if dependencies is not None:
        _register_assignment_runs(app, dependencies)
    if solver_config is not None:
        _register_solve(app, solver_config)

    return app


def _register_assignment_runs(
    app: FastAPI,
    dependencies: OptimizerServiceDependencies,
) -> None:
    """Legacy mobile-app route: Supabase JWT, prepare, solve, finalize."""

    @app.post("/v1/assignment-runs")
    async def create_assignment_run(request: Request) -> JSONResponse:
        request_body = await _read_json_object(request, MAX_REQUEST_BYTES)
        if isinstance(request_body, JSONResponse):
            return request_body

        # The CP-SAT call is synchronous and CPU-heavy. Running it in FastAPI's
        # worker thread keeps the event loop responsive for health probes.
        outcome = await run_in_threadpool(
            run_optimizer_request,
            request.headers.get("authorization"),
            request_body,
            dependencies,
        )
        return JSONResponse(status_code=outcome.http_status, content=outcome.body)


def _register_solve(app: FastAPI, config: SolverConfig) -> None:
    """Go-facing route: shared bearer token, snapshot in, result out."""

    @app.post("/v1/solve")
    async def solve(request: Request) -> JSONResponse:
        # Authenticate first so unauthenticated callers cannot make us buffer
        # or parse a large body.
        if not is_valid_solver_token(request.headers.get("authorization"), config):
            return JSONResponse(status_code=401, content={"status": "unauthorized"})

        request_body = await _read_json_object(request, MAX_SOLVE_REQUEST_BYTES)
        if isinstance(request_body, JSONResponse):
            return request_body

        outcome = await run_in_threadpool(run_solver_request, request_body, config)
        return JSONResponse(status_code=outcome.http_status, content=outcome.body)
