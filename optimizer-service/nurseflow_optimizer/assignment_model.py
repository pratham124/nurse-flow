"""CP-SAT hard constraints for occupied-bed assignment."""

from __future__ import annotations

from dataclasses import dataclass

from ortools.sat.python import cp_model

from .models import NormalizedOptimizerInput
from .team_coverage_model import TeamCoverageModel, build_team_coverage_model


@dataclass(frozen=True)
class BedOwnerDecision:
    bed_id: str
    nurse_id: str | None


@dataclass(frozen=True)
class AssignmentModel:
    structure: TeamCoverageModel
    bed_nurse: dict[tuple[int, int], cp_model.IntVar]
    bed_unassigned: dict[int, cp_model.IntVar]


def build_assignment_model(input_model: NormalizedOptimizerInput) -> AssignmentModel:
    """Add bed ownership, eligibility, capacity, and coverage constraints."""

    # Start with the team-membership and room-coverage variables. Bed ownership
    # is added to the same CP-SAT model so all decisions are solved together.
    structure = build_team_coverage_model(input_model)
    model = structure.model
    bed_nurse: dict[tuple[int, int], cp_model.IntVar] = {}
    bed_unassigned: dict[int, cp_model.IntVar] = {}
    room_by_id = {room.id: room for room in input_model.rooms}

    for bed in input_model.occupied_beds:
        # Red-acuity beds only get RN ownership variables. Because no LPN
        # variable exists for a red bed, the solver cannot make that choice.
        eligible_nurses = []
        for nurse in input_model.nurses:
            nurse_can_take_bed = bed.acuity != "red" or nurse.license_type == "RN"
            if nurse_can_take_bed:
                eligible_nurses.append(nurse)

        room = room_by_id[bed.room_id]
        owner_choices: list[cp_model.IntVar] = []
        for nurse in eligible_nurses:
            variable_name = f"bed_{bed.ordinal}_nurse_{nurse.ordinal}"
            owner_choice = model.new_bool_var(variable_name)
            bed_nurse[(bed.ordinal, nurse.ordinal)] = owner_choice
            owner_choices.append(owner_choice)

            # A nurse may own this bed only when their team covers its room.
            for team_index in range(input_model.team_count):
                room_is_on_team = structure.room_team[(room.ordinal, team_index)]
                nurse_is_on_team = structure.nurse_team[(nurse.ordinal, team_index)]
                model.add(
                    owner_choice + room_is_on_team <= 1 + nurse_is_on_team
                )

        # Keeping "unassigned" as an explicit choice lets an understaffed shift
        # produce a valid partial assignment instead of making the model fail.
        unassigned_choice = model.new_bool_var(f"bed_{bed.ordinal}_unassigned")
        bed_unassigned[bed.ordinal] = unassigned_choice
        all_bed_choices = [*owner_choices, unassigned_choice]
        model.add_exactly_one(all_bed_choices)

    # Count every ownership variable for each nurse and enforce their hard max.
    for nurse in input_model.nurses:
        nurse_assignment_choices: list[cp_model.IntVar] = []
        for (_, nurse_ordinal), owner_choice in bed_nurse.items():
            if nurse_ordinal == nurse.ordinal:
                nurse_assignment_choices.append(owner_choice)

        nurse_patient_count = sum(nurse_assignment_choices)
        model.add(nurse_patient_count <= nurse.max_patient_load)

    return AssignmentModel(
        structure=structure,
        bed_nurse=bed_nurse,
        bed_unassigned=bed_unassigned,
    )


def read_bed_owner_decisions(
    assignment: AssignmentModel, solver: cp_model.CpSolver
) -> tuple[BedOwnerDecision, ...]:
    """Read canonical occupied-bed decisions; unassigned is represented as None."""

    decisions: list[BedOwnerDecision] = []
    for bed in assignment.structure.input.occupied_beds:
        owner_id: str | None = None
        for nurse in assignment.structure.input.nurses:
            bed_nurse_key = (bed.ordinal, nurse.ordinal)
            owner_choice = assignment.bed_nurse.get(bed_nurse_key)
            if owner_choice is None:
                continue
            if solver.value(owner_choice) == 1:
                owner_id = nurse.id
                break

        decisions.append(BedOwnerDecision(bed_id=bed.id, nurse_id=owner_id))

    return tuple(decisions)
