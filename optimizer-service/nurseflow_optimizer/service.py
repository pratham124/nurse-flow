"""Coordinate one authenticated NurseFlow assignment run.

This module deliberately contains no FastAPI or Supabase implementation code.
It describes the readable application flow and accepts small injected boundary
objects, which makes retries and failures testable without a live database.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Literal, Mapping, Protocol

from .models import OptimizerInputValidationError
from .normalization import normalize_shift_snapshot
from .optimizer import (
    DEFAULT_SOLVE_BUDGET_SECONDS,
    OptimizerSolveError,
    OptimizerTimedOutError,
    solve_optimizer,
)
from .output import AssignmentOutput, build_assignment_output

LOGGER = logging.getLogger(__name__)

RunStatus = Literal["running", "succeeded", "failed", "stale"]
PrepareStatus = Literal[
    "prepared",
    "existing",
    "stale",
    "conflict",
    "in_progress",
]
FinalizeStatus = Literal["saved", "stale", "failed"]

# The host allows 140 seconds. NurseFlow stops earlier so it can still return a
# typed response instead of letting the host cut off an unknown in-flight run.
REQUEST_DEADLINE_SECONDS = 135.0
FINALIZATION_RESERVE_SECONDS = 10.0


class OptimizerRequestError(ValueError):
    """The HTTP request or one trusted boundary returned an invalid shape."""


class OptimizerAuthenticationError(PermissionError):
    """The bearer token is missing, expired, or otherwise invalid."""


class OptimizerAuthorizationError(PermissionError):
    """The signed-in user is not allowed to optimize the requested shift."""


class OptimizerServiceUnavailableError(RuntimeError):
    """A required Supabase boundary could not be reached safely."""


@dataclass(frozen=True)
class OptimizerRunRequest:
    """The only action fields accepted from the mobile app."""

    shift_id: str
    client_mutation_id: str
    expected_shift_revision: str
    expected_baseline_assignment_result_id: str | None

    @classmethod
    def from_json(cls, value: Mapping[str, Any]) -> "OptimizerRunRequest":
        allowed_fields = {
            "shiftId",
            "clientMutationId",
            "expectedShiftRevision",
            "expectedBaselineAssignmentResultId",
        }
        unknown_fields = sorted(set(value) - allowed_fields)
        if unknown_fields:
            raise OptimizerRequestError(
                "Unsupported optimizer request fields: " + ", ".join(unknown_fields)
            )

        def required_text(field: str) -> str:
            item = value.get(field)
            if not isinstance(item, str) or not item.strip():
                raise OptimizerRequestError(f"{field} is required.")
            return item.strip()

        baseline = value.get("expectedBaselineAssignmentResultId")
        if baseline is not None and (
            not isinstance(baseline, str) or not baseline.strip()
        ):
            raise OptimizerRequestError(
                "expectedBaselineAssignmentResultId must be a string or null."
            )

        return cls(
            shift_id=required_text("shiftId"),
            client_mutation_id=required_text("clientMutationId"),
            expected_shift_revision=required_text("expectedShiftRevision"),
            expected_baseline_assignment_result_id=(
                baseline.strip() if isinstance(baseline, str) else None
            ),
        )


@dataclass(frozen=True)
class PreparedOptimizerRun:
    """Typed result returned by the authenticated prepare action."""

    prepare_status: PrepareStatus
    run_id: str | None = None
    run_status: RunStatus | None = None
    result_id: str | None = None
    outcome_code: str | None = None
    shift_id: str | None = None
    expected_shift_revision: str | None = None
    expected_baseline_assignment_result_id: str | None = None
    request_fingerprint: str | None = None
    shift_snapshot: Mapping[str, Any] | None = None


@dataclass(frozen=True)
class FinalizedOptimizerRun:
    """Small response returned by the protected finalization transaction."""

    status: FinalizeStatus
    run_id: str
    result_id: str | None = None


class TokenVerifier(Protocol):
    """Verify a bearer token without persisting or logging it."""

    def verify(self, authorization_header: str | None) -> str:
        ...


class PrepareClient(Protocol):
    """Call the user-authorized Supabase prepare action."""

    def prepare(
        self,
        authorization_header: str,
        request: OptimizerRunRequest,
    ) -> PreparedOptimizerRun:
        ...


class FinalizeClient(Protocol):
    """Call service-only Supabase finalization actions."""

    def finalize(
        self,
        service_token: str,
        prepared: PreparedOptimizerRun,
        output: AssignmentOutput,
        input_fingerprint: str,
        optimizer_version: str,
    ) -> FinalizedOptimizerRun:
        ...

    def mark_failed(
        self,
        service_token: str,
        run_id: str,
        outcome_code: str,
    ) -> None:
        ...


@dataclass(frozen=True)
class OptimizerServiceDependencies:
    """External boundaries required by the request workflow."""

    token_verifier: TokenVerifier
    prepare_client: PrepareClient
    finalize_client: FinalizeClient
    service_token: str
    optimizer_version: str
    solve_budget_seconds: float = DEFAULT_SOLVE_BUDGET_SECONDS


@dataclass(frozen=True)
class OptimizerServiceOutcome:
    """Typed public response that contains no solver or patient internals."""

    status: str
    http_status: int
    body: dict[str, Any]


def _outcome(
    status: str,
    http_status: int,
    *,
    run_id: str | None = None,
    result_id: str | None = None,
) -> OptimizerServiceOutcome:
    body: dict[str, Any] = {"status": status}
    if run_id is not None:
        body["runId"] = run_id
    if result_id is not None:
        body["resultId"] = result_id
    return OptimizerServiceOutcome(status=status, http_status=http_status, body=body)


def _existing_run_outcome(prepared: PreparedOptimizerRun) -> OptimizerServiceOutcome:
    """Return the saved or failed outcome of an identical completed retry."""

    if prepared.run_status == "succeeded":
        return _outcome(
            "saved",
            200,
            run_id=prepared.run_id,
            result_id=prepared.result_id,
        )
    if prepared.run_status == "stale":
        return _outcome("stale", 409, run_id=prepared.run_id)
    if prepared.run_status == "failed":
        if prepared.outcome_code == "invalid_input":
            return _outcome("invalid_input", 422, run_id=prepared.run_id)
        if prepared.outcome_code == "timed_out":
            return _outcome("timed_out", 504, run_id=prepared.run_id)
        return _outcome("failed", 500, run_id=prepared.run_id)
    return _outcome("running", 202, run_id=prepared.run_id)


def _mark_failed_safely(
    dependencies: OptimizerServiceDependencies,
    run_id: str,
    outcome_code: str,
) -> None:
    """Record a coarse failure code without hiding the original safe outcome."""

    try:
        dependencies.finalize_client.mark_failed(
            dependencies.service_token,
            run_id,
            outcome_code,
        )
    except Exception:
        # The baseline still remains unchanged. Detailed failure diagnostics
        # belong in private service logs, never in the mobile response.
        pass


def _log_timeout_safely(run_id: str, error: OptimizerTimedOutError) -> None:
    """Log private solver evidence without entity IDs or snapshot contents."""

    diagnostics = (
        error.diagnostics.to_dict(include_decision_ids=False)
        if error.diagnostics is not None
        else None
    )
    LOGGER.warning(
        "optimizer_timeout %s",
        json.dumps(
            {
                "runId": run_id,
                "failedStage": error.stage.split(":", 1)[0],
                "solverStatus": error.status.name,
                "diagnostics": diagnostics,
            },
            separators=(",", ":"),
            sort_keys=True,
        ),
    )


def _require_prepared_snapshot(prepared: PreparedOptimizerRun) -> Mapping[str, Any]:
    if not prepared.run_id or not prepared.shift_snapshot:
        raise OptimizerRequestError("Prepare did not return a runnable shift snapshot.")
    return prepared.shift_snapshot


def run_optimizer_request(
    authorization_header: str | None,
    request_body: Mapping[str, Any],
    dependencies: OptimizerServiceDependencies,
) -> OptimizerServiceOutcome:
    """Authenticate, prepare, solve, validate, and atomically finalize one run."""

    request_started_at = time.monotonic()

    # Boundary 1: authenticate before accessing any server-owned shift data.
    try:
        dependencies.token_verifier.verify(authorization_header)
    except OptimizerAuthenticationError:
        return _outcome("unauthorized", 401)

    # Boundary 2: accept only the small action contract from the phone.
    try:
        request = OptimizerRunRequest.from_json(request_body)
    except OptimizerRequestError:
        return _outcome("invalid_input", 422)

    # Boundary 3: Supabase authorizes ownership and coordinates retries.
    try:
        prepared = dependencies.prepare_client.prepare(
            authorization_header or "",
            request,
        )
    except OptimizerAuthenticationError:
        # The token can expire between local verification and the prepare RPC.
        return _outcome("unauthorized", 401)
    except OptimizerAuthorizationError:
        return _outcome("forbidden", 403)
    except OptimizerServiceUnavailableError:
        return _outcome("unavailable", 503)
    except OptimizerRequestError:
        return _outcome("failed", 500)

    if prepared.prepare_status == "existing":
        return _existing_run_outcome(prepared)
    if prepared.prepare_status == "stale":
        return _outcome("stale", 409)
    if prepared.prepare_status == "conflict":
        return _outcome("conflict", 409, run_id=prepared.run_id)
    if prepared.prepare_status == "in_progress":
        return _outcome("running", 202, run_id=prepared.run_id)
    if prepared.prepare_status != "prepared" or not prepared.run_id:
        return _outcome("failed", 500)

    # Boundary 4: normalize, solve, and independently validate in Python.
    elapsed_before_solve = time.monotonic() - request_started_at
    remaining_solve_budget = min(
        dependencies.solve_budget_seconds,
        REQUEST_DEADLINE_SECONDS
        - elapsed_before_solve
        - FINALIZATION_RESERVE_SECONDS,
    )
    if remaining_solve_budget <= 0:
        _mark_failed_safely(dependencies, prepared.run_id, "timed_out")
        return _outcome("timed_out", 504, run_id=prepared.run_id)

    try:
        normalization = normalize_shift_snapshot(_require_prepared_snapshot(prepared))
        solution = solve_optimizer(
            normalization.model,
            solve_budget_seconds=remaining_solve_budget,
        )
        output = build_assignment_output(normalization.model, solution)
    except OptimizerInputValidationError:
        _mark_failed_safely(dependencies, prepared.run_id, "invalid_input")
        return _outcome("invalid_input", 422, run_id=prepared.run_id)
    except OptimizerTimedOutError as error:
        _log_timeout_safely(prepared.run_id, error)
        _mark_failed_safely(dependencies, prepared.run_id, "timed_out")
        return _outcome("timed_out", 504, run_id=prepared.run_id)
    except OptimizerSolveError:
        _mark_failed_safely(dependencies, prepared.run_id, "solver_failed")
        return _outcome("failed", 500, run_id=prepared.run_id)
    except Exception:
        _mark_failed_safely(dependencies, prepared.run_id, "internal_failure")
        return _outcome("failed", 500, run_id=prepared.run_id)

    # Do not enter a network write when there is no longer enough time reserved
    # to finish it and return before the host's request cutoff.
    if (
        time.monotonic() - request_started_at
        > REQUEST_DEADLINE_SECONDS - FINALIZATION_RESERVE_SECONDS
    ):
        _mark_failed_safely(dependencies, prepared.run_id, "timed_out")
        return _outcome("timed_out", 504, run_id=prepared.run_id)

    # Boundary 5: only the service credential may enter the atomic save.
    try:
        finalized = dependencies.finalize_client.finalize(
            dependencies.service_token,
            prepared,
            output,
            normalization.fingerprint,
            dependencies.optimizer_version,
        )
    except OptimizerServiceUnavailableError:
        return _outcome("unavailable", 503, run_id=prepared.run_id)
    except Exception:
        _mark_failed_safely(dependencies, prepared.run_id, "finalization_failed")
        return _outcome("failed", 500, run_id=prepared.run_id)

    if finalized.status == "stale":
        return _outcome("stale", 409, run_id=prepared.run_id)
    if finalized.status != "saved" or not finalized.result_id:
        return _outcome("failed", 500, run_id=prepared.run_id)

    return _outcome(
        "saved",
        200,
        run_id=prepared.run_id,
        result_id=finalized.result_id,
    )
