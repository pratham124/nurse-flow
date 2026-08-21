"""Build and independently validate the existing NurseFlow assignment result."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable
from uuid import uuid4

from .models import NormalizedOptimizerInput
from .optimizer import ObjectiveSummary, OptimizerSolution, RED_OWNER_RANK


@dataclass(frozen=True)
class GeneratedTeamOutput:
    """One generated team in the app's existing AssignmentResult shape."""

    id: str
    label: str
    nurse_ids: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        return {"id": self.id, "label": self.label, "nurseIds": list(self.nurse_ids)}


@dataclass(frozen=True)
class RoomCoverageOutput:
    """The nurses covering one room in the saved app output."""

    id: str
    room_id: str
    nurse_ids: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        return {"id": self.id, "roomId": self.room_id, "nurseIds": list(self.nurse_ids)}


@dataclass(frozen=True)
class BedAssignmentOutput:
    """One assigned bed and its nurse owner."""

    id: str
    bed_id: str
    nurse_id: str

    def to_dict(self) -> dict[str, str]:
        return {"id": self.id, "bedId": self.bed_id, "nurseId": self.nurse_id}


@dataclass(frozen=True)
class AssignmentResultOutput:
    """Complete assignment result consumed by the TypeScript application."""

    id: str
    generated_teams: tuple[GeneratedTeamOutput, ...]
    room_coverage: tuple[RoomCoverageOutput, ...]
    bed_assignments: tuple[BedAssignmentOutput, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "generatedTeams": [team.to_dict() for team in self.generated_teams],
            "roomCoverage": [coverage.to_dict() for coverage in self.room_coverage],
            "bedAssignments": [assignment.to_dict() for assignment in self.bed_assignments],
        }


@dataclass(frozen=True)
class FlagOutput:
    """One user-facing warning or critical assignment flag."""

    id: str
    type: str
    severity: str
    message: str
    nurse_id: str | None = None
    room_id: str | None = None
    bed_id: str | None = None
    team_id: str | None = None

    def to_dict(self) -> dict[str, str]:
        value = {
            "id": self.id,
            "type": self.type,
            "severity": self.severity,
            "message": self.message,
        }
        optional_values = {
            "nurseId": self.nurse_id,
            "roomId": self.room_id,
            "bedId": self.bed_id,
            "teamId": self.team_id,
        }
        for key, item in optional_values.items():
            if item is not None:
                value[key] = item

        return value


@dataclass(frozen=True)
class AssignmentOutput:
    """Validated assignment result, flags, and objective evidence."""

    assignment_result: AssignmentResultOutput
    flags: tuple[FlagOutput, ...]
    objectives: ObjectiveSummary


class OptimizerOutputValidationError(ValueError):
    pass


def _gap(values: list[int]) -> int:
    """Return the difference between the largest and smallest values."""

    if not values:
        return 0
    return max(values) - min(values)


