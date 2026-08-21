from __future__ import annotations

import sys
import unittest
from dataclasses import replace
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fixture_helpers import build_shift_snapshot, load_fixture_catalog  # noqa: E402
from nurseflow_optimizer import normalize_shift_snapshot  # noqa: E402
from nurseflow_optimizer.optimizer import solve_optimizer  # noqa: E402
from nurseflow_optimizer.output import (  # noqa: E402
    OptimizerOutputValidationError,
    build_assignment_output,
    validate_assignment_output,
)


class OutputTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixtures = load_fixture_catalog()["fixtures"]

    def solve_fixture(self, fixture_id: str):
        fixture = next(item for item in self.fixtures if item["id"] == fixture_id)
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
        solution = solve_optimizer(normalized)
        return normalized, solution

    def test_every_fixture_builds_the_existing_assignment_result_shape(self) -> None:
        for fixture in self.fixtures:
            with self.subTest(fixture=fixture["id"]):
                normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
                solution = solve_optimizer(normalized)
                output = build_assignment_output(
                    normalized,
                    solution,
                    result_id_factory=lambda: f"result-{fixture['id']}",
                )
                result = output.assignment_result.to_dict()
                self.assertEqual(
                    set(result), {"id", "generatedTeams", "roomCoverage", "bedAssignments"}
                )
                self.assertTrue(
                    all(
                        set(team) == {"id", "label", "nurseIds"}
                        for team in result["generatedTeams"]
                    )
                )
                self.assertTrue(
                    all(
                        set(coverage) == {"id", "roomId", "nurseIds"}
                        for coverage in result["roomCoverage"]
                    )
                )
                self.assertTrue(
                    all(
                        set(assignment) == {"id", "bedId", "nurseId"}
                        for assignment in result["bedAssignments"]
                    )
                )

    def test_successive_builds_receive_fresh_result_and_child_ids(self) -> None:
        normalized, solution = self.solve_fixture("stable-ties")
        first = build_assignment_output(normalized, solution)
        second = build_assignment_output(normalized, solution)
        self.assertNotEqual(first.assignment_result.id, second.assignment_result.id)
        self.assertNotEqual(
            first.assignment_result.generated_teams[0].id,
            second.assignment_result.generated_teams[0].id,
        )

        repeated = build_assignment_output(
            normalized, solution, result_id_factory=lambda: "fixed-result"
        )
        repeated_again = build_assignment_output(
            normalized, solution, result_id_factory=lambda: "fixed-result"
        )
        self.assertEqual(repeated.assignment_result, repeated_again.assignment_result)

    def test_unassigned_choice_is_omitted_and_becomes_existing_flags(self) -> None:
        normalized, solution = self.solve_fixture("understaffed")
        output = build_assignment_output(
            normalized, solution, result_id_factory=lambda: "result-understaffed"
        )
        self.assertEqual(len(output.assignment_result.bed_assignments), 2)
        flag_types = [flag.type for flag in output.flags]
        self.assertIn("understaffed", flag_types)
        self.assertIn("unassigned_bed", flag_types)
        self.assertIn("no_eligible_coverage", flag_types)

    def test_corrupt_owner_relationship_is_rejected(self) -> None:
        normalized, solution = self.solve_fixture("stable-ties")
        output = build_assignment_output(
            normalized, solution, result_id_factory=lambda: "result-corrupt"
        )
        first_assignment = output.assignment_result.bed_assignments[0]
        corrupt_assignment = replace(first_assignment, nurse_id="unknown-nurse")
        corrupt_result = replace(
            output.assignment_result,
            bed_assignments=(
                corrupt_assignment,
                *output.assignment_result.bed_assignments[1:],
            ),
        )
        corrupt_output = replace(output, assignment_result=corrupt_result)

        with self.assertRaises(OptimizerOutputValidationError):
            validate_assignment_output(normalized, solution, corrupt_output)

    def test_corrupt_objective_summary_is_rejected(self) -> None:
        normalized, solution = self.solve_fixture("one-nurse")
        output = build_assignment_output(
            normalized, solution, result_id_factory=lambda: "result-objective"
        )
        corrupt_objectives = replace(
            output.objectives,
            unassigned_count=output.objectives.unassigned_count + 1,
        )
        corrupt_output = replace(output, objectives=corrupt_objectives)

        with self.assertRaises(OptimizerOutputValidationError):
            validate_assignment_output(normalized, solution, corrupt_output)


if __name__ == "__main__":
    unittest.main()
