from __future__ import annotations

import copy


def build_synthetic_shift_snapshot(
    *,
    scenario_id: str,
    room_bed_counts: list[int],
    nurse_count: int,
    max_patient_load: int,
    understaffed: bool = False,
) -> dict[str, object]:
    """Build deterministic mixed-side, mixed-license synthetic shift data."""

    doctor_sides = [
        {"id": "side-a", "name": "Synthetic Side A"},
        {"id": "side-b", "name": "Synthetic Side B"},
    ]
    rooms: list[dict[str, object]] = []
    beds: list[dict[str, object]] = []
    bed_states: list[dict[str, object]] = []
    acuities = ("red", "yellow", "green", "green", "yellow")

    bed_ordinal = 0
    for room_ordinal, bed_count in enumerate(room_bed_counts):
        room_id = f"room-{room_ordinal + 1:03d}"
        rooms.append(
            {
                "id": room_id,
                "doctorSideId": "side-a" if room_ordinal % 2 == 0 else "side-b",
                "label": str(room_ordinal + 1),
                "bedCount": bed_count,
            }
        )
        for bed_number in range(1, bed_count + 1):
            bed_ordinal += 1
            bed_id = f"bed-{bed_ordinal:03d}"
            beds.append(
                {
                    "id": bed_id,
                    "roomId": room_id,
                    "label": str(bed_number),
                    "bedNumber": bed_number,
                }
            )
            bed_states.append(
                {
                    "id": f"state-{bed_id}",
                    "bedId": bed_id,
                    "patient": {
                        "initials": f"P{bed_ordinal}",
                        "diagnosis": "Synthetic test data",
                    },
                    "acuity": acuities[(bed_ordinal - 1) % len(acuities)],
                }
            )

    nurses: list[dict[str, object]] = []
    experience_levels = ("experienced", "mid", "new_grad")
    for nurse_ordinal in range(nurse_count):
        nurses.append(
            {
                "id": f"nurse-{nurse_ordinal + 1:02d}",
                "name": f"Synthetic Nurse {nurse_ordinal + 1}",
                "licenseType": "LPN" if nurse_ordinal % 3 == 2 else "RN",
                "experienceLevel": experience_levels[
                    nurse_ordinal % len(experience_levels)
                ],
                "maxPatientLoad": max_patient_load,
            }
        )

    return {
        "id": f"shift-{scenario_id}",
        "floorName": "Synthetic Optimizer Floor",
        "admittingDoctorSideId": "side-a",
        "sideLoadLimits": {
            "admitting": {"min": 1, "max": max_patient_load},
            "nonAdmitting": {"min": 1, "max": max_patient_load},
        },
        "doctorSides": doctor_sides,
        "rooms": rooms,
        "beds": beds,
        "bedStates": bed_states,
        "nurses": nurses,
        "flags": [],
        "status": "setup",
        "syntheticUnderstaffedLabel": understaffed,
    }


def build_complex_shift_snapshot() -> dict[str, object]:
    """Cover uneven census, both sides, mixed nurses, red pressure, and ties."""

    return build_synthetic_shift_snapshot(
        scenario_id="complex",
        room_bed_counts=[1, 2, 3] * 6,
        nurse_count=8,
        max_patient_load=5,
    )


def build_maximum_shift_snapshot(*, understaffed: bool) -> dict[str, object]:
    """Build the measured 25-room, 50-bed, 12-nurse supported ceiling."""

    # 6 one-bed rooms + 13 two-bed rooms + 6 three-bed rooms = 50 beds.
    room_bed_counts = [1] * 6 + [2] * 13 + [3] * 6
    return build_synthetic_shift_snapshot(
        scenario_id="maximum-understaffed" if understaffed else "maximum-full",
        room_bed_counts=room_bed_counts,
        nurse_count=12,
        max_patient_load=4 if understaffed else 5,
        understaffed=understaffed,
    )


def build_required_large_shift_snapshot(*, understaffed: bool) -> dict[str, object]:
    """Build the measured 20-room, 80-bed, 12-nurse large-floor ceiling."""

    return build_synthetic_shift_snapshot(
        scenario_id=(
            "required-large-understaffed" if understaffed else "required-large-full"
        ),
        room_bed_counts=[4] * 20,
        nurse_count=12,
        max_patient_load=4 if understaffed else 7,
        understaffed=understaffed,
    )


def perturb_incidental_snapshot_order(snapshot: dict[str, object]) -> dict[str, object]:
    """Change only input details that must not affect canonical decisions."""

    perturbed = copy.deepcopy(snapshot)
    bed_states = list(perturbed["bedStates"])
    bed_states.reverse()
    for index, bed_state in enumerate(bed_states):
        bed_state["patient"]["diagnosis"] = f"Ignored diagnosis {index}"
    perturbed["bedStates"] = bed_states
    perturbed["flags"] = [{"id": "ignored-existing-flag"}]
    return perturbed