def _compute_objectives(
    input_model: NormalizedOptimizerInput, result: AssignmentResultOutput
) -> ObjectiveSummary:
    """Recompute objective values from saved output without solver variables."""

    # Index output data by stable application IDs, then rebuild each nurse's
    # patient count and weighted acuity load from the saved bed assignments.
    nurse_by_id = {nurse.id: nurse for nurse in input_model.nurses}
    assignment_by_bed_id = {
        assignment.bed_id: assignment for assignment in result.bed_assignments
    }
    patient_count_by_nurse_id = {nurse.id: 0 for nurse in input_model.nurses}
    acuity_load_by_nurse_id = {nurse.id: 0 for nurse in input_model.nurses}

    red_rank_sum = 0
    for bed in input_model.occupied_beds:
        assignment = assignment_by_bed_id.get(bed.id)
        if assignment is None:
            if bed.acuity == "red":
                red_rank_sum += 3
            continue
        patient_count_by_nurse_id[assignment.nurse_id] += 1
        acuity_load_by_nurse_id[assignment.nurse_id] += bed.acuity_weight
        if bed.acuity == "red":
            red_rank_sum += RED_OWNER_RANK[nurse_by_id[assignment.nurse_id].experience_level]

    # A nurse uses admitting-side guidance when any covered room is on that side.
    admitting_room_ids = {
        room.id
        for room in input_model.rooms
        if room.doctor_side_id == input_model.admitting_doctor_side_id
    }
    nurses_covering_admitting: set[str] = set()
    for coverage in result.room_coverage:
        if coverage.room_id not in admitting_room_ids:
            continue
        for nurse_id in coverage.nurse_ids:
            nurses_covering_admitting.add(nurse_id)

    guidance_excesses: list[int] = []
    for nurse in input_model.nurses:
        maximum = (
            input_model.admitting_load_limit.maximum
            if nurse.id in nurses_covering_admitting
            else input_model.non_admitting_load_limit.maximum
        )
        guidance_excesses.append(
            max(0, patient_count_by_nurse_id[nurse.id] - maximum)
        )

    # Rebuild team totals independently so corrupt output cannot simply repeat
    # objective numbers originally reported by the solver.
    team_acuity_loads: list[int] = []
    team_patient_counts: list[int] = []
    team_rn_counts: list[int] = []
    team_capacities: list[int] = []
    team_experience_counts: dict[str, list[int]] = {
        "experienced": [],
        "mid": [],
        "new_grad": [],
    }
    for team in result.generated_teams:
        team_acuity_load = 0
        team_patient_count = 0
        team_rn_count = 0
        team_capacity = 0
        experience_count = {"experienced": 0, "mid": 0, "new_grad": 0}

        for nurse_id in team.nurse_ids:
            nurse = nurse_by_id[nurse_id]
            team_acuity_load += acuity_load_by_nurse_id[nurse_id]
            team_patient_count += patient_count_by_nurse_id[nurse_id]
            team_capacity += nurse.max_patient_load
            experience_count[nurse.experience_level] += 1
            if nurse.license_type == "RN":
                team_rn_count += 1

        team_acuity_loads.append(team_acuity_load)
        team_patient_counts.append(team_patient_count)
        team_rn_counts.append(team_rn_count)
        team_capacities.append(team_capacity)
        for experience_level, counts in team_experience_counts.items():
            counts.append(experience_count[experience_level])

    experience_distribution_gap = 0
    for counts in team_experience_counts.values():
        experience_distribution_gap += _gap(counts)

    return ObjectiveSummary(
        unassigned_count=len(input_model.occupied_beds) - len(result.bed_assignments),
        max_nurse_acuity_load=max(acuity_load_by_nurse_id.values(), default=0),
        max_nurse_patient_count=max(patient_count_by_nurse_id.values(), default=0),
        red_bed_owner_rank_sum=red_rank_sum,
        side_guidance_total_excess=sum(guidance_excesses),
        side_guidance_nurse_count=sum(1 for excess in guidance_excesses if excess > 0),
        team_weighted_acuity_gap=_gap(team_acuity_loads),
        team_patient_count_gap=_gap(team_patient_counts),
        team_rn_count_gap=_gap(team_rn_counts),
        team_experience_distribution_gap=experience_distribution_gap,
        team_capacity_gap=_gap(team_capacities),
    )


