"""Build production service dependencies from private environment variables."""

from __future__ import annotations

import os

from fastapi import FastAPI

from .auth import SupabaseJwtVerifier
from .http_api import create_app
from .service import OptimizerServiceDependencies
from .supabase_clients import SupabaseFinalizeClient, SupabasePrepareClient

OPTIMIZER_VERSION = "phase9-v1-ortools-9.15.6755"


def _required_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required service configuration: {name}")
    return value


def build_dependencies_from_environment() -> OptimizerServiceDependencies:
    """Read only server-side configuration; no value is returned to the app."""

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

    return create_app(build_dependencies_from_environment())
