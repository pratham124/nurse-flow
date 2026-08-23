"""Small Supabase RPC clients for prepare, finalization, and safe failure."""

from __future__ import annotations

from typing import Any, Mapping

import httpx

from .output import AssignmentOutput
from .service import (
    FinalizeClient,
    FinalizedOptimizerRun,
    OptimizerAuthenticationError,
    OptimizerAuthorizationError,
    OptimizerRequestError,
    OptimizerRunRequest,
    OptimizerServiceUnavailableError,
    PrepareClient,
    PreparedOptimizerRun,
)


def _bearer(value: str) -> str:
    return value if value.lower().startswith("bearer ") else f"Bearer {value}"


def _require_optional_text(value: Any, field: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise OptimizerRequestError(f"Supabase returned an invalid {field}.")
    return value


class _SupabaseRpcClient:
    """Shared HTTP behavior without logging headers or response bodies."""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        timeout_seconds: float = 8.0,
        http_client: httpx.Client | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.http_client = http_client or httpx.Client()

    def _call(
        self,
        function_name: str,
        payload: Mapping[str, Any],
        authorization: str,
    ) -> dict[str, Any]:
        try:
            response = self.http_client.post(
                f"{self.base_url}/rest/v1/rpc/{function_name}",
                json=payload,
                headers={
                    "Accept": "application/json",
                    "Authorization": _bearer(authorization),
                    "Content-Type": "application/json",
                    "apikey": self.api_key,
                },
                timeout=self.timeout_seconds,
            )
        except httpx.HTTPError as error:
            raise OptimizerServiceUnavailableError(
                "Supabase could not be reached."
            ) from error

        if response.status_code == 401:
            raise OptimizerAuthenticationError("Supabase rejected the session.")
        if response.status_code == 403:
            raise OptimizerAuthorizationError("Supabase denied the request.")
        if response.status_code >= 400:
            raise OptimizerServiceUnavailableError("Supabase RPC failed safely.")

        try:
            value = response.json()
        except ValueError as error:
            raise OptimizerRequestError("Supabase returned invalid JSON.") from error
        if isinstance(value, list) and len(value) == 1:
            value = value[0]
        if not isinstance(value, dict):
            raise OptimizerRequestError("Supabase returned an invalid RPC shape.")
        return value


class SupabasePrepareClient(_SupabaseRpcClient, PrepareClient):
    """Forward the user's bearer context to `prepare_optimizer_run`."""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        timeout_seconds: float = 8.0,
        http_client: httpx.Client | None = None,
    ) -> None:
        # The shared parent stores the connection settings and supplies _call().
        super().__init__(
            base_url=base_url,
            api_key=api_key,
            timeout_seconds=timeout_seconds,
            http_client=http_client,
        )

    def prepare(
        self,
        authorization_header: str,
        request: OptimizerRunRequest,
    ) -> PreparedOptimizerRun:
        value = self._call(
            "prepare_optimizer_run",
            {
                "p_shift_id": request.shift_id,
                "p_client_mutation_id": request.client_mutation_id,
                "p_expected_shift_revision": request.expected_shift_revision,
                "p_expected_baseline_assignment_result_id": (
                    request.expected_baseline_assignment_result_id
                ),
            },
            authorization_header,
        )

        prepare_status = value.get("status")
        if prepare_status not in {
            "prepared",
            "existing",
            "stale",
            "conflict",
            "in_progress",
        }:
            raise OptimizerRequestError("Prepare returned an invalid status.")

        snapshot = value.get("shiftSnapshot")
        if snapshot is not None and not isinstance(snapshot, dict):
            raise OptimizerRequestError("Prepare returned an invalid shift snapshot.")

        run_status = value.get("runStatus")
        if run_status is not None and run_status not in {
            "running",
            "succeeded",
            "failed",
            "stale",
        }:
            raise OptimizerRequestError("Prepare returned an invalid run status.")

        outcome_summary = value.get("outcomeSummary")
        outcome_code = None
        if isinstance(outcome_summary, dict):
            outcome_code = _require_optional_text(
                outcome_summary.get("errorCode"),
                "outcome error code",
            )

        return PreparedOptimizerRun(
            prepare_status=prepare_status,
            run_id=_require_optional_text(value.get("runId"), "run ID"),
            run_status=run_status,
            result_id=_require_optional_text(value.get("resultId"), "result ID"),
            outcome_code=outcome_code,
            shift_id=_require_optional_text(value.get("shiftId"), "shift ID"),
            expected_shift_revision=_require_optional_text(
                value.get("expectedShiftRevision"),
                "shift revision",
            ),
            expected_baseline_assignment_result_id=_require_optional_text(
                value.get("expectedBaselineAssignmentResultId"),
                "baseline result ID",
            ),
            request_fingerprint=_require_optional_text(
                value.get("requestFingerprint"),
                "request fingerprint",
            ),
            shift_snapshot=snapshot,
        )


class SupabaseFinalizeClient(_SupabaseRpcClient, FinalizeClient):
    """Use the service credential for the narrow protected write functions."""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        timeout_seconds: float = 8.0,
        http_client: httpx.Client | None = None,
    ) -> None:
        # This uses the same shared HTTP setup as prepare. The important
        # difference is that runtime.py passes the private service key here.
        super().__init__(
            base_url=base_url,
            api_key=api_key,
            timeout_seconds=timeout_seconds,
            http_client=http_client,
        )

    def finalize(
        self,
        service_token: str,
        prepared: PreparedOptimizerRun,
        output: AssignmentOutput,
        input_fingerprint: str,
        optimizer_version: str,
    ) -> FinalizedOptimizerRun:
        if not prepared.run_id:
            raise OptimizerRequestError("A run ID is required for finalization.")
        value = self._call(
            "finalize_optimizer_run",
            {
                "p_run_id": prepared.run_id,
                "p_input_fingerprint": input_fingerprint,
                "p_optimizer_version": optimizer_version,
                "p_assignment_result": output.assignment_result.to_dict(),
                "p_flags": [flag.to_dict() for flag in output.flags],
                "p_objectives": output.objectives.to_fixture_dict(),
            },
            service_token,
        )
        status = value.get("status")
        if status not in {"saved", "stale", "failed"}:
            raise OptimizerRequestError("Finalization returned an invalid status.")
        return FinalizedOptimizerRun(
            status=status,
            run_id=prepared.run_id,
            result_id=_require_optional_text(value.get("resultId"), "result ID"),
        )

    def mark_failed(
        self,
        service_token: str,
        run_id: str,
        outcome_code: str,
    ) -> None:
        self._call(
            "fail_optimizer_run",
            {
                "p_run_id": run_id,
                "p_error_code": outcome_code,
            },
            service_token,
        )