def _build_flags(
    input_model: NormalizedOptimizerInput, result: AssignmentResultOutput
) -> tuple[FlagOutput, ...]:
    """Derive user-facing flags from the validated assignment data."""

    flags: list[FlagOutput] = []
    bed_by_id = {bed.id: bed for bed in input_model.occupied_beds}
    nurse_by_id = {nurse.id: nurse for nurse in input_model.nurses}
    assignment_by_bed_id = {
        assignment.bed_id: assignment for assignment in result.bed_assignments
    }
    coverage_by_room_id = {
        coverage.room_id: coverage for coverage in result.room_coverage
    }
    assigned_count_by_nurse_id = {nurse.id: 0 for nurse in input_model.nurses}
    for assignment in result.bed_assignments:
        assigned_count_by_nurse_id[assignment.nurse_id] += 1

    # Flag shift-wide understaffing before adding bed-specific explanations.
    total_capacity = sum(nurse.max_patient_load for nurse in input_model.nurses)
    if len(input_model.occupied_beds) > total_capacity:
        flags.append(
            FlagOutput(
                id=f"{result.id}-flag-understaffed",
                type="understaffed",
                severity="warning",
                message="The occupied census is higher than total configured nurse capacity.",
            )
        )

    # Every omitted occupied bed is internally unassigned. Explain whether the
    # covered team lacked general capacity, eligible RN capacity, or both.
    for bed in input_model.occupied_beds:
        if bed.id in assignment_by_bed_id:
            continue
        coverage = coverage_by_room_id[bed.room_id]
        flags.append(
            FlagOutput(
                id=f"{result.id}-flag-unassigned-{bed.id}",
                type="unassigned_bed",
                severity="warning",
                message="An occupied bed could not be assigned under the current constraints.",
                bed_id=bed.id,
                room_id=bed.room_id,
            )
        )
        eligible_with_capacity: list[str] = []
        for nurse_id in coverage.nurse_ids:
            nurse = nurse_by_id[nurse_id]
            has_required_license = bed.acuity != "red" or nurse.license_type == "RN"
            has_capacity = assigned_count_by_nurse_id[nurse_id] < nurse.max_patient_load
            if has_required_license and has_capacity:
                eligible_with_capacity.append(nurse_id)

        if bed.acuity == "red" and not eligible_with_capacity:
            flags.append(
                FlagOutput(
                    id=f"{result.id}-flag-rn-required-{bed.id}",
                    type="rn_required",
                    severity="critical",
                    message="A red-acuity occupied bed has no eligible RN capacity.",
                    bed_id=bed.id,
                    room_id=bed.room_id,
                )
            )
        if not eligible_with_capacity:
            flags.append(
                FlagOutput(
                    id=f"{result.id}-flag-coverage-{bed.id}",
                    type="no_eligible_coverage",
                    severity="warning",
                    message="An occupied bed has no eligible nurse capacity in its room coverage.",
                    bed_id=bed.id,
                    room_id=bed.room_id,
                )
            )

    # Side-load limits are guidance. Exceeding one produces a warning rather
    # than invalidating an otherwise safe assignment.
    admitting_room_ids = {
        room.id
        for room in input_model.rooms
        if room.doctor_side_id == input_model.admitting_doctor_side_id
    }
    for nurse in input_model.nurses:
        covers_admitting = False
        for coverage in result.room_coverage:
            room_is_admitting = coverage.room_id in admitting_room_ids
            nurse_covers_room = nurse.id in coverage.nurse_ids
            if room_is_admitting and nurse_covers_room:
                covers_admitting = True
                break

        maximum = (
            input_model.admitting_load_limit.maximum
            if covers_admitting
            else input_model.non_admitting_load_limit.maximum
        )
        if assigned_count_by_nurse_id[nurse.id] > maximum:
            flags.append(
                FlagOutput(
                    id=f"{result.id}-flag-side-load-{nurse.id}",
                    type="over_side_load_limit",
                    severity="warning",
                    message="A nurse is above the applicable side-based guidance maximum.",
                    nurse_id=nurse.id,
                )
            )

    # Summarize final team workloads for the user-facing imbalance threshold.
    team_patient_counts = {team.id: 0 for team in result.generated_teams}
    team_red_counts = {team.id: 0 for team in result.generated_teams}
    team_acuity_loads = {team.id: 0 for team in result.generated_teams}
    team_by_nurse_id: dict[str, GeneratedTeamOutput] = {}
    for team in result.generated_teams:
        for nurse_id in team.nurse_ids:
            team_by_nurse_id[nurse_id] = team

    for assignment in result.bed_assignments:
        bed = bed_by_id[assignment.bed_id]
        team = team_by_nurse_id[assignment.nurse_id]
        team_patient_counts[team.id] += 1
        team_acuity_loads[team.id] += bed.acuity_weight
        if bed.acuity == "red":
            team_red_counts[team.id] += 1
    team_rn_counts: dict[str, int] = {}
    for team in result.generated_teams:
        rn_count = 0
        for nurse_id in team.nurse_ids:
            if nurse_by_id[nurse_id].license_type == "RN":
                rn_count += 1
        team_rn_counts[team.id] = rn_count

    has_patient_gap = _gap(list(team_patient_counts.values())) > 1
    has_red_gap = _gap(list(team_red_counts.values())) > 1
    has_rn_gap = _gap(list(team_rn_counts.values())) > 1
    has_acuity_gap = _gap(list(team_acuity_loads.values())) > 3
    has_team_imbalance = (
        has_patient_gap or has_red_gap or has_rn_gap or has_acuity_gap
    )
    if len(result.generated_teams) >= 2 and has_team_imbalance:
        flags.append(
            FlagOutput(
                id=f"{result.id}-flag-team-imbalance",
                type="team_imbalance",
                severity="warning",
                message="Generated teams have a noticeable workload or RN-coverage difference.",
                team_id=result.generated_teams[0].id,
            )
        )

    return tuple(flags)


