"""Solve one shift snapshot sent by the Go API.

This module deliberately contains no FastAPI code. It describes the readable
solver flow: check the shared token, normalize the snapshot, solve it, and
return a small typed response.
"""

from __future__ import annotations

import hmac
import json
import logging
from dataclasses import dataclass
from typing import Any, Mapping

from .models import (
    InputValidationIssue,
    NormalizationResult,
    OptimizerInputValidationError,
)
from .normalization import normalize_shift_snapshot
from .optimizer import (
    DEFAULT_SOLVE_BUDGET_SECONDS,
    OptimizerTimedOutError,
    solve_optimizer,
)
from .output import AssignmentOutput, build_assignment_output

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class SolverConfig:
    """Settings for the Go-facing solver-only endpoint (`POST /v1/solve`)."""

    solver_token: str
    optimizer_version: str


@dataclass(frozen=True)
class OptimizerServiceOutcome:
    """Typed public response that contains no solver or patient internals.

    An `invalid_input` body may also carry `reasons`: short codes with an
    optional numeric limit, never messages, paths, IDs, or patient data.
    """

    status: str
    http_status: int
    body: dict[str, Any]


def _outcome(
    status: str,
    http_status: int,
) -> OptimizerServiceOutcome:
    return OptimizerServiceOutcome(
        status=status,
        http_status=http_status,
        body={"status": status},
    )


# Keeps the response small even if a snapshot breaks many rules at once.
MAX_REASONS = 10


def _build_reasons(issues: tuple[InputValidationIssue, ...]) -> list[dict[str, Any]]:
    """Turn validation issues into distinct, safe `{code, limit?}` reasons.

    Only the code and the limit are copied. The issue path and message can name
    fields or records, so they stay out of the response.
    """

    reasons: list[dict[str, Any]] = []
    seen_codes: set[str] = set()
    for issue in issues:
        if issue.code in seen_codes:
            continue
        seen_codes.add(issue.code)
        reason: dict[str, Any] = {"code": issue.code}
        if issue.limit is not None:
            reason["limit"] = issue.limit
        reasons.append(reason)
        if len(reasons) == MAX_REASONS:
            break
    return reasons


def _invalid_input_outcome(
    error: OptimizerInputValidationError,
) -> OptimizerServiceOutcome:
    """Build the 422 response, adding `reasons` only when there are some."""

    body: dict[str, Any] = {"status": "invalid_input"}
    reasons = _build_reasons(error.issues)
    if reasons:
        body["reasons"] = reasons
    return OptimizerServiceOutcome(status="invalid_input", http_status=422, body=body)


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


@dataclass(frozen=True)
class SolvedSnapshot:
    """A normalized snapshot together with its validated solver output."""

    normalization: NormalizationResult
    output: AssignmentOutput


def solve_snapshot(
    shift_snapshot: Mapping[str, Any],
    solve_budget_seconds: float,
) -> SolvedSnapshot:
    """Normalize, solve, and validate one snapshot.

    Errors propagate unchanged; the caller maps them to a coarse response.
    """

    normalization = normalize_shift_snapshot(shift_snapshot)
    solution = solve_optimizer(
        normalization.model,
        solve_budget_seconds=solve_budget_seconds,
    )
    output = build_assignment_output(normalization.model, solution)
    return SolvedSnapshot(normalization=normalization, output=output)


def is_valid_solver_token(
    authorization_header: str | None,
    config: SolverConfig,
) -> bool:
    """Compare the bearer token in constant time so timing leaks nothing."""

    if not authorization_header:
        return False
    scheme, _, token = authorization_header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return False
    return hmac.compare_digest(
        token.encode("utf-8"),
        config.solver_token.encode("utf-8"),
    )


def run_solver_request(
    request_body: Mapping[str, Any],
    config: SolverConfig,
) -> OptimizerServiceOutcome:
    """Solve one snapshot sent by the Go API; authentication happens earlier.

    The body must be exactly `{"runId": <text>, "shiftSnapshot": <object>}`.
    `runId` is used only to correlate private timeout logs. Responses stay
    coarse and never contain snapshot content.
    """

    run_id = request_body.get("runId")
    snapshot = request_body.get("shiftSnapshot")
    if (
        set(request_body) != {"runId", "shiftSnapshot"}
        or not isinstance(run_id, str)
        or not run_id.strip()
        or not isinstance(snapshot, dict)
    ):
        return _outcome("invalid_input", 422)
    run_id = run_id.strip()

    try:
        solved = solve_snapshot(snapshot, DEFAULT_SOLVE_BUDGET_SECONDS)
    except OptimizerInputValidationError as error:
        return _invalid_input_outcome(error)
    except OptimizerTimedOutError as error:
        _log_timeout_safely(run_id, error)
        return _outcome("timed_out", 504)
    except Exception:
        # Includes OptimizerSolveError. Details stay out of the response.
        return _outcome("failed", 500)

    output = solved.output
    return OptimizerServiceOutcome(
        status="solved",
        http_status=200,
        body={
            "assignmentResult": output.assignment_result.to_dict(),
            "flags": [flag.to_dict() for flag in output.flags],
            "objectives": output.objectives.to_fixture_dict(),
            "inputFingerprint": solved.normalization.fingerprint,
            "optimizerVersion": config.optimizer_version,
        },
    )
