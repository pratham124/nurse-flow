from __future__ import annotations

import copy
import json
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = SERVICE_ROOT.parent
FIXTURE_PATH = REPOSITORY_ROOT / "tests" / "fixtures" / "phase9OptimizerFixtures.json"


def load_fixture_catalog() -> dict:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def build_shift_snapshot(fixture: dict) -> dict:
    fixture_input = fixture["input"]
    occupied_beds = fixture_input["occupiedBeds"]
    beds = [
        {
            "id": bed["id"],
            "roomId": bed["roomId"],
            "label": str(index + 1),
            "bedNumber": index + 1,
        }
        for index, bed in enumerate(occupied_beds)
    ]
    bed_states = [
        {
            "id": f"state-{bed['id']}",
            "bedId": bed["id"],
            "patient": {
                "initials": f"P{index + 1}",
                "age": 30 + index,
                "diagnosis": "Synthetic fixture text",
            },
            "acuity": bed["acuity"],
        }
        for index, bed in enumerate(occupied_beds)
    ]

    if not beds:
        first_room_id = fixture_input["rooms"][0]["id"]
        beds.append(
            {"id": "empty-bed-1", "roomId": first_room_id, "label": "1", "bedNumber": 1}
        )
        bed_states.append(
            {
                "id": "state-empty-bed-1",
                "bedId": "empty-bed-1",
                "patient": {"initials": "   ", "diagnosis": "Ignored"},
            }
        )

    return {
        "id": f"shift-{fixture['id']}",
        "floorName": "Synthetic Test Floor",
        "admittingDoctorSideId": fixture_input["admittingDoctorSideId"],
        "sideLoadLimits": copy.deepcopy(fixture_input["sideLoadLimits"]),
        "doctorSides": [
            {"id": side_id, "name": f"Synthetic {side_id}"}
            for side_id in fixture_input["doctorSides"]
        ],
        "rooms": [
            {
                "id": room["id"],
                "doctorSideId": room["doctorSideId"],
                "label": room["id"],
                "bedCount": sum(1 for bed in beds if bed["roomId"] == room["id"]),
            }
            for room in fixture_input["rooms"]
        ],
        "beds": beds,
        "bedStates": bed_states,
        "nurses": [
            {**copy.deepcopy(nurse), "name": f"Synthetic {nurse['id']}"}
            for nurse in fixture_input["nurses"]
        ],
        "flags": [],
        "status": "setup",
    }