def validate_assignment_output(
    input_model: NormalizedOptimizerInput,
    solution: OptimizerSolution,
    output: AssignmentOutput,
) -> None:
    """Validate IDs, hard constraints, decisions, flags, and objective summary."""

    result = output.assignment_result
    nurse_by_id = {nurse.id: nurse for nurse in input_model.nurses}
    bed_by_id = {bed.id: bed for bed in input_model.occupied_beds}
    room_ids = tuple(room.id for room in input_model.rooms)

    # 1. Verify result identity and every deterministic child ID.
    if not result.id:
        raise OptimizerOutputValidationError("assignment result ID is missing")

    child_ids: list[str] = []
    child_ids.extend(team.id for team in result.generated_teams)
    child_ids.extend(coverage.id for coverage in result.room_coverage)
    child_ids.extend(assignment.id for assignment in result.bed_assignments)
    child_ids.extend(flag.id for flag in output.flags)
    if len(child_ids) != len(set(child_ids)):
        raise OptimizerOutputValidationError("child IDs must be unique")

    # 2. Verify team decisions and make sure each nurse appears exactly once.
    actual_team_decisions = tuple(
        (team.label, team.nurse_ids) for team in result.generated_teams
    )
    expected_team_decisions = tuple(
        (team.label, team.nurse_ids) for team in solution.team_coverage.teams
    )
    if actual_team_decisions != expected_team_decisions:
        raise OptimizerOutputValidationError("generated teams do not match solver decisions")

    actual_team_ids = tuple(team.id for team in result.generated_teams)
    expected_team_ids = tuple(
        f"{result.id}-team-{index + 1}"
        for index in range(len(result.generated_teams))
    )
    if actual_team_ids != expected_team_ids:
        raise OptimizerOutputValidationError("generated team child IDs are not stable")

    all_output_nurse_ids: list[str] = []
    for team in result.generated_teams:
        all_output_nurse_ids.extend(team.nurse_ids)

    if len(all_output_nurse_ids) != len(set(all_output_nurse_ids)) or set(
        all_output_nurse_ids
    ) != set(nurse_by_id):
        raise OptimizerOutputValidationError("every current nurse must appear in one team")

    # 3. Verify every room's coverage and canonical ordering.
    if tuple(coverage.room_id for coverage in result.room_coverage) != room_ids:
        raise OptimizerOutputValidationError("room coverage must contain every room canonically")

    for coverage in result.room_coverage:
        expected_coverage_id = f"{result.id}-coverage-{coverage.room_id}"
        if coverage.id != expected_coverage_id:
            raise OptimizerOutputValidationError("room coverage child IDs are not stable")

    expected_room_coverage = {
        room.room_id: room.nurse_ids for room in solution.team_coverage.rooms
    }
    for coverage in result.room_coverage:
        expected_nurse_ids = expected_room_coverage[coverage.room_id]
        if coverage.nurse_ids != expected_nurse_ids:
            raise OptimizerOutputValidationError(
                "room coverage does not match its selected team"
            )

    # 4. Re-check every saved bed owner without trusting solver variables.
    assignment_by_bed_id: dict[str, BedAssignmentOutput] = {}
    assigned_count_by_nurse_id = {nurse_id: 0 for nurse_id in nurse_by_id}
    coverage_by_room_id = {
        coverage.room_id: coverage for coverage in result.room_coverage
    }
    for assignment in result.bed_assignments:
        if assignment.bed_id in assignment_by_bed_id:
            raise OptimizerOutputValidationError("a bed has more than one saved owner")
        bed = bed_by_id.get(assignment.bed_id)
        nurse = nurse_by_id.get(assignment.nurse_id)
        if bed is None or nurse is None:
            raise OptimizerOutputValidationError("an assignment contains an unknown ID")
        if bed.acuity == "red" and nurse.license_type != "RN":
            raise OptimizerOutputValidationError("a red bed is assigned to an LPN")
        if nurse.id not in coverage_by_room_id[bed.room_id].nurse_ids:
            raise OptimizerOutputValidationError("a bed owner is outside room coverage")
        assignment_by_bed_id[bed.id] = assignment
        assigned_count_by_nurse_id[nurse.id] += 1
    for nurse_id, count in assigned_count_by_nurse_id.items():
        if count > nurse_by_id[nurse_id].max_patient_load:
            raise OptimizerOutputValidationError("a nurse exceeds the hard max load")

    # 5. Confirm saved decisions and ordering exactly match the solved decisions.
    expected_bed_owners = {bed.bed_id: bed.nurse_id for bed in solution.bed_owners}
    expected_assigned_bed_ids = tuple(
        bed.bed_id for bed in solution.bed_owners if bed.nurse_id is not None
    )
    actual_assigned_bed_ids = tuple(
        assignment.bed_id for assignment in result.bed_assignments
    )
    if actual_assigned_bed_ids != expected_assigned_bed_ids:
        raise OptimizerOutputValidationError("bed assignments are not in canonical order")

    for assignment in result.bed_assignments:
        expected_assignment_id = f"{result.id}-bed-{assignment.bed_id}"
        if assignment.id != expected_assignment_id:
            raise OptimizerOutputValidationError(
                "bed assignment child IDs are not stable"
            )

    actual_bed_owners: dict[str, str | None] = {}
    for bed in input_model.occupied_beds:
        saved_assignment = assignment_by_bed_id.get(bed.id)
        actual_bed_owners[bed.id] = (
            saved_assignment.nurse_id if saved_assignment is not None else None
        )

    if actual_bed_owners != expected_bed_owners:
        raise OptimizerOutputValidationError("saved bed owners do not match solver decisions")

    # 6. Independently recompute objectives and flags from the saved output.
    computed_objectives = _compute_objectives(input_model, result)
    if computed_objectives != solution.objectives or output.objectives != solution.objectives:
        raise OptimizerOutputValidationError("objective summary failed independent validation")

    expected_flags = _build_flags(input_model, result)
    if output.flags != expected_flags:
        raise OptimizerOutputValidationError("flags do not match the validated assignment")


