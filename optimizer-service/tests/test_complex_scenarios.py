from __future__ import annotations

import sys
import unittest
from collections import Counter
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fixture_helpers import build_shift_snapshot, load_fixture_catalog  # noqa: E402
from nurseflow_optimizer import normalize_shift_snapshot  # noqa: E402
from nurseflow_optimizer.optimizer import solve_optimizer  # noqa: E402
from nurseflow_optimizer.output import build_assignment_output  # noqa: E402
from scenario_helpers import (  # noqa: E402
    build_complex_shift_snapshot,
    build_maximum_shift_snapshot,
    build_required_large_shift_snapshot,
    perturb_incidental_snapshot_order,
)


def decision_dict(solution) -> dict[str, object]:
    return {
        "teams": {
            team.label: list(team.nurse_ids) for team in solution.team_coverage.teams
        },
        "roomTeams": {
            room.room_id: room.team_label for room in solution.team_coverage.rooms
        },
        "bedOwners": {bed.bed_id: bed.nurse_id for bed in solution.bed_owners},
    }


class ComplexScenarioTests(unittest.TestCase):
    def solve_and_build(self, snapshot: dict[str, object]):
        normalization = normalize_shift_snapshot(snapshot)
        solution = solve_optimizer(normalization.model)
        output = build_assignment_output(normalization.model, solution)
        return normalization, solution, output

    def assert_output_properties(self, normalization, solution, output) -> None:
        model = normalization.model
        result = output.assignment_result
        nurse_by_id = {nurse.id: nurse for nurse in model.nurses}
        bed_by_id = {bed.id: bed for bed in model.occupied_beds}
        coverage_by_room_id = {
            coverage.room_id: set(coverage.nurse_ids)
            for coverage in result.room_coverage
        }

        self.assertTrue(result.id)
        self.assertEqual(
            len(result.bed_assignments),
            len({assignment.bed_id for assignment in result.bed_assignments}),
        )
        self.assertEqual(set(coverage_by_room_id), {room.id for room in model.rooms})

        team_nurse_ids = [
            nurse_id for team in result.generated_teams for nurse_id in team.nurse_ids
        ]
        self.assertCountEqual(team_nurse_ids, nurse_by_id)
        self.assertEqual(len(team_nurse_ids), len(set(team_nurse_ids)))

        load_by_nurse_id: Counter[str] = Counter()
        for assignment in result.bed_assignments:
            self.assertIn(assignment.bed_id, bed_by_id)
            self.assertIn(assignment.nurse_id, nurse_by_id)
            bed = bed_by_id[assignment.bed_id]
            nurse = nurse_by_id[assignment.nurse_id]
            if bed.acuity == "red":
                self.assertEqual(nurse.license_type, "RN")
            self.assertIn(assignment.nurse_id, coverage_by_room_id[bed.room_id])
            load_by_nurse_id[assignment.nurse_id] += 1

        for nurse_id, load in load_by_nurse_id.items():
            self.assertLessEqual(load, nurse_by_id[nurse_id].max_patient_load)

        assigned_count = len(result.bed_assignments)
        self.assertEqual(
            assigned_count + solution.objectives.unassigned_count,
            len(model.occupied_beds),
        )
        self.assertTrue(all(stage.duration_ms >= 0 for stage in solution.stage_trace))

    def test_canonical_and_complex_scenarios_satisfy_output_properties(self) -> None:
        snapshots = [
            build_shift_snapshot(fixture)
            for fixture in load_fixture_catalog()["fixtures"]
        ]
        snapshots.append(build_complex_shift_snapshot())

        for snapshot in snapshots:
            with self.subTest(shift=snapshot["id"]):
                self.assert_output_properties(*self.solve_and_build(snapshot))

    def test_complex_scenario_is_full_and_repeatable(self) -> None:
        snapshot = build_complex_shift_snapshot()
        first = self.solve_and_build(snapshot)
        second = self.solve_and_build(snapshot)

        self.assertEqual(first[1].objectives.unassigned_count, 0)
        self.assertEqual(decision_dict(first[1]), decision_dict(second[1]))

    def test_incidental_order_and_patient_text_do_not_change_decisions(self) -> None:
        snapshot = build_complex_shift_snapshot()
        perturbed = perturb_incidental_snapshot_order(snapshot)
        first = self.solve_and_build(snapshot)
        second = self.solve_and_build(perturbed)

        self.assertEqual(first[0].fingerprint, second[0].fingerprint)
        self.assertEqual(decision_dict(first[1]), decision_dict(second[1]))

    def test_successive_outputs_use_fresh_ids_for_the_same_decisions(self) -> None:
        normalization = normalize_shift_snapshot(build_complex_shift_snapshot())
        solution = solve_optimizer(normalization.model)
        first = build_assignment_output(normalization.model, solution)
        second = build_assignment_output(normalization.model, solution)

        self.assertNotEqual(first.assignment_result.id, second.assignment_result.id)
        first_child_ids = {
            item.id
            for group in (
                first.assignment_result.generated_teams,
                first.assignment_result.room_coverage,
                first.assignment_result.bed_assignments,
            )
            for item in group
        }
        second_child_ids = {
            item.id
            for group in (
                second.assignment_result.generated_teams,
                second.assignment_result.room_coverage,
                second.assignment_result.bed_assignments,
            )
            for item in group
        }
        self.assertTrue(first_child_ids.isdisjoint(second_child_ids))

    def test_maximum_variants_match_the_frozen_supported_shape(self) -> None:
        for understaffed in (False, True):
            with self.subTest(understaffed=understaffed):
                normalization = normalize_shift_snapshot(
                    build_maximum_shift_snapshot(understaffed=understaffed)
                )
                model = normalization.model
                self.assertEqual(len(model.doctor_sides), 2)
                self.assertEqual(len(model.rooms), 25)
                self.assertEqual(len(model.occupied_beds), 50)
                self.assertEqual(len(model.nurses), 12)
                self.assertEqual(model.team_count, 3)

    def test_required_20_room_80_bed_floor_solves_exactly(self) -> None:
        snapshot = build_required_large_shift_snapshot(understaffed=False)
        normalization, solution, output = self.solve_and_build(snapshot)

        self.assert_output_properties(normalization, solution, output)
        self.assertEqual(len(output.assignment_result.bed_assignments), 80)
        self.assertEqual(solution.objectives.unassigned_count, 0)
        self.assertIn(
            "red_bed_owner_rank_structural_bound",
            {stage.name for stage in solution.stage_trace},
        )
        self.assertTrue(
            any(
                stage.name.startswith("canonical_bed_owner_chunk:")
                for stage in solution.stage_trace
            )
        )


if __name__ == "__main__":
    unittest.main()
