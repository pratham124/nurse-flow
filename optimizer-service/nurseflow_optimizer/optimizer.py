"""Exact staged CP-SAT optimization for the NurseFlow assignment contract."""

from __future__ import annotations

import time
from collections.abc import Sequence
from dataclasses import dataclass

import ortools
from ortools.sat.python import cp_model

from .assignment_model import (
    AssignmentModel,
    BedOwnerDecision,
    build_assignment_model,
    read_bed_owner_decisions,
)
from .models import NormalizedOccupiedBed, NormalizedOptimizerInput
from .search_hint import add_deterministic_start_hint
from .team_coverage_model import (
    TeamCoverageDecision,
    build_team_coverage_model,
    read_team_coverage_decision,
)

EXPECTED_ORTOOLS_VERSION = "9.15.6755"
SOLVER_RANDOM_SEED = 20260815
DEFAULT_SOLVE_BUDGET_SECONDS = 120.0
DEFAULT_CANONICAL_ROOM_CHUNK_SIZE = 5
DEFAULT_CANONICAL_BED_OWNER_CHUNK_SIZE = 6
MIXED_RADIX_ROOM_SEARCH_BED_THRESHOLD = 50
ACUITY_WEIGHT_BY_NAME = {"green": 1, "yellow": 2, "red": 3}
RED_OWNER_RANK = {"experienced": 0, "mid": 1, "new_grad": 2}


@dataclass(frozen=True)
class ObjectiveStage:
    """One completed optimization stage and its proven best value."""

    name: str
    value: int
    duration_ms: float


@dataclass(frozen=True)
class SolveFailureDiagnostics:
    """Private timing and search evidence retained when an exact stage fails."""

    solve_budget_ms: float
    elapsed_before_failed_stage_ms: float
    remaining_budget_at_failed_stage_ms: float
    failed_stage_duration_ms: float
    total_elapsed_ms: float
    completed_stages: tuple[ObjectiveStage, ...]
    solver_wall_time_ms: float | None
    num_branches: int | None
    num_conflicts: int | None
    objective_value: float | None
    best_objective_bound: float | None

    def to_dict(self, *, include_decision_ids: bool = True) -> dict[str, object]:
        """Return JSON-safe diagnostics, optionally removing entity IDs."""

        def safe_stage_name(name: str) -> str:
            return name if include_decision_ids else name.split(":", 1)[0]

        return {
            "solveBudgetMs": round(self.solve_budget_ms, 3),
            "elapsedBeforeFailedStageMs": round(
                self.elapsed_before_failed_stage_ms,
                3,
            ),
            "remainingBudgetAtFailedStageMs": round(
                self.remaining_budget_at_failed_stage_ms,
                3,
            ),
            "failedStageDurationMs": round(self.failed_stage_duration_ms, 3),
            "totalElapsedMs": round(self.total_elapsed_ms, 3),
            "completedStages": [
                {
                    "name": safe_stage_name(stage.name),
                    "value": stage.value,
                    "durationMs": round(stage.duration_ms, 3),
                }
                for stage in self.completed_stages
            ],
            "solverWallTimeMs": (
                round(self.solver_wall_time_ms, 3)
                if self.solver_wall_time_ms is not None
                else None
            ),
            "numBranches": self.num_branches,
            "numConflicts": self.num_conflicts,
            "objectiveValue": self.objective_value,
            "bestObjectiveBound": self.best_objective_bound,
        }


@dataclass(frozen=True)
class ObjectiveSummary:
    """Clinical and balancing objective values for the final solution."""

    unassigned_count: int
    max_nurse_acuity_load: int
    max_nurse_patient_count: int
    red_bed_owner_rank_sum: int
    side_guidance_total_excess: int
    side_guidance_nurse_count: int
    team_weighted_acuity_gap: int
    team_patient_count_gap: int
    team_rn_count_gap: int
    team_experience_distribution_gap: int
    team_capacity_gap: int

    def to_fixture_dict(self) -> dict[str, int]:
        return {
            "unassignedCount": self.unassigned_count,
            "maxNurseAcuityLoad": self.max_nurse_acuity_load,
            "maxNursePatientCount": self.max_nurse_patient_count,
            "redBedOwnerRankSum": self.red_bed_owner_rank_sum,
            "sideGuidanceTotalExcess": self.side_guidance_total_excess,
            "sideGuidanceNurseCount": self.side_guidance_nurse_count,
            "teamWeightedAcuityGap": self.team_weighted_acuity_gap,
            "teamPatientCountGap": self.team_patient_count_gap,
            "teamRnCountGap": self.team_rn_count_gap,
            "teamExperienceDistributionGap": self.team_experience_distribution_gap,
            "teamCapacityGap": self.team_capacity_gap,
        }


@dataclass(frozen=True)
class OptimizerSolution:
    """Canonical solver decisions plus objective and debugging information."""

    team_coverage: TeamCoverageDecision
    bed_owners: tuple[BedOwnerDecision, ...]
    objectives: ObjectiveSummary
    stage_trace: tuple[ObjectiveStage, ...]


class OptimizerSolveError(RuntimeError):
    """Raised when a stage cannot produce a proven optimal result."""

    def __init__(
        self,
        stage: str,
        status: cp_model.CpSolverStatus,
        diagnostics: SolveFailureDiagnostics | None = None,
    ) -> None:
        self.stage = stage
        self.status = status
        self.diagnostics = diagnostics
        super().__init__(f"{stage} returned {status.name}")


class OptimizerTimedOutError(OptimizerSolveError):
    pass


def _new_gap(
    model: cp_model.CpModel,
    values: Sequence[cp_model.LinearExprT],
    upper_bound: int,
    name: str,
) -> cp_model.IntVar:
    """Create a variable equal to the largest team value minus the smallest."""

    maximum = model.new_int_var(0, upper_bound, f"{name}_max")
    minimum = model.new_int_var(0, upper_bound, f"{name}_min")
    gap = model.new_int_var(0, upper_bound, f"{name}_gap")
    model.add_max_equality(maximum, values)
    model.add_min_equality(minimum, values)
    model.add(gap == maximum - minimum)
    return gap


def _add_aggregate_acuity_constraints(
    model: cp_model.CpModel,
    input_model: NormalizedOptimizerInput,
    assignment: AssignmentModel,
    nurse_acuity_loads: dict[int, cp_model.IntVar],
    maximum_acuity_load: cp_model.IntVar,
    team_acuity_loads: list[cp_model.LinearExprT],
) -> None:
    """State implied acuity totals directly to strengthen solver propagation."""

    total_floor_acuity = sum(
        bed.acuity_weight for bed in input_model.occupied_beds
    )
    assigned_nurse_acuity = sum(nurse_acuity_loads.values())
    unassigned_acuity = sum(
        bed.acuity_weight * assignment.bed_unassigned[bed.ordinal]
        for bed in input_model.occupied_beds
    )

    # The ownership constraints already imply this conservation equation, but
    # stating it directly lets a tight maximum immediately restrict which
    # acuity values may remain unassigned.
    model.add(
        assigned_nurse_acuity + unassigned_acuity == total_floor_acuity
    ).with_name("aggregate_acuity_conservation")

    # If every nurse is capped by the same maximum variable, their combined
    # assigned acuity cannot exceed nurse_count * maximum. This direct bound is
    # especially useful when the objective tests two adjacent values such as 7
    # and 8.
    model.add(
        assigned_nurse_acuity
        <= len(input_model.nurses) * maximum_acuity_load
    ).with_name("aggregate_nurse_acuity_capacity")

    # Team expressions and nurse expressions describe the same assigned beds.
    # Linking them directly avoids making CP-SAT rediscover that equality
    # through each bed-owner and room-team decision.
    model.add(sum(team_acuity_loads) == assigned_nurse_acuity).with_name(
        "aggregate_team_acuity_conservation"
    )

    maximum_team_size = (
        len(input_model.nurses) + input_model.team_count - 1
    ) // input_model.team_count
    for team_index, team_acuity_load in enumerate(team_acuity_loads):
        model.add(
            team_acuity_load <= maximum_team_size * maximum_acuity_load
        ).with_name(f"aggregate_team_{team_index}_acuity_capacity")


