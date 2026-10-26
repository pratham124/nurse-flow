"""Build production service dependencies from private environment variables."""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import SupabaseJwtVerifier
from .http_api import create_app
from .service import OptimizerServiceDependencies, SolverConfig
from .supabase_clients import SupabaseFinalizeClient, SupabasePrepareClient

OPTIMIZER_VERSION = "phase9-v1-ortools-9.15.6755"


def _required_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required service configuration: {name}")
    return value


SUPABASE_SETTINGS = (
    "NURSEFLOW_SUPABASE_URL",
    "NURSEFLOW_SUPABASE_PUBLISHABLE_KEY",
    "NURSEFLOW_SUPABASE_SECRET_KEY",
)


def build_solver_config_from_environment() -> SolverConfig | None:
    """Enable `/v1/solve` only when a non-blank shared token is configured."""

    token = os.environ.get("NURSEFLOW_SOLVER_TOKEN", "").strip()
    if not token:
        return None
    return SolverConfig(solver_token=token, optimizer_version=OPTIMIZER_VERSION)


def build_dependencies_from_environment() -> OptimizerServiceDependencies | None:
    """Read only server-side configuration; no value is returned to the app.

    Returns None when no Supabase setting is present (legacy route disabled).
    A partial configuration is a mistake, so it fails at startup.
    """

    configured = [
        name for name in SUPABASE_SETTINGS if os.environ.get(name, "").strip()
    ]
    if not configured:
        return None
    if len(configured) != len(SUPABASE_SETTINGS):
        raise RuntimeError(
            "Incomplete Supabase configuration; set all of: "
            + ", ".join(SUPABASE_SETTINGS)
        )

    supabase_url = _required_environment("NURSEFLOW_SUPABASE_URL").rstrip("/")
    publishable_key = _required_environment("NURSEFLOW_SUPABASE_PUBLISHABLE_KEY")
    service_key = _required_environment("NURSEFLOW_SUPABASE_SECRET_KEY")
    issuer = os.environ.get(
        "NURSEFLOW_SUPABASE_JWT_ISSUER",
        f"{supabase_url}/auth/v1",
    ).strip()
    audience = os.environ.get(
        "NURSEFLOW_SUPABASE_JWT_AUDIENCE",
        "authenticated",
    ).strip()
    jwks_url = os.environ.get(
        "NURSEFLOW_SUPABASE_JWKS_URL",
        f"{supabase_url}/auth/v1/.well-known/jwks.json",
    ).strip()

    return OptimizerServiceDependencies(
        token_verifier=SupabaseJwtVerifier(
            jwks_url=jwks_url,
            issuer=issuer,
            audience=audience,
        ),
        prepare_client=SupabasePrepareClient(
            base_url=supabase_url,
            api_key=publishable_key,
        ),
        finalize_client=SupabaseFinalizeClient(
            base_url=supabase_url,
            api_key=service_key,
        ),
        service_token=service_key,
        optimizer_version=OPTIMIZER_VERSION,
    )


def create_app_from_environment() -> FastAPI:
    """Uvicorn factory used by local development and the container command."""

    dependencies = build_dependencies_from_environment()
    solver_config = build_solver_config_from_environment()
    if dependencies is None and solver_config is None:
        raise RuntimeError(
            "Configure NURSEFLOW_SOLVER_TOKEN and/or the NURSEFLOW_SUPABASE_* "
            "settings; no route would be enabled."
        )

    app = create_app(dependencies, solver_config)
    local_web_origin = os.environ.get(
        "NURSEFLOW_LOCAL_WEB_ORIGIN",
        "",
    ).strip()

    # Browser access exists only for the legacy mobile-web route. A
    # solver-only service is server-to-server and never answers CORS.
    if local_web_origin and dependencies is not None:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[local_web_origin],
            allow_credentials=False,
            allow_methods=["GET", "POST"],
            allow_headers=["Authorization", "Content-Type"],
        )

    return app