def build_assignment_output(
    input_model: NormalizedOptimizerInput,
    solution: OptimizerSolution,
    *,
    result_id_factory: Callable[[], str] | None = None,
) -> AssignmentOutput:
    """Build a fresh AssignmentResult and reject it unless validation succeeds."""

    result_id = (result_id_factory or (lambda: str(uuid4())))()
    generated_teams_list: list[GeneratedTeamOutput] = []
    for index, team in enumerate(solution.team_coverage.teams):
        team_id = f"{result_id}-team-{index + 1}"
        generated_teams_list.append(
            GeneratedTeamOutput(
                id=team_id,
                label=team.label,
                nurse_ids=team.nurse_ids,
            )
        )
    generated_teams = tuple(generated_teams_list)

    room_coverage_list: list[RoomCoverageOutput] = []
    for room in solution.team_coverage.rooms:
        room_coverage_list.append(
            RoomCoverageOutput(
                id=f"{result_id}-coverage-{room.room_id}",
                room_id=room.room_id,
                nurse_ids=room.nurse_ids,
            )
        )
    room_coverage = tuple(room_coverage_list)

    # Unassigned beds are omitted from bedAssignments and represented by flags.
    bed_assignments_list: list[BedAssignmentOutput] = []
    for bed in solution.bed_owners:
        if bed.nurse_id is None:
            continue
        bed_assignments_list.append(
            BedAssignmentOutput(
                id=f"{result_id}-bed-{bed.bed_id}",
                bed_id=bed.bed_id,
                nurse_id=bed.nurse_id,
            )
        )
    bed_assignments = tuple(bed_assignments_list)
    assignment_result = AssignmentResultOutput(
        id=result_id,
        generated_teams=generated_teams,
        room_coverage=room_coverage,
        bed_assignments=bed_assignments,
    )
    output = AssignmentOutput(
        assignment_result=assignment_result,
        flags=_build_flags(input_model, assignment_result),
        objectives=solution.objectives,
    )
    # Validation is a mandatory gate: callers never receive corrupt output.
    validate_assignment_output(input_model, solution, output)
    return output
