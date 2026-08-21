from __future__ import annotations

import sys
import unittest
from pathlib import Path

from ortools.sat.python import cp_model

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fixture_helpers import build_shift_snapshot, load_fixture_catalog  # noqa: E402
from nurseflow_optimizer import normalize_shift_snapshot  # noqa: E402
from nurseflow_optimizer.assignment_model import (  # noqa: E402
    build_assignment_model,
    read_bed_owner_decisions,
)
from nurseflow_optimizer.team_coverage_model import (  # noqa: E402
    read_team_coverage_decision,
)


def fix_fixture_decisions(assignment, fixture: dict) -> None:
    expected = fixture["expected"]["decisions"]
    input_model = assignment.structure.input

    for team_index, team_label in enumerate(assignment.structure.team_labels):
        expected_nurse_ids = set(expected["teams"][team_label])
        for nurse in input_model.nurses:
            assignment.structure.model.add(
                assignment.structure.nurse_team[(nurse.ordinal, team_index)]
                == (1 if nurse.id in expected_nurse_ids else 0)
            )

    room_by_id = {room.id: room for room in input_model.rooms}
    for room_id, expected_team_label in expected["roomTeams"].items():
        if expected_team_label is None:
            continue
        room = room_by_id[room_id]
        expected_team_index = assignment.structure.team_labels.index(expected_team_label)
        assignment.structure.model.add(
            assignment.structure.room_team[(room.ordinal, expected_team_index)] == 1
        )

    bed_by_id = {bed.id: bed for bed in input_model.occupied_beds}
    nurse_by_id = {nurse.id: nurse for nurse in input_model.nurses}
    for bed_id, expected_nurse_id in expected["bedOwners"].items():
        bed = bed_by_id[bed_id]
        if expected_nurse_id is None:
            assignment.structure.model.add(assignment.bed_unassigned[bed.ordinal] == 1)
            continue
        nurse = nurse_by_id[expected_nurse_id]
        assignment.structure.model.add(
            assignment.bed_nurse[(bed.ordinal, nurse.ordinal)] == 1
        )


class AssignmentModelTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixtures = load_fixture_catalog()["fixtures"]

    def test_all_canonical_fixture_assignments_satisfy_hard_constraints(self) -> None:
        for fixture in self.fixtures:
            with self.subTest(fixture=fixture["id"]):
                normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
                assignment = build_assignment_model(normalized)
                fix_fixture_decisions(assignment, fixture)

                solver = cp_model.CpSolver()
                solver.parameters.num_search_workers = 1
                status = solver.solve(assignment.structure.model)
                self.assertEqual(status, cp_model.OPTIMAL)
                self.assertEqual(
                    {item.bed_id: item.nurse_id for item in read_bed_owner_decisions(assignment, solver)},
                    fixture["expected"]["decisions"]["bedOwners"],
                )

                coverage = read_team_coverage_decision(assignment.structure, solver)
                covered_nurses_by_room_id = {
                    room.room_id: set(room.nurse_ids) for room in coverage.rooms
                }
                for item in read_bed_owner_decisions(assignment, solver):
                    if item.nurse_id is None:
                        continue
                    bed = next(bed for bed in normalized.occupied_beds if bed.id == item.bed_id)
                    self.assertIn(item.nurse_id, covered_nurses_by_room_id[bed.room_id])

    def test_red_beds_do_not_create_lpn_owner_variables(self) -> None:
        fixture = next(
            item for item in self.fixtures if item["id"] == "red-bed-eligibility"
        )
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
        assignment = build_assignment_model(normalized)
        red_bed = normalized.occupied_beds[0]
        lpn = next(nurse for nurse in normalized.nurses if nurse.license_type == "LPN")

        self.assertNotIn((red_bed.ordinal, lpn.ordinal), assignment.bed_nurse)

    def test_forcing_more_than_max_load_is_infeasible(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "understaffed")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
        assignment = build_assignment_model(normalized)
        nurse = normalized.nurses[0]

        for bed in normalized.occupied_beds:
            assignment.structure.model.add(
                assignment.bed_nurse[(bed.ordinal, nurse.ordinal)] == 1
            )

        solver = cp_model.CpSolver()
        self.assertEqual(solver.solve(assignment.structure.model), cp_model.INFEASIBLE)

    def test_forcing_an_owner_outside_the_room_team_is_infeasible(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "stable-ties")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
        assignment = build_assignment_model(normalized)
        first_bed = normalized.occupied_beds[0]
        first_room = normalized.rooms[0]
        first_nurse = normalized.nurses[0]

        assignment.structure.model.add(assignment.structure.nurse_team[(0, 0)] == 1)
        assignment.structure.model.add(assignment.structure.room_team[(first_room.ordinal, 1)] == 1)
        assignment.structure.model.add(
            assignment.bed_nurse[(first_bed.ordinal, first_nurse.ordinal)] == 1
        )

        solver = cp_model.CpSolver()
        self.assertEqual(solver.solve(assignment.structure.model), cp_model.INFEASIBLE)

    def test_empty_beds_never_create_assignment_variables(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "empty-census")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
        assignment = build_assignment_model(normalized)
        self.assertEqual(assignment.bed_nurse, {})
        self.assertEqual(assignment.bed_unassigned, {})


if __name__ == "__main__":
    unittest.main()
