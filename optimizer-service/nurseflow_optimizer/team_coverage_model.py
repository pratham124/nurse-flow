"""CP-SAT variables and constraints for generated teams and room coverage."""

from __future__ import annotations

import math
from dataclasses import dataclass

from ortools.sat.python import cp_model

from .models import NormalizedOptimizerInput


@dataclass(frozen=True)
class GeneratedTeamDecision:
    label: str
    nurse_ids: tuple[str, ...]


@dataclass(frozen=True)
class RoomCoverageDecision:
    room_id: str
    team_label: str | None
    nurse_ids: tuple[str, ...]


@dataclass(frozen=True)
class TeamCoverageDecision:
    teams: tuple[GeneratedTeamDecision, ...]
    rooms: tuple[RoomCoverageDecision, ...]


@dataclass(frozen=True)
class TeamCoverageModel:
    input: NormalizedOptimizerInput
    model: cp_model.CpModel
    nurse_team: dict[tuple[int, int], cp_model.IntVar]
    room_team: dict[tuple[int, int], cp_model.IntVar]
    team_labels: tuple[str, ...]


def _spreadsheet_label(index: int) -> str:
    """Return Team A through Team J for the supported ten-team ceiling."""

    return f"Team {chr(ord('A') + index)}"


def build_team_coverage_model(input_model: NormalizedOptimizerInput) -> TeamCoverageModel:
    """Build the team-membership and occupied-room coverage constraints."""

    model = cp_model.CpModel()
    team_labels = tuple(
        _spreadsheet_label(team_index)
        for team_index in range(input_model.team_count)
    )

    # Create one yes/no decision variable for every possible nurse-team pairing.
    # A solved value of 1 means the nurse belongs to that team; 0 means they do not.
    nurse_team: dict[tuple[int, int], cp_model.IntVar] = {}
    for nurse in input_model.nurses:
        for team_index in range(input_model.team_count):
            nurse_team_key = (nurse.ordinal, team_index)
            variable_name = f"nurse_{nurse.ordinal}_team_{team_index}"
            team_choice = model.new_bool_var(variable_name)
            nurse_team[nurse_team_key] = team_choice

    # Give the solver all possible team choices for each nurse, then require it
    # to select exactly one. This prevents a nurse having zero or multiple teams.
    for nurse in input_model.nurses:
        team_choices: list[cp_model.IntVar] = []
        for team_index in range(input_model.team_count):
            nurse_team_key = (nurse.ordinal, team_index)
            team_choices.append(nurse_team[nurse_team_key])

        model.add_exactly_one(team_choices)

    lower_team_size = len(input_model.nurses) // input_model.team_count
    upper_team_size = math.ceil(len(input_model.nurses) / input_model.team_count)

    # Keep generated team sizes as even as whole nurses allow. For example,
    # five nurses across two teams must produce sizes of two and three.
    for team_index in range(input_model.team_count):
        nurses_on_team = [
            nurse_team[(nurse.ordinal, team_index)]
            for nurse in input_model.nurses
        ]
        team_size = sum(nurses_on_team)
        model.add(team_size >= lower_team_size)
        model.add(team_size <= upper_team_size)

    # Empty rooms cannot affect an assignment, so only occupied rooms receive
    # room-team decision variables.
    occupied_room_ids = {bed.room_id for bed in input_model.occupied_beds}
    room_team: dict[tuple[int, int], cp_model.IntVar] = {}
    for room in input_model.rooms:
        if room.id not in occupied_room_ids:
            continue

        for team_index in range(input_model.team_count):
            room_team_key = (room.ordinal, team_index)
            variable_name = f"room_{room.ordinal}_team_{team_index}"
            room_team[room_team_key] = model.new_bool_var(variable_name)

    # Every occupied room must be covered by exactly one generated team.
    for room in input_model.rooms:
        if room.id not in occupied_room_ids:
            continue

        room_team_choices: list[cp_model.IntVar] = []
        for team_index in range(input_model.team_count):
            room_team_key = (room.ordinal, team_index)
            room_team_choices.append(room_team[room_team_key])

        model.add_exactly_one(room_team_choices)

    return TeamCoverageModel(
        input=input_model,
        model=model,
        nurse_team=nurse_team,
        room_team=room_team,
        team_labels=team_labels,
    )


def read_team_coverage_decision(
    structure: TeamCoverageModel, solver: cp_model.CpSolver
) -> TeamCoverageDecision:
    """Project one solved structural model into canonical team and coverage data."""

    # Convert solved 0/1 variables into ordinary nurse IDs for each team.
    teams_list: list[GeneratedTeamDecision] = []
    for team_index, team_label in enumerate(structure.team_labels):
        nurse_ids: list[str] = []
        for nurse in structure.input.nurses:
            nurse_team_key = (nurse.ordinal, team_index)
            if solver.value(structure.nurse_team[nurse_team_key]) == 1:
                nurse_ids.append(nurse.id)

        teams_list.append(
            GeneratedTeamDecision(label=team_label, nurse_ids=tuple(nurse_ids))
        )
    teams = tuple(teams_list)

    team_by_index = {index: team for index, team in enumerate(teams)}
    occupied_room_ids = {bed.room_id for bed in structure.input.occupied_beds}
    rooms: list[RoomCoverageDecision] = []

    for room in structure.input.rooms:
        if room.id not in occupied_room_ids:
            rooms.append(RoomCoverageDecision(room_id=room.id, team_label=None, nurse_ids=()))
            continue

        selected_team_index: int | None = None
        for team_index in range(structure.input.team_count):
            room_team_key = (room.ordinal, team_index)
            if solver.value(structure.room_team[room_team_key]) == 1:
                selected_team_index = team_index
                break

        if selected_team_index is None:
            raise RuntimeError(f"occupied room {room.id} has no selected team")

        selected_team = team_by_index[selected_team_index]
        rooms.append(
            RoomCoverageDecision(
                room_id=room.id,
                team_label=selected_team.label,
                nurse_ids=selected_team.nurse_ids,
            )
        )

    return TeamCoverageDecision(teams=teams, rooms=tuple(rooms))
