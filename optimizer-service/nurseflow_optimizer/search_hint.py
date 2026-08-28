"""Deterministic feasible-start guidance for the exact CP-SAT model."""

from __future__ import annotations

from .assignment_model import AssignmentModel
from .models import NormalizedOccupiedBed, NormalizedOptimizerInput


def _canonical_team_members(input_model: NormalizedOptimizerInput) -> list[list[int]]:
    """Spread canonical nurses evenly across canonical teams."""

    base_size, extra_nurses = divmod(len(input_model.nurses), input_model.team_count)
    teams: list[list[int]] = []
    next_nurse_ordinal = 0
    for team_index in range(input_model.team_count):
        team_size = base_size + (1 if team_index < extra_nurses else 0)
        teams.append(
            list(range(next_nurse_ordinal, next_nurse_ordinal + team_size))
        )
        next_nurse_ordinal += team_size
    return teams


def add_deterministic_start_hint(
    input_model: NormalizedOptimizerInput,
    assignment: AssignmentModel,
) -> dict[int, int | None]:
    """Suggest one valid partial assignment without constraining the optimizer.

    A zero-unassigned hint lets CP-SAT prove the first objective immediately
    when this simple construction fits. If it does not fit, unassigned choices
    keep the hint valid and the exact solver remains free to find a better plan.
    """

    model = assignment.structure.model
    teams = _canonical_team_members(input_model)
    nurse_by_ordinal = {nurse.ordinal: nurse for nurse in input_model.nurses}
    remaining_load = {
        nurse.ordinal: nurse.max_patient_load for nurse in input_model.nurses
    }
    assigned_count = {nurse.ordinal: 0 for nurse in input_model.nurses}
    assigned_acuity = {nurse.ordinal: 0 for nurse in input_model.nurses}

    for nurse in input_model.nurses:
        hinted_team = next(
            team_index
            for team_index, members in enumerate(teams)
            if nurse.ordinal in members
        )
        for team_index in range(input_model.team_count):
            model.add_hint(
                assignment.structure.nurse_team[(nurse.ordinal, team_index)],
                int(team_index == hinted_team),
            )

    beds_by_room_id: dict[str, list[NormalizedOccupiedBed]] = {}
    for bed in input_model.occupied_beds:
        beds_by_room_id.setdefault(bed.room_id, []).append(bed)

    team_remaining_load = {
        team_index: sum(
            remaining_load[nurse_ordinal] for nurse_ordinal in members
        )
        for team_index, members in enumerate(teams)
    }
    team_remaining_rn_load = {
        team_index: sum(
            remaining_load[nurse_ordinal]
            for nurse_ordinal in members
            if nurse_by_ordinal[nurse_ordinal].license_type == "RN"
        )
        for team_index, members in enumerate(teams)
    }
    team_assigned_count = {team_index: 0 for team_index in range(len(teams))}
    team_assigned_acuity = {team_index: 0 for team_index in range(len(teams))}
    hinted_team_by_room_id: dict[str, int] = {}
    for room in input_model.rooms:
        room_beds = beds_by_room_id.get(room.id)
        if not room_beds:
            continue

        red_bed_count = sum(bed.acuity == "red" for bed in room_beds)
        room_acuity = sum(bed.acuity_weight for bed in room_beds)

        def team_rank(team_index: int) -> tuple[int, int, int, int, int]:
            can_cover_room = (
                team_remaining_load[team_index] >= len(room_beds)
                and team_remaining_rn_load[team_index] >= red_bed_count
            )
            return (
                int(can_cover_room),
                -(team_assigned_acuity[team_index] + room_acuity),
                -(team_assigned_count[team_index] + len(room_beds)),
                team_remaining_rn_load[team_index],
                -team_index,
            )

        selected_team = max(range(input_model.team_count), key=team_rank)
        hinted_team_by_room_id[room.id] = selected_team
        team_remaining_load[selected_team] -= len(room_beds)
        team_remaining_rn_load[selected_team] -= red_bed_count
        team_assigned_count[selected_team] += len(room_beds)
        team_assigned_acuity[selected_team] += room_acuity
        for team_index in range(input_model.team_count):
            model.add_hint(
                assignment.structure.room_team[(room.ordinal, team_index)],
                int(team_index == selected_team),
            )

    hinted_owner_by_bed_ordinal: dict[int, int | None] = {}
    for team_index, team_nurses in enumerate(teams):
        team_beds = [
            bed
            for bed in input_model.occupied_beds
            if hinted_team_by_room_id[bed.room_id] == team_index
        ]
        total_team_acuity = sum(bed.acuity_weight for bed in team_beds)
        target_acuity = (total_team_acuity + len(team_nurses) - 1) // len(team_nurses)
        target_count = (len(team_beds) + len(team_nurses) - 1) // len(team_nurses)

        # Allocate red beds first because only RNs can own them, then heavier
        # remaining beds. Prefer nurses still below both balanced targets.
        ordered_team_beds = sorted(
            team_beds,
            key=lambda bed: (
                bed.acuity != "red",
                -bed.acuity_weight,
                bed.ordinal,
            ),
        )
        for bed in ordered_team_beds:
            eligible_nurses = [
                nurse_ordinal
                for nurse_ordinal in team_nurses
                if remaining_load[nurse_ordinal] > 0
                and (
                    bed.acuity != "red"
                    or nurse_by_ordinal[nurse_ordinal].license_type == "RN"
                )
            ]
            owner_ordinal = (
                min(
                    eligible_nurses,
                    key=lambda nurse_ordinal: (
                        int(
                            assigned_acuity[nurse_ordinal] + bed.acuity_weight
                            > target_acuity
                        ),
                        int(assigned_count[nurse_ordinal] + 1 > target_count),
                        assigned_acuity[nurse_ordinal],
                        assigned_count[nurse_ordinal],
                        nurse_ordinal,
                    ),
                )
                if eligible_nurses
                else None
            )
            hinted_owner_by_bed_ordinal[bed.ordinal] = owner_ordinal
            if owner_ordinal is not None:
                remaining_load[owner_ordinal] -= 1
                assigned_count[owner_ordinal] += 1
                assigned_acuity[owner_ordinal] += bed.acuity_weight

    for bed in input_model.occupied_beds:
        owner_ordinal = hinted_owner_by_bed_ordinal.get(bed.ordinal)
        for nurse in input_model.nurses:
            owner_choice = assignment.bed_nurse.get((bed.ordinal, nurse.ordinal))
            if owner_choice is not None:
                model.add_hint(owner_choice, int(nurse.ordinal == owner_ordinal))
        model.add_hint(
            assignment.bed_unassigned[bed.ordinal],
            int(owner_ordinal is None),
        )

    return hinted_owner_by_bed_ordinal
