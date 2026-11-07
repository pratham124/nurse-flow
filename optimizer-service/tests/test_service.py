from __future__ import annotations

import unittest
from unittest.mock import patch

from ortools.sat.python import cp_model

from fixture_helpers import build_shift_snapshot, load_fixture_catalog
from nurseflow_optimizer.optimizer import (
    DEFAULT_SOLVE_BUDGET_SECONDS,
    ObjectiveStage,
    OptimizerTimedOutError,
    SolveFailureDiagnostics,
)
from nurseflow_optimizer.service import SolverConfig, run_solver_request

CONFIG = SolverConfig(solver_token="private-token", optimizer_version="test-version")


class SolverServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        fixture = next(
            item
            for item in load_fixture_catalog()["fixtures"]
            if item["id"] == "one-nurse"
        )
        cls.snapshot = build_shift_snapshot(fixture)

    def test_default_solve_budget_is_two_minutes(self) -> None:
        self.assertEqual(DEFAULT_SOLVE_BUDGET_SECONDS, 120.0)

    def test_solver_timeout_logs_private_diagnostics_without_entity_ids(self) -> None:
        diagnostics = SolveFailureDiagnostics(
            solve_budget_ms=50_000,
            elapsed_before_failed_stage_ms=10_000,
            remaining_budget_at_failed_stage_ms=40_000,
            failed_stage_duration_ms=40_000,
            total_elapsed_ms=50_000,
            completed_stages=(
                ObjectiveStage("canonical_room_team:private-room-id", 0, 12.5),
            ),
            solver_wall_time_ms=40_000,
            num_branches=42,
            num_conflicts=7,
            objective_value=4,
            best_objective_bound=3,
        )
        timeout = OptimizerTimedOutError(
            "canonical_bed_owner:private-bed-id",
            cp_model.FEASIBLE,
            diagnostics,
        )

        with patch(
            "nurseflow_optimizer.service.solve_optimizer",
            side_effect=timeout,
        ):
            with self.assertLogs(
                "nurseflow_optimizer.service",
                level="WARNING",
            ) as captured:
                outcome = run_solver_request(
                    {"runId": "run-1", "shiftSnapshot": self.snapshot},
                    CONFIG,
                )

        log_text = "\n".join(captured.output)
        self.assertEqual(outcome.http_status, 504)
        self.assertEqual(outcome.body, {"status": "timed_out"})
        self.assertIn("canonical_bed_owner", log_text)
        self.assertIn("canonical_room_team", log_text)
        self.assertNotIn("private-bed-id", log_text)
        self.assertNotIn("private-room-id", log_text)

    def test_invalid_snapshot_response_has_no_patient_details(self) -> None:
        outcome = run_solver_request(
            {
                "runId": "run-invalid",
                "shiftSnapshot": {"patient": {"diagnosis": "must stay private"}},
            },
            CONFIG,
        )

        self.assertEqual(outcome.http_status, 422)
        self.assertEqual(outcome.body, {"status": "invalid_input"})
        self.assertNotIn("diagnosis", str(outcome.body).lower())


if __name__ == "__main__":
    unittest.main()
