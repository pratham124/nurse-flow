from __future__ import annotations

import sys
import unittest
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fixture_helpers import build_shift_snapshot, load_fixture_catalog  # noqa: E402
from nurseflow_optimizer import normalize_shift_snapshot  # noqa: E402
from nurseflow_optimizer.optimizer import (  # noqa: E402
    EXPECTED_ORTOOLS_VERSION,
    OptimizerTimedOutError,
    solve_optimizer,
)


def decision_dict(solution) -> dict:
    return {
        "teams": {
            team.label: list(team.nurse_ids) for team in solution.team_coverage.teams
        },
        "roomTeams": {
            room.room_id: room.team_label for room in solution.team_coverage.rooms
        },
        "bedOwners": {bed.bed_id: bed.nurse_id for bed in solution.bed_owners},
    }


class OptimizerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixtures = load_fixture_catalog()["fixtures"]

    def test_pinned_ortools_version_matches_the_frozen_contract(self) -> None:
        import ortools

        self.assertEqual(ortools.__version__, EXPECTED_ORTOOLS_VERSION)

    def test_every_fixture_reaches_its_canonical_decisions_and_objectives(self) -> None:
        for fixture in self.fixtures:
            with self.subTest(fixture=fixture["id"]):
                normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
                solution = solve_optimizer(normalized)
                self.assertEqual(
                    solution.objectives.to_fixture_dict(),
                    fixture["expected"]["objectives"],
                )
                self.assertEqual(decision_dict(solution), fixture["expected"]["decisions"])

    def test_staged_trace_fixes_primary_objectives_before_canonical_choices(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "stable-ties")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
        solution = solve_optimizer(normalized)
        stage_names = [stage.name for stage in solution.stage_trace]

        self.assertEqual(
            stage_names[:6],
            [
                "unassigned_count",
                "max_nurse_acuity_load",
                "max_nurse_patient_count",
                "red_bed_owner_rank_sum",
                "side_guidance_total_excess",
                "side_guidance_nurse_count",
            ],
        )
        self.assertLess(
            stage_names.index("team_capacity_gap"),
            stage_names.index("canonical_room_team:room-1"),
        )
        self.assertLess(
            stage_names.index("canonical_bed_owner:bed-1"),
            stage_names.index("canonical_team_membership:nurse-1"),
        )

    def test_same_normalized_input_produces_identical_decisions(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "stable-ties")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
        decisions = [decision_dict(solve_optimizer(normalized)) for _ in range(3)]
        self.assertEqual(decisions[0], decisions[1])
        self.assertEqual(decisions[1], decisions[2])

    def test_expired_shared_budget_does_not_return_a_partial_candidate(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "one-nurse")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
        with self.assertRaises(OptimizerTimedOutError):
            solve_optimizer(normalized, solve_budget_seconds=0)


if __name__ == "__main__":
    unittest.main()
