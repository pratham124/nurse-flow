"""Build the production solver service from private environment variables."""

from __future__ import annotations

import os

from fastapi import FastAPI

from .http_api import create_app
from .service import SolverConfig

OPTIMIZER_VERSION = "phase9-v1-ortools-9.15.6755"


def build_solver_config_from_environment() -> SolverConfig:
    """Read the shared bearer token the Go API uses to call `/v1/solve`.

    The token is required: without it nobody could be authenticated, so the
    service refuses to start instead of running with no usable route.
    """

    token = os.environ.get("NURSEFLOW_SOLVER_TOKEN", "").strip()
    if not token:
        raise RuntimeError(
            "Missing required service configuration: NURSEFLOW_SOLVER_TOKEN"
        )
    return SolverConfig(solver_token=token, optimizer_version=OPTIMIZER_VERSION)


def create_app_from_environment() -> FastAPI:
    """Uvicorn factory used by local development and the container command."""

    return create_app(build_solver_config_from_environment())
