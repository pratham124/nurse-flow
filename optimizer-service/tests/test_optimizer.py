from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from ortools.sat.python import cp_model

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fixture_helpers import build_shift_snapshot, load_fixture_catalog  # noqa: E402
from nurseflow_optimizer import normalize_shift_snapshot  # noqa: E402
from nurseflow_optimizer.assignment_model import build_assignment_model  # noqa: E402
from nurseflow_optimizer.optimizer import (  # noqa: E402
    EXPECTED_ORTOOLS_VERSION,
    OptimizerTimedOutError,
    _add_complete_fixed_search_strategy,
    _add_fixed_sum_gap_bounds,
    _add_aggregate_acuity_constraints,
    _add_aggregate_patient_count_constraints,
    _add_team_feasibility_constraints,
    _configure_solver,
    _mixed_radix_expression,
    _replace_hint_with_solution,
    _resolve_mixed_radix_room_search,
    solve_optimizer,
)
from scenario_helpers import build_synthetic_shift_snapshot  # noqa: E402


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

    def test_solver_uses_the_requested_search_worker_count(self) -> None:
        solver = _configure_solver(2)

        self.assertEqual(solver.parameters.num_search_workers, 2)
        self.assertEqual(solver.parameters.random_seed, 20260815)

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
        solution = solve_optimizer(normalized, use_fixed_canonical_search=False)
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
        first_room_stage_index = next(
            index
            for index, stage_name in enumerate(stage_names)
            if stage_name.startswith("canonical_room_team")
        )
        self.assertLess(stage_names.index("team_capacity_gap"), first_room_stage_index)
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

    def test_aggregate_acuity_propagation_constraints_are_named(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "one-nurse")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
        assignment = build_assignment_model(normalized)
        model = assignment.structure.model
        nurse_acuity_loads = {
            nurse.ordinal: model.new_int_var(0, 36, f"test_nurse_{nurse.ordinal}_acuity")
            for nurse in normalized.nurses
        }
        maximum_acuity_load = model.new_int_var(0, 36, "test_maximum_acuity")
        team_acuity_loads = [
            model.new_int_var(0, 36, f"test_team_{team_index}_acuity")
            for team_index in range(normalized.team_count)
        ]

        _add_aggregate_acuity_constraints(
            model,
            normalized,
            assignment,
            nurse_acuity_loads,
            maximum_acuity_load,
            team_acuity_loads,
        )

        constraint_names = {constraint.name for constraint in model.proto.constraints}
        self.assertIn("aggregate_acuity_conservation", constraint_names)
        self.assertIn("aggregate_nurse_acuity_capacity", constraint_names)
        self.assertIn("aggregate_team_acuity_conservation", constraint_names)
        self.assertIn("aggregate_team_0_acuity_capacity", constraint_names)

    def test_aggregate_patient_count_propagation_constraints_are_named(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "one-nurse")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
        assignment = build_assignment_model(normalized)
        model = assignment.structure.model
        nurse_patient_counts = {
            nurse.ordinal: model.new_int_var(0, 12, f"test_nurse_{nurse.ordinal}_count")
            for nurse in normalized.nurses
        }
        maximum_patient_count = model.new_int_var(0, 12, "test_maximum_count")
        team_patient_counts = [
            model.new_int_var(0, 12, f"test_team_{team_index}_count")
            for team_index in range(normalized.team_count)
        ]

        _add_aggregate_patient_count_constraints(
            model,
            normalized,
            assignment,
            nurse_patient_counts,
            maximum_patient_count,
            team_patient_counts,
        )

        constraint_names = {constraint.name for constraint in model.proto.constraints}
        self.assertIn("aggregate_patient_count_conservation", constraint_names)
        self.assertIn("aggregate_nurse_patient_capacity", constraint_names)
        self.assertIn(
            "aggregate_team_patient_count_conservation",
            constraint_names,
        )
        self.assertIn("aggregate_team_0_patient_capacity", constraint_names)

    def test_proven_solution_replaces_the_previous_model_hint(self) -> None:
        model = cp_model.CpModel()
        first = model.new_bool_var("first")
        second = model.new_bool_var("second")
        model.add(first + second == 1)
        model.add_hint(first, 1)
        model.add_hint(second, 0)
        model.minimize(first)

        solver = cp_model.CpSolver()
        solver.parameters.num_search_workers = 1
        self.assertEqual(solver.solve(model), cp_model.OPTIMAL)

        _replace_hint_with_solution(model, solver)

        hinted_values = dict(
            zip(
                model.proto.solution_hint.vars,
                model.proto.solution_hint.values,
                strict=True,
            )
        )
        self.assertEqual(hinted_values[first.index], 0)
        self.assertEqual(hinted_values[second.index], 1)
        self.assertEqual(len(hinted_values), len(model.proto.variables))

    def test_team_feasibility_constraints_are_named(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "one-nurse")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
        assignment = build_assignment_model(normalized)
        model = assignment.structure.model
        assigned_to_team = {
            (bed.ordinal, team_index): model.new_bool_var(
                f"test_bed_{bed.ordinal}_team_{team_index}"
            )
            for bed in normalized.occupied_beds
            for team_index in range(normalized.team_count)
        }
        team_patient_counts = [
            model.new_int_var(0, len(normalized.occupied_beds), "test_team_count")
        ]
        team_capacities = [
            sum(
                assignment.structure.nurse_team[(nurse.ordinal, 0)]
                * nurse.max_patient_load
                for nurse in normalized.nurses
            )
        ]

        _add_team_feasibility_constraints(
            model,
            normalized,
            assignment,
            assigned_to_team,
            team_patient_counts,
            team_capacities,
        )

        constraint_names = {constraint.name for constraint in model.proto.constraints}
        self.assertIn("team_0_configured_patient_capacity", constraint_names)
        self.assertIn("team_0_rn_red_capacity", constraint_names)

    def test_team_feasibility_cuts_preserve_fixture_decisions(self) -> None:
        for fixture in self.fixtures:
            with self.subTest(fixture=fixture["id"]):
                normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
                without_cuts = solve_optimizer(
                    normalized,
                    use_team_feasibility_cuts=False,
                )
                with_cuts = solve_optimizer(
                    normalized,
                    use_team_feasibility_cuts=True,
                )

                self.assertEqual(with_cuts.objectives, without_cuts.objectives)
                self.assertEqual(
                    decision_dict(with_cuts),
                    decision_dict(without_cuts),
                )

    def test_mixed_radix_keeps_an_earlier_room_more_important(self) -> None:
        earlier_room_is_worse = _mixed_radix_expression([1, 0, 0, 0, 0], 3)
        only_later_rooms_are_worse = _mixed_radix_expression([0, 2, 2, 2, 2], 3)

        self.assertGreater(earlier_room_is_worse, only_later_rooms_are_worse)

    def test_large_floor_room_strategy_is_selected_automatically(self) -> None:
        self.assertFalse(_resolve_mixed_radix_room_search(50, None))
        self.assertTrue(_resolve_mixed_radix_room_search(51, None))
        self.assertTrue(_resolve_mixed_radix_room_search(20, True))
        self.assertFalse(_resolve_mixed_radix_room_search(80, False))

    def test_fixed_sum_gap_bounds_expose_the_exact_equal_target(self) -> None:
        model = cp_model.CpModel()
        values = [model.new_int_var(0, 6, f"value_{index}") for index in range(3)]
        model.add(sum(values) == 6)

        _add_fixed_sum_gap_bounds(
            model,
            values,
            fixed_sum=6,
            fixed_gap=0,
            name="test_equal",
        )

        constraint_names = {constraint.name for constraint in model.proto.constraints}
        self.assertIn("test_equal_0_fixed_gap_lower", constraint_names)
        self.assertIn("test_equal_0_fixed_gap_upper", constraint_names)
        solver = _configure_solver(1)
        self.assertEqual(solver.solve(model), cp_model.OPTIMAL)
        self.assertEqual([solver.value(value) for value in values], [2, 2, 2])

    def test_complete_fixed_search_finds_the_lowest_ranked_feasible_tuple(
        self,
    ) -> None:
        model = cp_model.CpModel()
        first_rank = model.new_bool_var("first_rank")
        second_rank = model.new_bool_var("second_rank")
        derived = model.new_int_var(0, 2, "derived")
        model.add(first_rank + second_rank == 1)
        model.add(derived == first_rank + second_rank)

        _add_complete_fixed_search_strategy(model, [first_rank, second_rank])

        covered_indexes = [
            expression.vars[0]
            for strategy in model.proto.search_strategy
            for expression in strategy.exprs
        ]
        self.assertCountEqual(
            covered_indexes,
            range(len(model.proto.variables)),
        )

        solver = _configure_solver(1)
        solver.parameters.search_branching = cp_model.FIXED_SEARCH
        self.assertEqual(solver.solve(model), cp_model.OPTIMAL)
        self.assertEqual((solver.value(first_rank), solver.value(second_rank)), (0, 1))

    def test_fixed_canonical_search_preserves_every_fixture_decision(self) -> None:
        for fixture in self.fixtures:
            with self.subTest(fixture=fixture["id"]):
                normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
                staged = solve_optimizer(
                    normalized,
                    use_fixed_canonical_search=False,
                )
                fixed_search = solve_optimizer(
                    normalized,
                    use_fixed_canonical_search=True,
                    split_fixed_canonical_search=False,
                )
                split_fixed_search = solve_optimizer(
                    normalized,
                    use_fixed_canonical_search=True,
                    split_fixed_canonical_search=True,
                )
                blocked_owner_search = solve_optimizer(
                    normalized,
                    use_fixed_canonical_search=True,
                    split_fixed_canonical_search=True,
                    fixed_bed_owner_block_size=2,
                )
                hybrid_room_search = solve_optimizer(
                    normalized,
                    use_fixed_canonical_search=True,
                    split_fixed_canonical_search=True,
                    use_mixed_radix_room_search=True,
                )
                fixed_gap_bounds = solve_optimizer(
                    normalized,
                    use_fixed_gap_bounds=True,
                )
                structural_red_bound = solve_optimizer(
                    normalized,
                    use_structural_red_rank_bound=True,
                )
                mixed_radix_owners = solve_optimizer(
                    normalized,
                    use_mixed_radix_bed_owner_search=True,
                    canonical_bed_owner_chunk_size=4,
                )

                self.assertEqual(fixed_search.objectives, staged.objectives)
                self.assertEqual(
                    decision_dict(fixed_search),
                    decision_dict(staged),
                )
                self.assertEqual(split_fixed_search.objectives, staged.objectives)
                self.assertEqual(
                    decision_dict(split_fixed_search),
                    decision_dict(staged),
                )
                self.assertEqual(blocked_owner_search.objectives, staged.objectives)
                self.assertEqual(
                    decision_dict(blocked_owner_search),
                    decision_dict(staged),
                )
                self.assertEqual(hybrid_room_search.objectives, staged.objectives)
                self.assertEqual(
                    decision_dict(hybrid_room_search),
                    decision_dict(staged),
                )
                self.assertEqual(fixed_gap_bounds.objectives, staged.objectives)
                self.assertEqual(
                    decision_dict(fixed_gap_bounds),
                    decision_dict(staged),
                )
                self.assertEqual(structural_red_bound.objectives, staged.objectives)
                self.assertEqual(
                    decision_dict(structural_red_bound),
                    decision_dict(staged),
                )
                self.assertEqual(mixed_radix_owners.objectives, staged.objectives)
                self.assertEqual(
                    decision_dict(mixed_radix_owners),
                    decision_dict(staged),
                )
                self.assertEqual(
                    fixed_search.stage_trace[-1].name,
                    "canonical_fixed_search",
                )

    def test_fixed_canonical_search_matches_varied_synthetic_scenarios(self) -> None:
        scenario_shapes = (
            ([1, 2], 2, 2),
            ([1, 1, 2], 3, 2),
            ([1, 2, 3, 1], 4, 3),
            ([3, 2, 1, 2, 1], 5, 3),
        )
        for scenario_index, (room_bed_counts, nurse_count, max_load) in enumerate(
            scenario_shapes,
            start=1,
        ):
            with self.subTest(scenario=scenario_index):
                snapshot = build_synthetic_shift_snapshot(
                    scenario_id=f"fixed-search-{scenario_index}",
                    room_bed_counts=room_bed_counts,
                    nurse_count=nurse_count,
                    max_patient_load=max_load,
                )
                normalized = normalize_shift_snapshot(snapshot).model
                staged = solve_optimizer(
                    normalized,
                    use_fixed_canonical_search=False,
                )
                fixed_search = solve_optimizer(
                    normalized,
                    use_fixed_canonical_search=True,
                    split_fixed_canonical_search=False,
                )
                split_fixed_search = solve_optimizer(
                    normalized,
                    use_fixed_canonical_search=True,
                    split_fixed_canonical_search=True,
                )
                blocked_owner_search = solve_optimizer(
                    normalized,
                    use_fixed_canonical_search=True,
                    split_fixed_canonical_search=True,
                    fixed_bed_owner_block_size=2,
                )
                hybrid_room_search = solve_optimizer(
                    normalized,
                    use_fixed_canonical_search=True,
                    split_fixed_canonical_search=True,
                    use_mixed_radix_room_search=True,
                )

                self.assertEqual(fixed_search.objectives, staged.objectives)
                self.assertEqual(
                    decision_dict(fixed_search),
                    decision_dict(staged),
                )
                self.assertEqual(split_fixed_search.objectives, staged.objectives)
                self.assertEqual(
                    decision_dict(split_fixed_search),
                    decision_dict(staged),
                )
                self.assertEqual(blocked_owner_search.objectives, staged.objectives)
                self.assertEqual(
                    decision_dict(blocked_owner_search),
                    decision_dict(staged),
                )
                self.assertEqual(hybrid_room_search.objectives, staged.objectives)
                self.assertEqual(
                    decision_dict(hybrid_room_search),
                    decision_dict(staged),
                )

    def test_room_chunks_preserve_fixture_decisions(self) -> None:
        for fixture in self.fixtures:
            with self.subTest(fixture=fixture["id"]):
                normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
                one_room_at_a_time = solve_optimizer(
                    normalized,
                    canonical_room_chunk_size=1,
                    use_fixed_canonical_search=False,
                )
                five_room_chunks = solve_optimizer(
                    normalized,
                    canonical_room_chunk_size=5,
                    use_fixed_canonical_search=False,
                )

                self.assertEqual(
                    five_room_chunks.objectives,
                    one_room_at_a_time.objectives,
                )
                self.assertEqual(
                    decision_dict(five_room_chunks),
                    decision_dict(one_room_at_a_time),
                )

    def test_room_chunk_size_must_be_positive(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "one-nurse")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model

        with self.assertRaisesRegex(ValueError, "must be at least 1"):
            solve_optimizer(normalized, canonical_room_chunk_size=0)

    def test_bed_owner_chunk_size_must_be_positive(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "one-nurse")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model

        with self.assertRaisesRegex(ValueError, "must be at least 1"):
            solve_optimizer(normalized, canonical_bed_owner_chunk_size=0)

    def test_search_worker_count_must_be_positive(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "one-nurse")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model

        with self.assertRaisesRegex(ValueError, "must be at least 1"):
            solve_optimizer(normalized, search_worker_count=0)

    def test_fixed_bed_owner_block_size_must_be_positive_when_set(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "one-nurse")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model

        with self.assertRaisesRegex(ValueError, "must be at least 1"):
            solve_optimizer(normalized, fixed_bed_owner_block_size=0)

    def test_split_fixed_timeout_names_the_incomplete_pass(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "one-nurse")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model

        class FakeParameters:
            max_time_in_seconds = 0.0
            search_branching = cp_model.AUTOMATIC_SEARCH
            cp_model_presolve = True

        class FakeSolver:
            def __init__(self) -> None:
                self.parameters = FakeParameters()
                self.statuses = [cp_model.OPTIMAL] * 11 + [cp_model.UNKNOWN]
                self.objective_value = 0.0
                self.best_objective_bound = 0.0
                self.wall_time = 0.25
                self.num_branches = 84
                self.num_conflicts = 9

            def solve(self, model) -> cp_model.CpSolverStatus:
                return self.statuses.pop(0)

            def value(self, variable) -> int:
                return 0

        with patch(
            "nurseflow_optimizer.optimizer._configure_solver",
            return_value=FakeSolver(),
        ):
            with self.assertRaises(OptimizerTimedOutError) as caught:
                solve_optimizer(
                    normalized,
                    split_fixed_canonical_search=True,
                )

        self.assertEqual(caught.exception.stage, "canonical_fixed_room_search")
        diagnostics = caught.exception.diagnostics
        self.assertIsNotNone(diagnostics)
        self.assertEqual(len(diagnostics.completed_stages), 11)
        self.assertEqual(diagnostics.num_branches, 84)

    def test_expired_shared_budget_does_not_return_a_partial_candidate(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "one-nurse")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model
        with self.assertRaises(OptimizerTimedOutError) as caught:
            solve_optimizer(normalized, solve_budget_seconds=0)

        diagnostics = caught.exception.diagnostics
        self.assertIsNotNone(diagnostics)
        self.assertEqual(diagnostics.completed_stages, ())
        self.assertEqual(diagnostics.remaining_budget_at_failed_stage_ms, 0)
        self.assertIsNone(diagnostics.solver_wall_time_ms)

    def test_timeout_retains_completed_stages_and_failed_search_statistics(self) -> None:
        fixture = next(item for item in self.fixtures if item["id"] == "one-nurse")
        normalized = normalize_shift_snapshot(build_shift_snapshot(fixture)).model

        class FakeParameters:
            max_time_in_seconds = 0.0

        class FakeSolver:
            def __init__(self) -> None:
                self.parameters = FakeParameters()
                self.statuses = [cp_model.OPTIMAL, cp_model.FEASIBLE]
                self.objective_value = 4.0
                self.best_objective_bound = 3.0
                self.wall_time = 0.125
                self.num_branches = 42
                self.num_conflicts = 7

            def solve(self, model) -> cp_model.CpSolverStatus:
                return self.statuses.pop(0)

            def value(self, variable) -> int:
                return 0

        with patch(
            "nurseflow_optimizer.optimizer._configure_solver",
            return_value=FakeSolver(),
        ):
            with self.assertRaises(OptimizerTimedOutError) as caught:
                solve_optimizer(normalized)

        error = caught.exception
        diagnostics = error.diagnostics
        self.assertEqual(error.stage, "max_nurse_acuity_load")
        self.assertEqual(error.status, cp_model.FEASIBLE)
        self.assertIsNotNone(diagnostics)
        self.assertEqual(
            [stage.name for stage in diagnostics.completed_stages],
            ["unassigned_count"],
        )
        self.assertEqual(diagnostics.num_branches, 42)
        self.assertEqual(diagnostics.num_conflicts, 7)
        self.assertEqual(diagnostics.solver_wall_time_ms, 125)
        self.assertEqual(diagnostics.objective_value, 4)
        self.assertEqual(diagnostics.best_objective_bound, 3)


if __name__ == "__main__":
    unittest.main()
