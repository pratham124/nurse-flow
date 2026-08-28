from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = SERVICE_ROOT.parent
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from nurseflow_optimizer import (  # noqa: E402
    OptimizerInputValidationError,
    normalize_shift_snapshot,
)
from fixture_helpers import build_shift_snapshot, load_fixture_catalog  # noqa: E402
from scenario_helpers import (  # noqa: E402
    build_maximum_shift_snapshot,
    build_required_large_shift_snapshot,
    build_synthetic_shift_snapshot,
)


def fixture_contract(normalized: dict) -> dict:
    return {
        "admittingDoctorSideId": normalized["admittingDoctorSideId"],
        "sideLoadLimits": normalized["sideLoadLimits"],
        "doctorSides": [side["id"] for side in normalized["doctorSides"]],
        "rooms": [
            {"id": room["id"], "doctorSideId": room["doctorSideId"]}
            for room in normalized["rooms"]
        ],
        "occupiedBeds": [
            {"id": bed["id"], "roomId": bed["roomId"], "acuity": bed["acuity"]}
            for bed in normalized["occupiedBeds"]
        ],
        "nurses": [
            {
                "id": nurse["id"],
                "licenseType": nurse["licenseType"],
                "experienceLevel": nurse["experienceLevel"],
                "maxPatientLoad": nurse["maxPatientLoad"],
            }
            for nurse in normalized["nurses"]
        ],
    }


class NormalizationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixtures = load_fixture_catalog()["fixtures"]

    def test_all_canonical_fixtures_normalize_to_the_shared_contract(self) -> None:
        for fixture in self.fixtures:
            with self.subTest(fixture=fixture["id"]):
                result = normalize_shift_snapshot(build_shift_snapshot(fixture))
                self.assertEqual(fixture_contract(result.model.to_dict()), fixture["input"])
                self.assertEqual(len(result.fingerprint), 64)

    def test_incidental_bed_state_order_does_not_change_model_or_fingerprint(self) -> None:
        snapshot = build_shift_snapshot(self.fixtures[2])
        reordered = copy.deepcopy(snapshot)
        reordered["bedStates"].reverse()

        first = normalize_shift_snapshot(snapshot)
        second = normalize_shift_snapshot(reordered)

        self.assertEqual(first.model, second.model)
        self.assertEqual(first.fingerprint, second.fingerprint)

    def test_patient_free_text_and_empty_beds_do_not_change_solver_input(self) -> None:
        snapshot = build_shift_snapshot(self.fixtures[1])
        changed = copy.deepcopy(snapshot)
        changed["bedStates"][0]["patient"].update(
            {"initials": "DIFFERENT", "age": 99, "diagnosis": "Changed diagnosis"}
        )
        changed["beds"].append(
            {"id": "empty-bed-extra", "roomId": "room-a1", "label": "Empty", "bedNumber": 99}
        )
        changed["bedStates"].append(
            {
                "id": "state-empty-bed-extra",
                "bedId": "empty-bed-extra",
                "patient": {"initials": "   ", "diagnosis": "Ignored"},
            }
        )

        first = normalize_shift_snapshot(snapshot)
        second = normalize_shift_snapshot(changed)

        self.assertEqual(first.model, second.model)
        self.assertEqual(first.fingerprint, second.fingerprint)

    def test_invalid_inputs_fail_before_a_model_is_returned(self) -> None:
        base = build_shift_snapshot(self.fixtures[1])
        invalid_cases = {
            "duplicate nurse": lambda value: value["nurses"].append(
                copy.deepcopy(value["nurses"][0])
            ),
            "broken room side": lambda value: value["rooms"][0].update(
                {"doctorSideId": "missing-side"}
            ),
            "broken bed room": lambda value: value["beds"][0].update(
                {"roomId": "missing-room"}
            ),
            "missing acuity": lambda value: value["bedStates"][0].pop("acuity"),
            "invalid max load": lambda value: value["nurses"][0].update(
                {"maxPatientLoad": 0}
            ),
            "max above side limit": lambda value: value["nurses"][0].update(
                {"maxPatientLoad": 3}
            ),
            "missing admitting side": lambda value: value.update(
                {"admittingDoctorSideId": "missing-side"}
            ),
            "invalid side limits": lambda value: value["sideLoadLimits"][
                "admitting"
            ].update({"min": 3, "max": 2}),
        }

        for label, mutate in invalid_cases.items():
            with self.subTest(case=label):
                snapshot = copy.deepcopy(base)
                mutate(snapshot)
                with self.assertRaises(OptimizerInputValidationError) as raised:
                    normalize_shift_snapshot(snapshot)
                self.assertGreater(len(raised.exception.issues), 0)

    def test_inputs_above_the_measured_ceiling_are_rejected_early(self) -> None:
        maximum_25_room_snapshot = build_maximum_shift_snapshot(understaffed=False)
        maximum_20_room_snapshot = build_required_large_shift_snapshot(
            understaffed=False
        )

        too_many_rooms = copy.deepcopy(maximum_25_room_snapshot)
        too_many_rooms["rooms"].append(
            {
                "id": "room-over-limit",
                "doctorSideId": "side-a",
                "label": "Over limit",
                "bedCount": 0,
            }
        )

        too_many_beds = copy.deepcopy(maximum_20_room_snapshot)
        too_many_beds["beds"].append(
            {
                "id": "bed-over-limit",
                "roomId": "room-001",
                "label": "Over limit",
                "bedNumber": 99,
            }
        )

        too_many_nurses = copy.deepcopy(maximum_25_room_snapshot)
        extra_nurse = copy.deepcopy(too_many_nurses["nurses"][0])
        extra_nurse["id"] = "nurse-over-limit"
        too_many_nurses["nurses"].append(extra_nurse)

        for label, snapshot, expected_code in (
            ("rooms", too_many_rooms, "unsupported_room_count"),
            ("beds", too_many_beds, "unsupported_bed_count"),
            ("nurses", too_many_nurses, "unsupported_nurse_count"),
        ):
            with self.subTest(limit=label):
                with self.assertRaises(OptimizerInputValidationError) as raised:
                    normalize_shift_snapshot(snapshot)
                self.assertIn(
                    expected_code,
                    {issue.code for issue in raised.exception.issues},
                )

    def test_required_20_room_80_bed_shape_normalizes(self) -> None:
        result = normalize_shift_snapshot(
            build_required_large_shift_snapshot(understaffed=False)
        )

        self.assertEqual(len(result.model.rooms), 20)
        self.assertEqual(len(result.model.occupied_beds), 80)
        self.assertEqual(len(result.model.nurses), 12)

    def test_large_occupied_floor_rejects_more_than_20_rooms(self) -> None:
        snapshot = build_synthetic_shift_snapshot(
            scenario_id="unsupported-large-shape",
            room_bed_counts=[4] * 19 + [2, 2],
            nurse_count=12,
            max_patient_load=5,
        )

        with self.assertRaises(OptimizerInputValidationError) as raised:
            normalize_shift_snapshot(snapshot)

        self.assertIn(
            "unsupported_large_floor_shape",
            {issue.code for issue in raised.exception.issues},
        )


if __name__ == "__main__":
    unittest.main()