def _add_aggregate_patient_count_constraints(
    model: cp_model.CpModel,
    input_model: NormalizedOptimizerInput,
    assignment: AssignmentModel,
    nurse_patient_counts: dict[int, cp_model.IntVar],
    maximum_patient_count: cp_model.IntVar,
    team_patient_counts: list[cp_model.LinearExprT],
) -> None:
    """State implied patient totals directly to strengthen propagation."""

    assigned_nurse_count = sum(nurse_patient_counts.values())
    unassigned_count = sum(assignment.bed_unassigned.values())

    model.add(
        assigned_nurse_count + unassigned_count
        == len(input_model.occupied_beds)
    ).with_name("aggregate_patient_count_conservation")

    model.add(
        assigned_nurse_count
        <= len(input_model.nurses) * maximum_patient_count
    ).with_name("aggregate_nurse_patient_capacity")

    model.add(sum(team_patient_counts) == assigned_nurse_count).with_name(
        "aggregate_team_patient_count_conservation"
    )

    maximum_team_size = (
        len(input_model.nurses) + input_model.team_count - 1
    ) // input_model.team_count
    for team_index, team_patient_count in enumerate(team_patient_counts):
        model.add(
            team_patient_count <= maximum_team_size * maximum_patient_count
        ).with_name(f"aggregate_team_{team_index}_patient_capacity")


def _add_team_feasibility_constraints(
    model: cp_model.CpModel,
    input_model: NormalizedOptimizerInput,
    assignment: AssignmentModel,
    assigned_to_team: dict[tuple[int, int], cp_model.IntVar],
    team_patient_counts: list[cp_model.LinearExprT],
    team_capacities: list[cp_model.LinearExprT],
) -> None:
    """State implied team census and RN/red capacity limits directly."""

    structure = assignment.structure
    red_beds = [bed for bed in input_model.occupied_beds if bed.acuity == "red"]
    rn_nurses = [
        nurse for nurse in input_model.nurses if nurse.license_type == "RN"
    ]

    for team_index in range(input_model.team_count):
        model.add(
            team_patient_counts[team_index] <= team_capacities[team_index]
        ).with_name(f"team_{team_index}_configured_patient_capacity")

        assigned_red_count = sum(
            assigned_to_team[(bed.ordinal, team_index)] for bed in red_beds
        )
        rn_patient_capacity = sum(
            structure.nurse_team[(nurse.ordinal, team_index)]
            * nurse.max_patient_load
            for nurse in rn_nurses
        )
        model.add(assigned_red_count <= rn_patient_capacity).with_name(
            f"team_{team_index}_rn_red_capacity"
        )


def _configure_solver(search_worker_count: int) -> cp_model.CpSolver:
    """Create a seeded solver with the requested internal search concurrency."""

    solver = cp_model.CpSolver()
    solver.parameters.num_search_workers = search_worker_count
    solver.parameters.random_seed = SOLVER_RANDOM_SEED
    return solver


def _replace_hint_with_solution(
    model: cp_model.CpModel,
    solver: cp_model.CpSolver,
) -> None:
    """Use the last proven solution as the complete next-stage hint."""

    model.clear_hints()
    for variable_index in range(len(model.proto.variables)):
        variable = model.get_int_var_from_proto_index(variable_index)
        model.add_hint(variable, solver.value(variable))


def _mixed_radix_expression(
    values: list[cp_model.LinearExprT | int],
    radix: int,
) -> cp_model.LinearExprT | int:
    """Encode bounded ordered values as one exact lexicographic expression."""

    if radix < 2:
        raise ValueError("mixed-radix expressions require a radix of at least 2")

    expression: cp_model.LinearExprT | int = 0
    for value in values:
        expression = expression * radix + value
    return expression


