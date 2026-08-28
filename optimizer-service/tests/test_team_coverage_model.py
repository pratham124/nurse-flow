from __future__ import annotations

import sys
import unittest
from pathlib import Path

from ortools.sat.python import cp_model

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fixture_helpers import build_shift_snapshot, load_fixture_catalog  # noqa: E402
from scenario_helpers import build_synthetic_shift_snapshot  # noqa: E402
from nurseflow_optimizer import normalize_shift_snapshot  # noqa: E402
from nurseflow_optimizer.team_coverage_model import (  # noqa: E402
    build_team_coverage_model,
    read_team_coverage_decision,
)


def solve_fixed_fixture_structure(fixture: dict):
    normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
    structure = build_team_coverage_model(normalized)
    expected = fixture["expected"]["decisions"]

    for team_index, team_label in enumerate(structure.team_labels):
        expected_nurse_ids = set(expected["teams"][team_label])
        for nurse in normalized.nurses:
            structure.model.add(
                structure.nurse_team[(nurse.ordinal, team_index)]
                == (1 if nurse.id in expected_nurse_ids else 0)
            )

    room_by_id = {room.id: room for room in normalized.rooms}
    for room_id, expected_team_label in expected["roomTeams"].items():
        if expected_team_label is None:
            continue
        room = room_by_id[room_id]
        expected_team_index = structure.team_labels.index(expected_team_label)
        structure.model.add(structure.room_team[(room.ordinal, expected_team_index)] == 1)

    solver = cp_model.CpSolver()
    solver.parameters.num_search_workers = 1
    status = solver.solve(structure.model)
    return normalized, structure, solver, status


class TeamCoverageModelTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixtures = load_fixture_catalog()["fixtures"]

    def test_every_canonical_fixture_structure_is_feasible(self) -> None:
        for fixture in self.fixtures:
            with self.subTest(fixture=fixture["id"]):
                normalized, structure, solver, status = solve_fixed_fixture_structure(fixture)
                self.assertEqual(status, cp_model.OPTIMAL)
                decision = read_team_coverage_decision(structure, solver)

                expected = fixture["expected"]["decisions"]
                self.assertEqual(
                    {team.label: list(team.nurse_ids) for team in decision.teams},
                    expected["teams"],
                )
                self.assertEqual(
                    {room.room_id: room.team_label for room in decision.rooms},
                    expected["roomTeams"],
                )
                self.assertEqual(
                    {nurse_id for team in decision.teams for nurse_id in team.nurse_ids},
                    {nurse.id for nurse in normalized.nurses},
                )

    def test_room_coverage_is_exactly_the_selected_teams_membership(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "split-room")
        _, structure, solver, status = solve_fixed_fixture_structure(fixture)
        self.assertEqual(status, cp_model.OPTIMAL)

        decision = read_team_coverage_decision(structure, solver)
        covered_room = decision.rooms[0]
        selected_team = next(
            team for team in decision.teams if team.label == covered_room.team_label
        )
        self.assertEqual(covered_room.nurse_ids, selected_team.nurse_ids)
        self.assertEqual(len(covered_room.nurse_ids), 2)

    def test_generated_team_labels_follow_first_room_appearance_order(self) -> None:
        fixture = next(
            item for item in self.fixtures if item["id"] == "active-side-guidance"
        )
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
        structure = build_team_coverage_model(normalized)
        first_room = normalized.rooms[0]
        structure.model.add(
            structure.room_team[(first_room.ordinal, 1)] == 1
        )

        solver = cp_model.CpSolver()
        self.assertEqual(solver.solve(structure.model), cp_model.INFEASIBLE)

    def test_value_precedence_does_not_require_contiguous_room_coverage(self) -> None:
        snapshot = build_synthetic_shift_snapshot(
            scenario_id="non-contiguous-room-teams",
            room_bed_counts=[1, 1, 1],
            nurse_count=3,
            max_patient_load=2,
        )
        normalized = normalize_shift_snapshot(snapshot).model
        structure = build_team_coverage_model(normalized)
        expected_team_indexes = (0, 1, 0)
        for room, team_index in zip(
            normalized.rooms,
            expected_team_indexes,
            strict=True,
        ):
            structure.model.add(
                structure.room_team[(room.ordinal, team_index)] == 1
            )

        solver = cp_model.CpSolver()
        self.assertEqual(solver.solve(structure.model), cp_model.OPTIMAL)

    def test_empty_rooms_have_no_solver_team_variable_or_coverage(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "empty-census")
        _, structure, solver, status = solve_fixed_fixture_structure(fixture)
        self.assertEqual(status, cp_model.OPTIMAL)
        self.assertEqual(structure.room_team, {})

        decision = read_team_coverage_decision(structure, solver)
        self.assertTrue(
            all(room.team_label is None and room.nurse_ids == () for room in decision.rooms)
        )

    def test_fixed_structure_projection_is_repeatable(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "stable-ties")
        decisions = []
        for _ in range(3):
            _, structure, solver, status = solve_fixed_fixture_structure(fixture)
            self.assertEqual(status, cp_model.OPTIMAL)
            decisions.append(read_team_coverage_decision(structure, solver))
        self.assertEqual(decisions[0], decisions[1])
        self.assertEqual(decisions[1], decisions[2])


if __name__ == "__main__":
    unittest.main()
