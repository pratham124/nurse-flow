"""Exact staged CP-SAT optimization for the NurseFlow assignment contract."""

from __future__ import annotations

import time
from dataclasses import dataclass

import ortools
from ortools.sat.python import cp_model

from .assignment_model import (
    AssignmentModel,
    BedOwnerDecision,
    build_assignment_model,
    read_bed_owner_decisions,
)
from .models import NormalizedOptimizerInput
from .team_coverage_model import (
    TeamCoverageDecision,
    read_team_coverage_decision,
)

EXPECTED_ORTOOLS_VERSION = "9.15.6755"
SOLVER_RANDOM_SEED = 20260815
DEFAULT_SOLVE_BUDGET_SECONDS = 50.0
RED_OWNER_RANK = {"experienced": 0, "mid": 1, "new_grad": 2}


@dataclass(frozen=True)
class ObjectiveStage:
    """One completed optimization stage and its proven best value."""

    name: str
    value: int


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

    def __init__(self, stage: str, status: cp_model.CpSolverStatus) -> None:
        self.stage = stage
        self.status = status
        super().__init__(f"{stage} returned {status.name}")


class OptimizerTimedOutError(OptimizerSolveError):
    pass


def _new_gap(
    model: cp_model.CpModel,
    values: list[cp_model.LinearExprT],
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


def _configure_solver() -> cp_model.CpSolver:
    """Create a deterministic solver for reproducible assignments."""

    solver = cp_model.CpSolver()
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = SOLVER_RANDOM_SEED
    return solver


def solve_optimizer(
    input_model: NormalizedOptimizerInput,
    *,
    solve_budget_seconds: float = DEFAULT_SOLVE_BUDGET_SECONDS,
) -> OptimizerSolution:
    """Solve every frozen objective exactly and return canonical decisions."""

    if ortools.__version__ != EXPECTED_ORTOOLS_VERSION:
        raise RuntimeError(
            f"Expected OR-Tools {EXPECTED_ORTOOLS_VERSION}, found {ortools.__version__}"
        )

    # Build all hard constraints before adding any preferences. Every solution
    # considered below already obeys licensing, capacity, and coverage rules.
    assignment = build_assignment_model(input_model)
    structure = assignment.structure
    model = structure.model
    solver = _configure_solver()
    started_at = time.monotonic()
    stage_trace: list[ObjectiveStage] = []

    def minimize_and_fix(name: str, expression: cp_model.LinearExprT | int) -> int:
        """Prove one objective's minimum, then freeze it for later stages."""

        # All stages share one wall-clock budget. A later stage receives only
        # the time not already spent proving earlier, higher-priority results.
        remaining = solve_budget_seconds - (time.monotonic() - started_at)
        if remaining <= 0:
            raise OptimizerTimedOutError(name, cp_model.UNKNOWN)
        solver.parameters.max_time_in_seconds = remaining

        # CP-SAT optimizes one expression at a time. The previous stage has
        # already become a hard equality, so replacing the objective is safe.
        model.clear_objective()
        model.minimize(expression)
        status = solver.solve(model)
        if status != cp_model.OPTIMAL:
            error_type = (
                OptimizerTimedOutError
                if status in {cp_model.FEASIBLE, cp_model.UNKNOWN}
                else OptimizerSolveError
            )
            raise error_type(name, status)
        value = int(round(solver.objective_value))

        # This equality creates strict priority: no later preference may make
        # an earlier result worse, even if doing so improves several later ones.
        model.add(expression == value)
        stage_trace.append(ObjectiveStage(name=name, value=value))
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

    # Constraint group 2: identify the busiest nurse across the whole shift. The
    # service ceilings are 12 patients and 12 red-acuity weights (12 * 3 = 36).
    maximum_acuity_load = model.new_int_var(0, 36, "maximum_nurse_acuity_load")
    maximum_patient_count = model.new_int_var(0, 12, "maximum_nurse_patient_count")

    # OR-Tools sets each maximum variable equal to the largest corresponding
    # per-nurse value. Later objectives minimize these two worst-case workloads.
    model.add_max_equality(maximum_acuity_load, list(nurse_acuity_loads.values()))
    model.add_max_equality(maximum_patient_count, list(nurse_patient_counts.values()))

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
    objective_values["red_bed_owner_rank_sum"] = minimize_and_fix(
        "red_bed_owner_rank_sum", sum(red_rank_terms)
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
    objective_values["team_rn_count_gap"] = minimize_and_fix(
        "team_rn_count_gap", team_rn_gap
    )
    objective_values["team_experience_distribution_gap"] = minimize_and_fix(
        "team_experience_distribution_gap", experience_distribution_gap
    )
    objective_values["team_capacity_gap"] = minimize_and_fix(
        "team_capacity_gap", team_capacity_gap
    )

    # ------------------------------------------------------------------
    # Canonical tie-breaker group 9: clinical objectives can still leave several
    # equally good solutions, so choose stable lowest-index decisions.
    # ------------------------------------------------------------------
    # Tie-breaker 1: choose the lowest team index for each occupied room.
    for room in input_model.rooms:
        if room.id not in occupied_room_ids:
            continue

        room_team_rank_terms = []
        for team_index in range(input_model.team_count):
            room_is_on_team = structure.room_team[(room.ordinal, team_index)]
            room_team_rank_terms.append(team_index * room_is_on_team)

        minimize_and_fix(
            f"canonical_room_team:{room.id}",
            sum(room_team_rank_terms),
        )

    # Tie-breaker 2: choose the lowest nurse ordinal for each assigned bed.
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
        minimize_and_fix(
            f"canonical_bed_owner:{bed.id}",
            sum(bed_owner_rank_terms) + unassigned_rank,
        )

    # Tie-breaker 3: choose the lowest team index for each nurse membership.
    for nurse in input_model.nurses:
        nurse_team_rank_terms = []
        for team_index in range(input_model.team_count):
            nurse_is_on_team = structure.nurse_team[(nurse.ordinal, team_index)]
            nurse_team_rank_terms.append(team_index * nurse_is_on_team)

        minimize_and_fix(
            f"canonical_team_membership:{nurse.id}",
            sum(nurse_team_rank_terms),
        )

    return OptimizerSolution(
        team_coverage=read_team_coverage_decision(structure, solver),
        bed_owners=read_bed_owner_decisions(assignment, solver),
        objectives=ObjectiveSummary(**objective_values),
        stage_trace=tuple(stage_trace),
    )