def _add_fixed_sum_gap_bounds(
    model: cp_model.CpModel,
    values: list[cp_model.LinearExprT],
    *,
    fixed_sum: int,
    fixed_gap: int,
    name: str,
) -> None:
    """Expose exact per-value bounds implied by a fixed sum and max-min gap."""

    value_count = len(values)
    if value_count < 1:
        raise ValueError("fixed sum-gap bounds require at least one value")
    lower_numerator = fixed_sum - (value_count - 1) * fixed_gap
    lower_bound = max(0, -(-lower_numerator // value_count))
    upper_bound = (fixed_sum + (value_count - 1) * fixed_gap) // value_count
    for value_index, value in enumerate(values):
        model.add(value >= lower_bound).with_name(
            f"{name}_{value_index}_fixed_gap_lower"
        )
        model.add(value <= upper_bound).with_name(
            f"{name}_{value_index}_fixed_gap_upper"
        )


def _add_complete_fixed_search_strategy(
    model: cp_model.CpModel,
    canonical_rank_variables: list[cp_model.IntVar],
) -> None:
    """Search canonical ranks first, then cover every remaining model variable."""

    if not canonical_rank_variables:
        raise ValueError("fixed canonical search requires at least one rank variable")

    canonical_indexes = {variable.index for variable in canonical_rank_variables}
    if len(canonical_indexes) != len(canonical_rank_variables):
        raise ValueError("fixed canonical search rank variables must be unique")

    model.add_decision_strategy(
        canonical_rank_variables,
        cp_model.CHOOSE_FIRST,
        cp_model.SELECT_MIN_VALUE,
    )
    remaining_variables = [
        model.get_int_var_from_proto_index(variable_index)
        for variable_index in range(len(model.proto.variables))
        if variable_index not in canonical_indexes
    ]
    if remaining_variables:
        model.add_decision_strategy(
            remaining_variables,
            cp_model.CHOOSE_FIRST,
            cp_model.SELECT_MIN_VALUE,
        )


def _resolve_mixed_radix_room_search(
    occupied_bed_count: int,
    requested: bool | None,
) -> bool:
    """Use the measured large-floor room strategy unless explicitly overridden."""

    if requested is not None:
        return requested
    return occupied_bed_count > MIXED_RADIX_ROOM_SEARCH_BED_THRESHOLD


def _build_structural_red_rank_lower_bound_model(
    input_model: NormalizedOptimizerInput,
    *,
    fixed_maximum_acuity_load: int,
    fixed_maximum_patient_count: int,
) -> tuple[cp_model.CpModel, cp_model.LinearExprT | int]:
    """Build a structural relaxation whose optimum lower-bounds red-owner rank."""

    structure = build_team_coverage_model(input_model)
    model = structure.model
    beds_by_room_id: dict[str, list[NormalizedOccupiedBed]] = {}
    for bed in input_model.occupied_beds:
        beds_by_room_id.setdefault(bed.room_id, []).append(bed)

    rank_floor_terms: list[cp_model.IntVar] = []
    aggregate_red_rank_terms: list[cp_model.LinearExprT] = []
    for team_index in range(input_model.team_count):
        team_size = sum(
            structure.nurse_team[(nurse.ordinal, team_index)]
            for nurse in input_model.nurses
        )
        team_patient_count = sum(
            len(beds_by_room_id.get(room.id, ()))
            * structure.room_team[(room.ordinal, team_index)]
            for room in input_model.rooms
            if room.id in beds_by_room_id
        )
        team_green_count = sum(
            sum(
                bed.acuity == "green"
                for bed in beds_by_room_id.get(room.id, ())
            )
            * structure.room_team[(room.ordinal, team_index)]
            for room in input_model.rooms
            if room.id in beds_by_room_id
        )
        team_yellow_count = sum(
            sum(
                bed.acuity == "yellow"
                for bed in beds_by_room_id.get(room.id, ())
            )
            * structure.room_team[(room.ordinal, team_index)]
            for room in input_model.rooms
            if room.id in beds_by_room_id
        )
        team_acuity_load = sum(
            sum(bed.acuity_weight for bed in beds_by_room_id.get(room.id, ()))
            * structure.room_team[(room.ordinal, team_index)]
            for room in input_model.rooms
            if room.id in beds_by_room_id
        )
        team_red_count = sum(
            sum(bed.acuity == "red" for bed in beds_by_room_id.get(room.id, ()))
            * structure.room_team[(room.ordinal, team_index)]
            for room in input_model.rooms
            if room.id in beds_by_room_id
        )
        model.add(
            team_patient_count <= fixed_maximum_patient_count * team_size
        )
        model.add(team_acuity_load <= fixed_maximum_acuity_load * team_size)

        experienced_count = sum(
            structure.nurse_team[(nurse.ordinal, team_index)]
            for nurse in input_model.nurses
            if nurse.license_type == "RN"
            and nurse.experience_level == "experienced"
        )
        mid_count = sum(
            structure.nurse_team[(nurse.ordinal, team_index)]
            for nurse in input_model.nurses
            if nurse.license_type == "RN" and nurse.experience_level == "mid"
        )
        rn_count = sum(
            structure.nurse_team[(nurse.ordinal, team_index)]
            for nurse in input_model.nurses
            if nurse.license_type == "RN"
        )
        lpn_count = team_size - rn_count
        red_capacity_per_nurse = fixed_maximum_acuity_load // 3
        model.add(team_red_count <= red_capacity_per_nurse * rn_count)

        nurse_allocations_by_acuity: dict[str, list[cp_model.IntVar]] = {
            "green": [],
            "yellow": [],
            "red": [],
        }
        for nurse in input_model.nurses:
            nurse_is_on_team = structure.nurse_team[
                (nurse.ordinal, team_index)
            ]
            nurse_allocations: dict[str, cp_model.IntVar] = {}
            for acuity in ("green", "yellow", "red"):
                if acuity == "red" and nurse.license_type != "RN":
                    continue
                allocation = model.new_int_var(
                    0,
                    len(input_model.occupied_beds),
                    (
                        f"structural_team_{team_index}_nurse_{nurse.ordinal}_"
                        f"{acuity}_count"
                    ),
                )
                nurse_allocations[acuity] = allocation
                nurse_allocations_by_acuity[acuity].append(allocation)
            model.add(
                sum(nurse_allocations.values())
                <= min(nurse.max_patient_load, fixed_maximum_patient_count)
                * nurse_is_on_team
            )
            model.add(
                sum(
                    ACUITY_WEIGHT_BY_NAME[acuity] * allocation
                    for acuity, allocation in nurse_allocations.items()
                )
                <= fixed_maximum_acuity_load * nurse_is_on_team
            )
            red_allocation = nurse_allocations.get("red")
            if red_allocation is not None:
                aggregate_red_rank_terms.append(
                    RED_OWNER_RANK[nurse.experience_level] * red_allocation
                )

        model.add(sum(nurse_allocations_by_acuity["green"]) == team_green_count)
        model.add(
            sum(nurse_allocations_by_acuity["yellow"]) == team_yellow_count
        )
        model.add(sum(nurse_allocations_by_acuity["red"]) == team_red_count)

        # RNs must absorb any census that the team's LPNs cannot. After all red
        # beds, their cheapest possible remaining patients are green first and
        # yellow second. If even that minimum acuity exceeds RN capacity, the
        # structural team choice cannot extend to a real bed-owner assignment.
        rn_nonred_patient_floor = model.new_int_var(
            0,
            len(input_model.occupied_beds),
            f"structural_team_{team_index}_rn_nonred_patient_floor",
        )
        rn_yellow_patient_floor = model.new_int_var(
            0,
            len(input_model.occupied_beds),
            f"structural_team_{team_index}_rn_yellow_patient_floor",
        )
        model.add(
            rn_nonred_patient_floor
            >= team_patient_count
            - fixed_maximum_patient_count * lpn_count
            - team_red_count
        )
        model.add(rn_yellow_patient_floor >= rn_nonred_patient_floor - team_green_count)
        model.add(
            3 * team_red_count
            + rn_nonred_patient_floor
            + rn_yellow_patient_floor
            <= fixed_maximum_acuity_load * rn_count
        )

        for rank_level, ranked_count in (
            ("experienced", experienced_count),
            ("mid", experienced_count + mid_count),
        ):
            beyond_rank = model.new_int_var(
                0,
                len(input_model.occupied_beds),
                f"structural_team_{team_index}_red_beyond_{rank_level}",
            )
            model.add(
                beyond_rank
                >= team_red_count - red_capacity_per_nurse * ranked_count
            )
            model.add(beyond_rank <= team_red_count)
            model.add(
                2 * beyond_rank
                >= 2 * team_red_count
                - (
                    fixed_maximum_acuity_load * ranked_count
                    + fixed_maximum_patient_count * (team_size - ranked_count)
                    - team_patient_count
                )
            )
            ranked_nonred_patient_floor = model.new_int_var(
                0,
                len(input_model.occupied_beds),
                (
                    f"structural_team_{team_index}_{rank_level}_"
                    "nonred_patient_floor"
                ),
            )
            ranked_yellow_patient_floor = model.new_int_var(
                0,
                len(input_model.occupied_beds),
                (
                    f"structural_team_{team_index}_{rank_level}_"
                    "yellow_patient_floor"
                ),
            )
            model.add(
                ranked_nonred_patient_floor
                >= team_patient_count
                - fixed_maximum_patient_count * (team_size - ranked_count)
                - team_red_count
                + beyond_rank
            )
            model.add(
                ranked_yellow_patient_floor
                >= ranked_nonred_patient_floor - team_green_count
            )
            model.add(
                3 * (team_red_count - beyond_rank)
                + ranked_nonred_patient_floor
                + ranked_yellow_patient_floor
                <= fixed_maximum_acuity_load * ranked_count
            )
            rank_floor_terms.append(beyond_rank)

    structural_lower_bound = sum(aggregate_red_rank_terms)
    model.add(structural_lower_bound >= sum(rank_floor_terms))
    model.minimize(structural_lower_bound)
    return model, structural_lower_bound


def solve_optimizer(
    input_model: NormalizedOptimizerInput,
    *,
    solve_budget_seconds: float = DEFAULT_SOLVE_BUDGET_SECONDS,
    use_rolling_stage_hints: bool = True,
    canonical_room_chunk_size: int = DEFAULT_CANONICAL_ROOM_CHUNK_SIZE,
    canonical_bed_owner_chunk_size: int = DEFAULT_CANONICAL_BED_OWNER_CHUNK_SIZE,
    use_team_feasibility_cuts: bool = True,
    search_worker_count: int = 1,
    use_fixed_canonical_search: bool = True,
    split_fixed_canonical_search: bool = True,
    fixed_bed_owner_block_size: int | None = None,
    use_mixed_radix_room_search: bool | None = None,
    use_fixed_gap_bounds: bool = False,
    use_structural_red_rank_bound: bool | None = None,
    use_mixed_radix_bed_owner_search: bool | None = None,
) -> OptimizerSolution:
    """Solve every frozen objective exactly and return canonical decisions."""

    if canonical_room_chunk_size < 1:
        raise ValueError("canonical_room_chunk_size must be at least 1")
    if canonical_bed_owner_chunk_size < 1:
        raise ValueError("canonical_bed_owner_chunk_size must be at least 1")
    if search_worker_count < 1:
        raise ValueError("search_worker_count must be at least 1")
    if fixed_bed_owner_block_size is not None and fixed_bed_owner_block_size < 1:
        raise ValueError("fixed_bed_owner_block_size must be at least 1")
    if ortools.__version__ != EXPECTED_ORTOOLS_VERSION:
        raise RuntimeError(
            f"Expected OR-Tools {EXPECTED_ORTOOLS_VERSION}, found {ortools.__version__}"
        )

    # Build all hard constraints before adding any preferences. Every solution
    # considered below already obeys licensing, capacity, and coverage rules.
    assignment = build_assignment_model(input_model)
    hinted_owner_by_bed_ordinal = add_deterministic_start_hint(
        input_model,
        assignment,
    )
    structure = assignment.structure
    model = structure.model
    solver = _configure_solver(search_worker_count)
    mixed_radix_room_search_enabled = _resolve_mixed_radix_room_search(
        len(input_model.occupied_beds),
        use_mixed_radix_room_search,
    )
    structural_red_rank_bound_enabled = (
        use_structural_red_rank_bound
        if use_structural_red_rank_bound is not None
        else len(input_model.occupied_beds)
        > MIXED_RADIX_ROOM_SEARCH_BED_THRESHOLD
    )
    started_at = time.monotonic()
    stage_trace: list[ObjectiveStage] = []

    def minimize_and_fix(name: str, expression: cp_model.LinearExprT | int) -> int:
        """Prove one objective's minimum, then freeze it for later stages."""

        # All stages share one wall-clock budget. A later stage receives only
        # the time not already spent proving earlier, higher-priority results.
        elapsed_before_stage = time.monotonic() - started_at
        remaining = solve_budget_seconds - elapsed_before_stage
        if remaining <= 0:
            diagnostics = SolveFailureDiagnostics(
                solve_budget_ms=solve_budget_seconds * 1000,
                elapsed_before_failed_stage_ms=elapsed_before_stage * 1000,
                remaining_budget_at_failed_stage_ms=0,
                failed_stage_duration_ms=0,
                total_elapsed_ms=(time.monotonic() - started_at) * 1000,
                completed_stages=tuple(stage_trace),
                solver_wall_time_ms=None,
                num_branches=None,
                num_conflicts=None,
                objective_value=None,
                best_objective_bound=None,
            )
            raise OptimizerTimedOutError(name, cp_model.UNKNOWN, diagnostics)
        solver.parameters.max_time_in_seconds = remaining

        # CP-SAT optimizes one expression at a time. The previous stage has
        # already become a hard equality, so replacing the objective is safe.
        model.clear_objective()
        model.minimize(expression)
        stage_started_at = time.monotonic()
        status = solver.solve(model)
        stage_duration_ms = (time.monotonic() - stage_started_at) * 1000
        if status != cp_model.OPTIMAL:
            diagnostics = SolveFailureDiagnostics(
                solve_budget_ms=solve_budget_seconds * 1000,
                elapsed_before_failed_stage_ms=elapsed_before_stage * 1000,
                remaining_budget_at_failed_stage_ms=remaining * 1000,
                failed_stage_duration_ms=stage_duration_ms,
                total_elapsed_ms=(time.monotonic() - started_at) * 1000,
                completed_stages=tuple(stage_trace),
                solver_wall_time_ms=solver.wall_time * 1000,
                num_branches=solver.num_branches,
                num_conflicts=solver.num_conflicts,
                objective_value=(
                    solver.objective_value if status == cp_model.FEASIBLE else None
                ),
                best_objective_bound=solver.best_objective_bound,
            )
            error_type = (
                OptimizerTimedOutError
                if status in {cp_model.FEASIBLE, cp_model.UNKNOWN}
                else OptimizerSolveError
            )
            raise error_type(name, status, diagnostics)
        value = int(round(solver.objective_value))

        # This equality creates strict priority: no later preference may make
        # an earlier result worse, even if doing so improves several later ones.
        model.add(expression == value)
        stage_trace.append(
            ObjectiveStage(
                name=name,
                value=value,
                duration_ms=stage_duration_ms,
            )
        )
        if use_rolling_stage_hints:
            # The just-proven solution satisfies the new objective equality.
            # Reusing every variable value gives the next stage a valid
            # incumbent that also preserves every earlier lexicographic result.
            _replace_hint_with_solution(model, solver)
        return value

    # ------------------------------------------------------------------
    # Constraint group 1: summarize each nurse's patient count and acuity.
    # ------------------------------------------------------------------
    nurse_patient_counts: dict[int, cp_model.IntVar] = {}
    nurse_acuity_loads: dict[int, cp_model.IntVar] = {}
    for nurse in input_model.nurses:
        # This named variable will equal the number of beds owned by this nurse.
        # Its upper bound is the nurse's already-validated hard patient maximum.
        patient_count = model.new_int_var(
            0, nurse.max_patient_load, f"nurse_{nurse.ordinal}_patient_count"
        )

        # Acuity weights range from 1 (green) to 3 (red). The largest possible
        # load is therefore the nurse's maximum patient count multiplied by 3.
        acuity_load = model.new_int_var(
            0, nurse.max_patient_load * 3, f"nurse_{nurse.ordinal}_acuity_load"
        )

        # Store the named summary variables by nurse ordinal so later objectives
        # can compare all nurses without rebuilding these expressions.
        nurse_patient_counts[nurse.ordinal] = patient_count
        nurse_acuity_loads[nurse.ordinal] = acuity_load

        # Gather only this nurse's bed-owner decisions. Each owner choice will
        # eventually be 1 when the nurse owns that bed or 0 when they do not.
        nurse_owner_choices: list[cp_model.IntVar] = []
        nurse_weighted_choices: list[cp_model.LinearExprT] = []
        for (bed_ordinal, nurse_ordinal), owner_choice in assignment.bed_nurse.items():
            if nurse_ordinal != nurse.ordinal:
                continue

            nurse_owner_choices.append(owner_choice)

            # Multiplication makes this term either the bed's acuity weight
            # (owner choice 1) or zero (owner choice 0).
            bed_acuity_weight = input_model.occupied_beds[bed_ordinal].acuity_weight
            nurse_weighted_choices.append(owner_choice * bed_acuity_weight)

        # Constraint: tie the named summary variables to the ownership decisions.
        # Before the
        # solve these are symbolic equalities; afterward they become real totals.
        model.add(patient_count == sum(nurse_owner_choices))
        model.add(acuity_load == sum(nurse_weighted_choices))
        hinted_beds = [
            bed
            for bed in input_model.occupied_beds
            if hinted_owner_by_bed_ordinal.get(bed.ordinal) == nurse.ordinal
        ]
        model.add_hint(patient_count, len(hinted_beds))
        model.add_hint(
            acuity_load,
            sum(bed.acuity_weight for bed in hinted_beds),
        )

    # Constraint group 2: identify the busiest nurse across the whole shift. The
    # service ceilings are 12 patients and 12 red-acuity weights (12 * 3 = 36).
    maximum_acuity_load = model.new_int_var(0, 36, "maximum_nurse_acuity_load")
    maximum_patient_count = model.new_int_var(0, 12, "maximum_nurse_patient_count")

    # OR-Tools sets each maximum variable equal to the largest corresponding
    # per-nurse value. Later objectives minimize these two worst-case workloads.
    model.add_max_equality(maximum_acuity_load, list(nurse_acuity_loads.values()))
    model.add_max_equality(maximum_patient_count, list(nurse_patient_counts.values()))
    hinted_counts = [
        sum(
            hinted_owner_by_bed_ordinal.get(bed.ordinal) == nurse.ordinal
            for bed in input_model.occupied_beds
        )
        for nurse in input_model.nurses
    ]
    hinted_acuity_loads = [
        sum(
            bed.acuity_weight
            for bed in input_model.occupied_beds
            if hinted_owner_by_bed_ordinal.get(bed.ordinal) == nurse.ordinal
        )
        for nurse in input_model.nurses
    ]
    model.add_hint(maximum_patient_count, max(hinted_counts, default=0))
    model.add_hint(maximum_acuity_load, max(hinted_acuity_loads, default=0))

    # ------------------------------------------------------------------
    # Objective input 3: prepare red-bed owner ranking terms. Lower rank is
    # better: experienced 0, mid 1, new grad 2, and unassigned 3.
    # ------------------------------------------------------------------
    # For red beds, lower rank is better: experienced 0, mid 1, new grad 2,
    # and unassigned 3. The earlier unassigned objective still has priority.
    red_rank_terms = []
    for bed in input_model.occupied_beds:
        if bed.acuity != "red":
            continue
        for nurse in input_model.nurses:
            variable = assignment.bed_nurse.get((bed.ordinal, nurse.ordinal))
            if variable is not None:
                red_rank_terms.append(variable * RED_OWNER_RANK[nurse.experience_level])
        red_rank_terms.append(assignment.bed_unassigned[bed.ordinal] * 3)
    red_owner_rank_sum = sum(red_rank_terms)

    # ------------------------------------------------------------------
    # Constraint group 4: detect teams that cover admitting-side rooms.
    # Nurses on
    # those teams use the admitting guidance maximum; everyone else uses the
    # non-admitting maximum. These are preferences, not hard capacity limits.
    occupied_room_ids = {bed.room_id for bed in input_model.occupied_beds}

    # Keep only rooms that both contain a patient and belong to the admitting
    # doctor side. Empty admitting rooms do not affect nurse workload guidance.
    admitting_rooms = []
    for room in input_model.rooms:
        room_is_occupied = room.id in occupied_room_ids
        room_is_on_admitting_side = (
            room.doctor_side_id == input_model.admitting_doctor_side_id
        )
        if room_is_occupied and room_is_on_admitting_side:
            admitting_rooms.append(room)

    # Store one yes/no result per team. A solved value of 1 means that team
    # covers at least one occupied admitting-side room.
    team_covers_admitting: dict[int, cp_model.IntVar] = {}
    for team_index in range(input_model.team_count):
        covers_admitting = model.new_bool_var(f"team_{team_index}_covers_admitting")
        team_covers_admitting[team_index] = covers_admitting

        # Collect this team's yes/no coverage decision for every admitting room.
        admitting_room_choices: list[cp_model.IntVar] = []
        for room in admitting_rooms:
            room_team_key = (room.ordinal, team_index)
            room_is_covered_by_team = structure.room_team[room_team_key]
            admitting_room_choices.append(room_is_covered_by_team)

        if admitting_room_choices:
            # For 0/1 variables, the maximum behaves like logical OR:
            # all zeros -> 0; at least one 1 -> 1.
            model.add_max_equality(covers_admitting, admitting_room_choices)
        else:
            # No occupied admitting rooms means no team covers admitting work.
            model.add(covers_admitting == 0)

    # ------------------------------------------------------------------
    # Constraint group 5: connect each nurse to admitting-side guidance.
    # These two dictionaries feed the later objectives: first minimize how far
    # all nurses exceed guidance, then minimize how many nurses exceed it at all.
    nurse_guidance_excess: dict[int, cp_model.IntVar] = {}
    nurse_above_guidance: dict[int, cp_model.IntVar] = {}
    for nurse in input_model.nurses:
        # Build one logical AND for each possible team:
        # nurse_is_on_team AND team_is_on_admitting.
        nurse_team_admitting_matches: list[cp_model.IntVar] = []
        for team_index in range(input_model.team_count):
            nurse_team_covers_admitting = model.new_bool_var(
                f"nurse_{nurse.ordinal}_team_{team_index}_on_admitting"
            )
            nurse_is_on_team = structure.nurse_team[(nurse.ordinal, team_index)]
            team_is_on_admitting = team_covers_admitting[team_index]

            # These three inequalities implement the AND. The result can be 1
            # only when both inputs are 1, and must be 1 when both inputs are 1.
            model.add(nurse_team_covers_admitting <= nurse_is_on_team)
            model.add(nurse_team_covers_admitting <= team_is_on_admitting)
            model.add(
                nurse_team_covers_admitting
                >= nurse_is_on_team + team_is_on_admitting - 1
            )
            nurse_team_admitting_matches.append(nurse_team_covers_admitting)

        # Each nurse belongs to exactly one team, so at most one match above can
        # be 1. Their sum therefore becomes a single yes/no admitting indicator.
        covers_admitting = model.new_bool_var(f"nurse_{nurse.ordinal}_on_admitting")
        model.add(covers_admitting == sum(nurse_team_admitting_matches))

        # Select the guidance maximum with one expression:
        # covers_admitting = 0 -> non-admitting maximum
        # covers_admitting = 1 -> admitting maximum
        applicable_maximum = (
            input_model.non_admitting_load_limit.maximum
            + covers_admitting
            * (
                input_model.admitting_load_limit.maximum
                - input_model.non_admitting_load_limit.maximum
            )
        )

        # Guidance excess is never negative. It equals the nurse's patient count
        # minus the applicable maximum, or zero when the nurse is within guidance.
        guidance_excess = model.new_int_var(
            0, nurse.max_patient_load, f"nurse_{nurse.ordinal}_guidance_excess"
        )
        model.add_max_equality(
            guidance_excess,
            [nurse_patient_counts[nurse.ordinal] - applicable_maximum, 0],
        )

        # Convert the numeric excess into a second yes/no variable. If it is 1,
        # excess must be positive; if it is 0, excess must be exactly zero.
        is_above_guidance = model.new_bool_var(
            f"nurse_{nurse.ordinal}_above_guidance"
        )
        model.add(guidance_excess >= 1).only_enforce_if(is_above_guidance)
        model.add(guidance_excess == 0).only_enforce_if(
            is_above_guidance.negated()
        )
        nurse_guidance_excess[nurse.ordinal] = guidance_excess
        nurse_above_guidance[nurse.ordinal] = is_above_guidance

    # ------------------------------------------------------------------
    # Constraint group 6: connect assigned beds to the team covering their room.
    # Unassigned beds
    # contribute to neither team's workload totals.
    assigned_to_team: dict[tuple[int, int], cp_model.IntVar] = {}
    room_by_id = {room.id: room for room in input_model.rooms}
    for bed in input_model.occupied_beds:
        assigned = 1 - assignment.bed_unassigned[bed.ordinal]
        room = room_by_id[bed.room_id]
        for team_index in range(input_model.team_count):
            assigned_on_team = model.new_bool_var(
                f"bed_{bed.ordinal}_assigned_team_{team_index}"
            )
            room_team = structure.room_team[(room.ordinal, team_index)]
            # This is the same AND pattern used above: a bed is on a team only
            # when it is assigned and that team covers the bed's room.
            model.add(assigned_on_team <= assigned)
            model.add(assigned_on_team <= room_team)
            model.add(assigned_on_team >= assigned + room_team - 1)
            assigned_to_team[(bed.ordinal, team_index)] = assigned_on_team

    # ------------------------------------------------------------------
    # Constraint group 7: calculate team workload and composition expressions.
    # ------------------------------------------------------------------
    total_acuity = sum(bed.acuity_weight for bed in input_model.occupied_beds)
    total_capacity = sum(nurse.max_patient_load for nurse in input_model.nurses)
    # Build the per-team totals used to measure balancing gaps.
    team_acuity_loads = []
    team_patient_counts = []
    team_rn_counts = []
    team_experience_counts: dict[str, list[cp_model.LinearExprT]] = {
        "experienced": [],
        "mid": [],
        "new_grad": [],
    }
    team_capacities = []

    for team_index in range(input_model.team_count):
        team_acuity_terms = []
        team_patient_terms = []
        for bed in input_model.occupied_beds:
            assigned_on_team = assigned_to_team[(bed.ordinal, team_index)]
            team_patient_terms.append(assigned_on_team)
            team_acuity_terms.append(assigned_on_team * bed.acuity_weight)

        team_rn_terms = []
        team_capacity_terms = []
        team_experience_terms = {
            "experienced": [],
            "mid": [],
            "new_grad": [],
        }
        for nurse in input_model.nurses:
            nurse_is_on_team = structure.nurse_team[(nurse.ordinal, team_index)]
            team_capacity_terms.append(nurse_is_on_team * nurse.max_patient_load)
            team_experience_terms[nurse.experience_level].append(nurse_is_on_team)
            if nurse.license_type == "RN":
                team_rn_terms.append(nurse_is_on_team)

        team_acuity_loads.append(sum(team_acuity_terms))
        team_patient_counts.append(sum(team_patient_terms))
        team_rn_counts.append(sum(team_rn_terms))
        team_capacities.append(sum(team_capacity_terms))
        for experience_level, terms in team_experience_terms.items():
            team_experience_counts[experience_level].append(sum(terms))

    _add_aggregate_acuity_constraints(
        model,
        input_model,
        assignment,
        nurse_acuity_loads,
        maximum_acuity_load,
        team_acuity_loads,
    )
    _add_aggregate_patient_count_constraints(
        model,
        input_model,
        assignment,
        nurse_patient_counts,
        maximum_patient_count,
        team_patient_counts,
    )
    if use_team_feasibility_cuts:
        _add_team_feasibility_constraints(
            model,
            input_model,
            assignment,
            assigned_to_team,
            team_patient_counts,
            team_capacities,
        )

    team_acuity_gap = _new_gap(model, team_acuity_loads, total_acuity, "team_acuity")
    team_patient_gap = _new_gap(
        model, team_patient_counts, len(input_model.occupied_beds), "team_patients"
    )
    team_rn_gap = _new_gap(model, team_rn_counts, len(input_model.nurses), "team_rn")
    experience_gaps: list[cp_model.IntVar] = []
    for experience_level, values in team_experience_counts.items():
        experience_gaps.append(
            _new_gap(
                model,
                values,
                len(input_model.nurses),
                f"team_experience_{experience_level}",
            )
        )
    experience_distribution_gap = model.new_int_var(
        0, len(input_model.nurses) * 3, "team_experience_distribution_gap"
    )
    model.add(experience_distribution_gap == sum(experience_gaps))
    team_capacity_gap = _new_gap(
        model, team_capacities, total_capacity, "team_capacity"
    )

    # ------------------------------------------------------------------
    # Objective group 8: optimize in strict clinical priority order. Each call
    # freezes its answer
    # before the following call starts.
    objective_values: dict[str, int] = {}

    # Priority 1: leave as few occupied beds unassigned as possible.
    objective_values["unassigned_count"] = minimize_and_fix(
        "unassigned_count", sum(assignment.bed_unassigned.values())
    )

    # Priority 2: minimize the highest weighted acuity load on any nurse.
    objective_values["max_nurse_acuity_load"] = minimize_and_fix(
        "max_nurse_acuity_load", maximum_acuity_load
    )

    # Priority 3: minimize the largest patient count on any nurse.
    objective_values["max_nurse_patient_count"] = minimize_and_fix(
        "max_nurse_patient_count", maximum_patient_count
    )

    # Priority 4: prefer more experienced owners for red-acuity beds.
    if (
        structural_red_rank_bound_enabled
        and objective_values["unassigned_count"] == 0
    ):
        stage_started_at = time.monotonic()
        structural_model, structural_lower_bound = (
            _build_structural_red_rank_lower_bound_model(
                input_model,
                fixed_maximum_acuity_load=objective_values[
                    "max_nurse_acuity_load"
                ],
                fixed_maximum_patient_count=objective_values[
                    "max_nurse_patient_count"
                ],
            )
        )
        elapsed_before_stage = time.monotonic() - started_at
        remaining = solve_budget_seconds - elapsed_before_stage
        structural_solver = _configure_solver(search_worker_count)
        structural_solver.parameters.max_time_in_seconds = max(0.0, remaining)
        structural_status = structural_solver.solve(structural_model)
        stage_duration_ms = (time.monotonic() - stage_started_at) * 1000
        if structural_status != cp_model.OPTIMAL:
            diagnostics = SolveFailureDiagnostics(
                solve_budget_ms=solve_budget_seconds * 1000,
                elapsed_before_failed_stage_ms=elapsed_before_stage * 1000,
                remaining_budget_at_failed_stage_ms=max(0.0, remaining) * 1000,
                failed_stage_duration_ms=stage_duration_ms,
                total_elapsed_ms=(time.monotonic() - started_at) * 1000,
                completed_stages=tuple(stage_trace),
                solver_wall_time_ms=structural_solver.wall_time * 1000,
                num_branches=structural_solver.num_branches,
                num_conflicts=structural_solver.num_conflicts,
                objective_value=(
                    structural_solver.objective_value
                    if structural_status == cp_model.FEASIBLE
                    else None
                ),
                best_objective_bound=structural_solver.best_objective_bound,
            )
            error_type = (
                OptimizerTimedOutError
                if structural_status in {cp_model.FEASIBLE, cp_model.UNKNOWN}
                else OptimizerSolveError
            )
            raise error_type(
                "red_bed_owner_rank_structural_bound",
                structural_status,
                diagnostics,
            )
        proven_lower_bound = int(round(structural_solver.objective_value))
        incumbent_value = int(solver.value(red_owner_rank_sum))
        if proven_lower_bound > incumbent_value:
            raise RuntimeError("red-rank structural bound exceeds a feasible value")
        stage_trace.append(
            ObjectiveStage(
                name="red_bed_owner_rank_structural_bound",
                value=proven_lower_bound,
                duration_ms=stage_duration_ms,
            )
        )
        if proven_lower_bound != incumbent_value:
            feasibility_model = model.clone()
            feasibility_model.clear_objective()
            feasibility_model.clear_hints()
            feasibility_model.add(red_owner_rank_sum == proven_lower_bound)
            elapsed_before_feasibility = time.monotonic() - started_at
            remaining = solve_budget_seconds - elapsed_before_feasibility
            feasibility_solver = _configure_solver(search_worker_count)
            feasibility_solver.parameters.max_time_in_seconds = max(0.0, remaining)
            feasibility_started_at = time.monotonic()
            feasibility_status = feasibility_solver.solve(feasibility_model)
            feasibility_duration_ms = (
                time.monotonic() - feasibility_started_at
            ) * 1000
            if feasibility_status == cp_model.OPTIMAL:
                stage_trace.append(
                    ObjectiveStage(
                        name="red_bed_owner_rank_structural_feasibility",
                        value=proven_lower_bound,
                        duration_ms=feasibility_duration_ms,
                    )
                )
                if use_rolling_stage_hints:
                    _replace_hint_with_solution(model, feasibility_solver)
            elif feasibility_status == cp_model.INFEASIBLE:
                model.add(red_owner_rank_sum >= proven_lower_bound + 1)
                objective_values["red_bed_owner_rank_sum"] = minimize_and_fix(
                    "red_bed_owner_rank_sum",
                    red_owner_rank_sum,
                )
            else:
                diagnostics = SolveFailureDiagnostics(
                    solve_budget_ms=solve_budget_seconds * 1000,
                    elapsed_before_failed_stage_ms=(
                        elapsed_before_feasibility * 1000
                    ),
                    remaining_budget_at_failed_stage_ms=max(0.0, remaining)
                    * 1000,
                    failed_stage_duration_ms=feasibility_duration_ms,
                    total_elapsed_ms=(time.monotonic() - started_at) * 1000,
                    completed_stages=tuple(stage_trace),
                    solver_wall_time_ms=feasibility_solver.wall_time * 1000,
                    num_branches=feasibility_solver.num_branches,
                    num_conflicts=feasibility_solver.num_conflicts,
                    objective_value=float(proven_lower_bound),
                    best_objective_bound=None,
                )
                raise OptimizerTimedOutError(
                    "red_bed_owner_rank_structural_feasibility",
                    feasibility_status,
                    diagnostics,
                )
        if "red_bed_owner_rank_sum" not in objective_values:
            model.add(red_owner_rank_sum == proven_lower_bound)
            objective_values["red_bed_owner_rank_sum"] = proven_lower_bound
    else:
        objective_values["red_bed_owner_rank_sum"] = minimize_and_fix(
            "red_bed_owner_rank_sum", red_owner_rank_sum
        )

    mixed_radix_bed_owner_search_enabled = (
        use_mixed_radix_bed_owner_search
        if use_mixed_radix_bed_owner_search is not None
        else (
            len(input_model.occupied_beds)
            > MIXED_RADIX_ROOM_SEARCH_BED_THRESHOLD
            and objective_values["unassigned_count"] == 0
        )
    )

    # Priorities 5-6: reduce total guidance excess, then reduce the number of
    # nurses who have any guidance excess.
    objective_values["side_guidance_total_excess"] = minimize_and_fix(
        "side_guidance_total_excess", sum(nurse_guidance_excess.values())
    )
    objective_values["side_guidance_nurse_count"] = minimize_and_fix(
        "side_guidance_nurse_count", sum(nurse_above_guidance.values())
    )

    # Priorities 7-11: balance team acuity, census, RN count, experience mix,
    # and total capacity in that order.
    objective_values["team_weighted_acuity_gap"] = minimize_and_fix(
        "team_weighted_acuity_gap", team_acuity_gap
    )
    objective_values["team_patient_count_gap"] = minimize_and_fix(
        "team_patient_count_gap", team_patient_gap
    )
    if use_fixed_gap_bounds:
        _add_fixed_sum_gap_bounds(
            model,
            team_patient_counts,
            fixed_sum=(
                len(input_model.occupied_beds)
                - objective_values["unassigned_count"]
            ),
            fixed_gap=objective_values["team_patient_count_gap"],
            name="team_patient_count",
        )
    objective_values["team_rn_count_gap"] = minimize_and_fix(
        "team_rn_count_gap", team_rn_gap
    )
    if use_fixed_gap_bounds:
        _add_fixed_sum_gap_bounds(
            model,
            team_rn_counts,
            fixed_sum=sum(
                1 for nurse in input_model.nurses if nurse.license_type == "RN"
            ),
            fixed_gap=objective_values["team_rn_count_gap"],
            name="team_rn_count",
        )
    objective_values["team_experience_distribution_gap"] = minimize_and_fix(
        "team_experience_distribution_gap", experience_distribution_gap
    )
    objective_values["team_capacity_gap"] = minimize_and_fix(
        "team_capacity_gap", team_capacity_gap
    )
    if use_fixed_gap_bounds:
        _add_fixed_sum_gap_bounds(
            model,
            team_capacities,
            fixed_sum=total_capacity,
            fixed_gap=objective_values["team_capacity_gap"],
            name="team_capacity",
        )

    # ------------------------------------------------------------------
    # Canonical tie-breaker group 9: clinical objectives can still leave several
    # equally good solutions, so choose stable lowest-index decisions.
    # ------------------------------------------------------------------
    # Tie-breaker 1: choose the lowest team index for each occupied room.
    room_rank_decisions: list[tuple[str, cp_model.LinearExprT | int]] = []
    for room in input_model.rooms:
        if room.id not in occupied_room_ids:
            continue

        room_team_rank_terms = []
        for team_index in range(input_model.team_count):
            room_is_on_team = structure.room_team[(room.ordinal, team_index)]
            room_team_rank_terms.append(team_index * room_is_on_team)

        room_rank_decisions.append(
            (
                room.id,
                sum(room_team_rank_terms),
            )
        )

    # Tie-breaker 2: choose the lowest nurse ordinal for each assigned bed.
    bed_owner_rank_decisions: list[tuple[str, cp_model.LinearExprT | int]] = []
    for bed in input_model.occupied_beds:
        bed_owner_rank_terms = []
        for nurse in input_model.nurses:
            bed_nurse_key = (bed.ordinal, nurse.ordinal)
            owner_choice = assignment.bed_nurse.get(bed_nurse_key)
            if owner_choice is not None:
                bed_owner_rank_terms.append(nurse.ordinal * owner_choice)

        unassigned_rank = (
            len(input_model.nurses) * assignment.bed_unassigned[bed.ordinal]
        )
        bed_owner_rank_decisions.append(
            (
                bed.id,
                sum(bed_owner_rank_terms) + unassigned_rank,
            )
        )

    # Tie-breaker 3: choose the lowest team index for each nurse membership.
    nurse_team_rank_decisions: list[tuple[str, cp_model.LinearExprT | int]] = []
    for nurse in input_model.nurses:
        nurse_team_rank_terms = []
        for team_index in range(input_model.team_count):
            nurse_is_on_team = structure.nurse_team[(nurse.ordinal, team_index)]
            nurse_team_rank_terms.append(team_index * nurse_is_on_team)

        nurse_team_rank_decisions.append((nurse.id, sum(nurse_team_rank_terms)))

    def solve_mixed_radix_room_ranks() -> None:
        """Prove canonical room ranks in exact ordered chunks with presolve."""

        room_rank_radix = max(2, input_model.team_count)
        for chunk_start in range(
            0,
            len(room_rank_decisions),
            canonical_room_chunk_size,
        ):
            chunk = room_rank_decisions[
                chunk_start : chunk_start + canonical_room_chunk_size
            ]
            if len(chunk) == 1:
                room_id, room_rank = chunk[0]
                minimize_and_fix(f"canonical_room_team:{room_id}", room_rank)
                continue

            first_room_id = chunk[0][0]
            last_room_id = chunk[-1][0]
            chunk_ranks = [room_rank for _, room_rank in chunk]
            minimize_and_fix(
                f"canonical_room_team_chunk:{first_room_id}..{last_room_id}",
                _mixed_radix_expression(chunk_ranks, room_rank_radix),
            )

            # A mixed-radix score uniquely identifies every bounded room rank in
            # the chunk. State those solved values directly to strengthen later
            # chunks without changing the proven lexicographic result.
            for _, room_rank in chunk:
                model.add(room_rank == solver.value(room_rank))

    def solve_mixed_radix_bed_owner_ranks() -> None:
        """Prove canonical bed-owner ranks in exact ordered chunks."""

        owner_rank_radix = len(input_model.nurses) + 1
        for chunk_start in range(
            0,
            len(bed_owner_rank_decisions),
            canonical_bed_owner_chunk_size,
        ):
            chunk = bed_owner_rank_decisions[
                chunk_start : chunk_start + canonical_bed_owner_chunk_size
            ]
            first_bed_id = chunk[0][0]
            last_bed_id = chunk[-1][0]
            chunk_ranks = [owner_rank for _, owner_rank in chunk]
            minimize_and_fix(
                f"canonical_bed_owner_chunk:{first_bed_id}..{last_bed_id}",
                _mixed_radix_expression(chunk_ranks, owner_rank_radix),
            )
            for _, owner_rank in chunk:
                model.add(owner_rank == solver.value(owner_rank))

    if use_fixed_canonical_search:
        # A complete fixed search explores rank values in this exact order and
        # always tries the lowest value first. With every clinical objective
        # already frozen, its first feasible leaf is the same lexicographically
        # smallest canonical assignment that the staged solves prove.
        room_rank_variables: list[cp_model.IntVar] = []
        if mixed_radix_room_search_enabled:
            solve_mixed_radix_room_ranks()
        else:
            for room_id, room_rank in room_rank_decisions:
                rank_variable = model.new_int_var(
                    0,
                    input_model.team_count - 1,
                    f"fixed_canonical_room_team_{room_id}",
                )
                model.add(rank_variable == room_rank)
                room_rank_variables.append(rank_variable)
        bed_owner_rank_variables: list[cp_model.IntVar] = []
        for bed_id, bed_owner_rank in bed_owner_rank_decisions:
            rank_variable = model.new_int_var(
                0,
                len(input_model.nurses),
                f"fixed_canonical_bed_owner_{bed_id}",
            )
            model.add(rank_variable == bed_owner_rank)
            bed_owner_rank_variables.append(rank_variable)
        nurse_team_rank_variables: list[cp_model.IntVar] = []
        for nurse_id, nurse_team_rank in nurse_team_rank_decisions:
            rank_variable = model.new_int_var(
                0,
                input_model.team_count - 1,
                f"fixed_canonical_team_membership_{nurse_id}",
            )
            model.add(rank_variable == nurse_team_rank)
            nurse_team_rank_variables.append(rank_variable)

        def solve_fixed_canonical_pass(
            stage_name: str,
            rank_variables: list[cp_model.IntVar],
            *,
            freeze_result: bool,
        ) -> None:
            """Find the exact lowest rank tuple and optionally freeze it."""

            if not rank_variables:
                return

            # Hints can install an incumbent before the fixed branching order
            # gets to its first leaf. Remove them so "first solution" means the
            # first solution under this pass's canonical rank order.
            model.clear_hints()
            model.clear_objective()
            model.proto.search_strategy.clear()
            _add_complete_fixed_search_strategy(model, rank_variables)
            solver.parameters.search_branching = cp_model.FIXED_SEARCH
            # Presolve may substitute or remove these derived rank variables and
            # thereby change first-solution order. The fixed pass needs the
            # literal declared decision sequence to preserve the contract.
            solver.parameters.cp_model_presolve = False

            elapsed_before_stage = time.monotonic() - started_at
            remaining = solve_budget_seconds - elapsed_before_stage
            if remaining <= 0:
                diagnostics = SolveFailureDiagnostics(
                    solve_budget_ms=solve_budget_seconds * 1000,
                    elapsed_before_failed_stage_ms=elapsed_before_stage * 1000,
                    remaining_budget_at_failed_stage_ms=0,
                    failed_stage_duration_ms=0,
                    total_elapsed_ms=(time.monotonic() - started_at) * 1000,
                    completed_stages=tuple(stage_trace),
                    solver_wall_time_ms=None,
                    num_branches=None,
                    num_conflicts=None,
                    objective_value=None,
                    best_objective_bound=None,
                )
                raise OptimizerTimedOutError(
                    stage_name,
                    cp_model.UNKNOWN,
                    diagnostics,
                )

            solver.parameters.max_time_in_seconds = remaining
            stage_started_at = time.monotonic()
            status = solver.solve(model)
            stage_duration_ms = (time.monotonic() - stage_started_at) * 1000
            if status != cp_model.OPTIMAL:
                diagnostics = SolveFailureDiagnostics(
                    solve_budget_ms=solve_budget_seconds * 1000,
                    elapsed_before_failed_stage_ms=elapsed_before_stage * 1000,
                    remaining_budget_at_failed_stage_ms=remaining * 1000,
                    failed_stage_duration_ms=stage_duration_ms,
                    total_elapsed_ms=(time.monotonic() - started_at) * 1000,
                    completed_stages=tuple(stage_trace),
                    solver_wall_time_ms=solver.wall_time * 1000,
                    num_branches=solver.num_branches,
                    num_conflicts=solver.num_conflicts,
                    objective_value=None,
                    best_objective_bound=solver.best_objective_bound,
                )
                error_type = (
                    OptimizerTimedOutError
                    if status in {cp_model.FEASIBLE, cp_model.UNKNOWN}
                    else OptimizerSolveError
                )
                raise error_type(stage_name, status, diagnostics)
            stage_trace.append(
                ObjectiveStage(
                    name=stage_name,
                    value=0,
                    duration_ms=stage_duration_ms,
                )
            )
            if freeze_result:
                for rank_variable in rank_variables:
                    model.add(rank_variable == solver.value(rank_variable))

        canonical_rank_variables = (
            room_rank_variables
            + bed_owner_rank_variables
            + nurse_team_rank_variables
        )
        if split_fixed_canonical_search:
            solve_fixed_canonical_pass(
                "canonical_fixed_room_search",
                room_rank_variables,
                freeze_result=True,
            )
            if mixed_radix_bed_owner_search_enabled:
                solve_mixed_radix_bed_owner_ranks()
            elif fixed_bed_owner_block_size is None:
                solve_fixed_canonical_pass(
                    "canonical_fixed_bed_owner_search",
                    bed_owner_rank_variables,
                    freeze_result=True,
                )
            else:
                for block_start in range(
                    0,
                    len(bed_owner_rank_variables),
                    fixed_bed_owner_block_size,
                ):
                    block = bed_owner_rank_variables[
                        block_start : block_start + fixed_bed_owner_block_size
                    ]
                    block_end = block_start + len(block)
                    solve_fixed_canonical_pass(
                        (
                            "canonical_fixed_bed_owner_block:"
                            f"{block_start + 1}..{block_end}"
                        ),
                        block,
                        freeze_result=True,
                    )
            solve_fixed_canonical_pass(
                "canonical_fixed_team_membership_search",
                nurse_team_rank_variables,
                freeze_result=False,
            )
        else:
            solve_fixed_canonical_pass(
                "canonical_fixed_search",
                canonical_rank_variables,
                freeze_result=False,
            )
    else:
        solve_mixed_radix_room_ranks()

        for bed_id, bed_owner_rank in bed_owner_rank_decisions:
            minimize_and_fix(f"canonical_bed_owner:{bed_id}", bed_owner_rank)

        for nurse_id, nurse_team_rank in nurse_team_rank_decisions:
            minimize_and_fix(
                f"canonical_team_membership:{nurse_id}",
                nurse_team_rank,
            )

    return OptimizerSolution(
        team_coverage=read_team_coverage_decision(structure, solver),
        bed_owners=read_bed_owner_decisions(assignment, solver),
        objectives=ObjectiveSummary(**objective_values),
        stage_trace=tuple(stage_trace),
    )
