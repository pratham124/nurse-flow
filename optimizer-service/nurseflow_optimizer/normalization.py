"""Validate and normalize the server-authoritative NurseFlow shift snapshot."""

from __future__ import annotations

import hashlib
import json
import math
from collections.abc import Mapping
from typing import Any, cast

from .models import (
    Acuity,
    ExperienceLevel,
    InputValidationIssue,
    LicenseType,
    LoadLimitRange,
    NormalizationResult,
    NormalizedDoctorSide,
    NormalizedNurse,
    NormalizedOccupiedBed,
    NormalizedOptimizerInput,
    NormalizedRoom,
    OptimizerInputValidationError,
)

ACUITY_WEIGHTS: dict[str, int] = {"green": 1, "yellow": 2, "red": 3}
EXPERIENCE_LEVELS = {"new_grad", "mid", "experienced"}
LICENSE_TYPES = {"RN", "LPN"}
MAX_ROOMS = 200
MAX_BEDS = 400
MAX_NURSES = 40
MAX_PATIENT_LOAD = 12


def _issue(
    issues: list[InputValidationIssue], code: str, path: str, message: str
) -> None:
    """Add one validation issue without stopping the remaining checks."""

    issues.append(InputValidationIssue(code=code, path=path, message=message))


def _read_records(
    snapshot: Mapping[str, Any], field: str, issues: list[InputValidationIssue]
) -> list[Mapping[str, Any]]:
    """Read an array of objects while collecting all malformed entries."""

    value = snapshot.get(field)
    if not isinstance(value, list):
        _issue(issues, "invalid_collection", field, "must be an array")
        return []

    records: list[Mapping[str, Any]] = []
    for index, record in enumerate(value):
        if not isinstance(record, Mapping):
            _issue(
                issues,
                "invalid_record",
                f"{field}[{index}]",
                "must be an object",
            )
            continue
        records.append(record)
    return records


def _read_id(
    record: Mapping[str, Any], path: str, issues: list[InputValidationIssue]
) -> str | None:
    """Read one required, non-empty record ID."""

    value = record.get("id")
    if not isinstance(value, str) or not value.strip():
        _issue(issues, "invalid_id", f"{path}.id", "must be a non-empty string")
        return None
    return value


def _collect_ids(
    records: list[Mapping[str, Any]], field: str, issues: list[InputValidationIssue]
) -> list[str | None]:
    """Read record IDs and report duplicates while preserving source order."""

    ids: list[str | None] = []
    seen: set[str] = set()
    for index, record in enumerate(records):
        record_id = _read_id(record, f"{field}[{index}]", issues)
        ids.append(record_id)
        if record_id is None:
            continue
        if record_id in seen:
            _issue(
                issues,
                "duplicate_id",
                f"{field}[{index}].id",
                f"duplicates {record_id}",
            )
        seen.add(record_id)
    return ids


def _read_load_limit(
    value: Any, path: str, issues: list[InputValidationIssue]
) -> LoadLimitRange | None:
    """Validate one side-load guidance range."""

    if not isinstance(value, Mapping):
        _issue(issues, "invalid_side_limits", path, "must be an object")
        return None

    minimum = value.get("min")
    maximum = value.get("max")
    if (
        isinstance(minimum, bool)
        or not isinstance(minimum, int)
        or isinstance(maximum, bool)
        or not isinstance(maximum, int)
    ):
        _issue(
            issues,
            "invalid_side_limits",
            path,
            "minimum and maximum must be whole numbers",
        )
        return None
    if (
        minimum < 1
        or maximum < 1
        or minimum > MAX_PATIENT_LOAD
        or maximum > MAX_PATIENT_LOAD
    ):
        _issue(
            issues,
            "invalid_side_limits",
            path,
            f"minimum and maximum must be between 1 and {MAX_PATIENT_LOAD}",
        )
        return None
    if minimum > maximum:
        _issue(
            issues,
            "invalid_side_limits",
            path,
            "minimum cannot be greater than maximum",
        )
        return None
    return LoadLimitRange(minimum=minimum, maximum=maximum)


def _get_team_count(nurse_count: int) -> int:
    """Choose one team for one nurse, otherwise about four nurses per team."""

    return 1 if nurse_count == 1 else max(2, math.ceil(nurse_count / 4))


def _fingerprint(model: NormalizedOptimizerInput) -> str:
    """Hash only the canonical, assignment-relevant input."""

    canonical_json = json.dumps(
        model.to_dict(), ensure_ascii=False, separators=(",", ":"), sort_keys=True
    )
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def normalize_shift_snapshot(snapshot: Mapping[str, Any]) -> NormalizationResult:
    """Return canonical solver input or all discovered pre-solve validation issues."""

    issues: list[InputValidationIssue] = []

    # Phase 1: read every top-level collection. These helpers collect errors
    # instead of stopping at the first problem, so the caller gets one report.
    doctor_sides = _read_records(snapshot, "doctorSides", issues)
    rooms = _read_records(snapshot, "rooms", issues)
    beds = _read_records(snapshot, "beds", issues)
    bed_states = _read_records(snapshot, "bedStates", issues)
    nurses = _read_records(snapshot, "nurses", issues)

    # Phase 2: enforce the service's supported input-size ceilings.
    if len(doctor_sides) != 2:
        _issue(
            issues,
            "unsupported_side_count",
            "doctorSides",
            "must contain exactly 2 sides",
        )
    if not 1 <= len(rooms) <= MAX_ROOMS:
        _issue(
            issues,
            "unsupported_room_count",
            "rooms",
            f"must contain 1 to {MAX_ROOMS} rooms",
        )
    if not 1 <= len(beds) <= MAX_BEDS:
        _issue(
            issues,
            "unsupported_bed_count",
            "beds",
            f"must contain 1 to {MAX_BEDS} beds",
        )
    if not 1 <= len(nurses) <= MAX_NURSES:
        _issue(
            issues,
            "unsupported_nurse_count",
            "nurses",
            f"must contain 1 to {MAX_NURSES} nurses",
        )

    # Phase 3: validate IDs before checking cross-record relationships.
    side_ids = _collect_ids(doctor_sides, "doctorSides", issues)
    room_ids = _collect_ids(rooms, "rooms", issues)
    bed_ids = _collect_ids(beds, "beds", issues)
    _collect_ids(bed_states, "bedStates", issues)
    nurse_ids = _collect_ids(nurses, "nurses", issues)

    known_side_ids = {side_id for side_id in side_ids if side_id is not None}
    known_room_ids = {room_id for room_id in room_ids if room_id is not None}
    known_bed_ids = {bed_id for bed_id in bed_ids if bed_id is not None}

    admitting_side_id = snapshot.get("admittingDoctorSideId")
    if not isinstance(admitting_side_id, str) or admitting_side_id not in known_side_ids:
        _issue(
            issues,
            "invalid_admitting_side",
            "admittingDoctorSideId",
            "must reference a current doctor side",
        )

    side_limits = snapshot.get("sideLoadLimits")
    if not isinstance(side_limits, Mapping):
        _issue(issues, "invalid_side_limits", "sideLoadLimits", "must be an object")
        admitting_limit = None
        non_admitting_limit = None
    else:
        admitting_limit = _read_load_limit(
            side_limits.get("admitting"),
            "sideLoadLimits.admitting",
            issues,
        )
        non_admitting_limit = _read_load_limit(
            side_limits.get("nonAdmitting"), "sideLoadLimits.nonAdmitting", issues
        )

    # Rooms must point to current sides, and beds must point to current rooms.
    for index, room in enumerate(rooms):
        side_id = room.get("doctorSideId")
        if not isinstance(side_id, str) or side_id not in known_side_ids:
            _issue(
                issues,
                "broken_room_side",
                f"rooms[{index}].doctorSideId",
                "must reference a current doctor side",
            )

    for index, bed in enumerate(beds):
        room_id = bed.get("roomId")
        if not isinstance(room_id, str) or room_id not in known_room_ids:
            _issue(
                issues,
                "broken_bed_room",
                f"beds[{index}].roomId",
                "must reference a current room",
            )
        bed_number = bed.get("bedNumber")
        if (
            isinstance(bed_number, bool)
            or not isinstance(bed_number, int)
            or bed_number < 1
        ):
            _issue(
                issues,
                "invalid_bed_number",
                f"beds[{index}].bedNumber",
                "must be a positive whole number",
            )

    # Phase 4: identify occupied beds. A bed participates only when it has a
    # patient with non-empty initials and a valid acuity.
    occupied_state_by_bed_id: dict[str, Mapping[str, Any]] = {}
    seen_state_bed_ids: set[str] = set()
    for index, bed_state in enumerate(bed_states):
        bed_id = bed_state.get("bedId")
        if not isinstance(bed_id, str) or bed_id not in known_bed_ids:
            _issue(
                issues,
                "broken_bed_state",
                f"bedStates[{index}].bedId",
                "must reference a current bed",
            )
            continue
        if bed_id in seen_state_bed_ids:
            _issue(
                issues,
                "duplicate_bed_state",
                f"bedStates[{index}].bedId",
                f"duplicates the current state for {bed_id}",
            )
            continue
        seen_state_bed_ids.add(bed_id)

        patient = bed_state.get("patient")
        if patient is None:
            continue
        if not isinstance(patient, Mapping):
            _issue(
                issues,
                "invalid_patient",
                f"bedStates[{index}].patient",
                "must be an object",
            )
            continue
        initials = patient.get("initials")
        if initials is None:
            continue
        if not isinstance(initials, str):
            _issue(
                issues,
                "invalid_patient_initials",
                f"bedStates[{index}].patient.initials",
                "must be a string",
            )
            continue
        if not initials.strip():
            continue

        acuity = bed_state.get("acuity")
        if acuity is None:
            _issue(
                issues,
                "missing_acuity",
                f"bedStates[{index}].acuity",
                "is required for an occupied bed",
            )
            continue
        if acuity not in ACUITY_WEIGHTS:
            _issue(
                issues,
                "invalid_acuity",
                f"bedStates[{index}].acuity",
                "must be green, yellow, or red",
            )
            continue
        occupied_state_by_bed_id[bed_id] = bed_state

    # Phase 5: validate nurse qualifications and hard maximum loads.
    side_based_maximum = (
        max(admitting_limit.maximum, non_admitting_limit.maximum)
        if admitting_limit is not None and non_admitting_limit is not None
        else None
    )
    for index, nurse in enumerate(nurses):
        license_type = nurse.get("licenseType")
        if license_type not in LICENSE_TYPES:
            _issue(
                issues,
                "invalid_license_type",
                f"nurses[{index}].licenseType",
                "must be RN or LPN",
            )
        experience_level = nurse.get("experienceLevel")
        if experience_level not in EXPERIENCE_LEVELS:
            _issue(
                issues,
                "invalid_experience_level",
                f"nurses[{index}].experienceLevel",
                "must be new_grad, mid, or experienced",
            )
        max_load = nurse.get("maxPatientLoad")
        if isinstance(max_load, bool) or not isinstance(max_load, int):
            _issue(
                issues,
                "invalid_max_load",
                f"nurses[{index}].maxPatientLoad",
                "must be a whole number",
            )
        elif not 1 <= max_load <= MAX_PATIENT_LOAD:
            _issue(
                issues,
                "invalid_max_load",
                f"nurses[{index}].maxPatientLoad",
                f"must be between 1 and {MAX_PATIENT_LOAD}",
            )
        elif side_based_maximum is not None and max_load > side_based_maximum:
            _issue(
                issues,
                "invalid_max_load",
                f"nurses[{index}].maxPatientLoad",
                f"cannot exceed the side-based maximum of {side_based_maximum}",
            )

    if len(occupied_state_by_bed_id) > MAX_BEDS:
        _issue(
            issues,
            "unsupported_occupied_bed_count",
            "bedStates",
            f"cannot contain more than {MAX_BEDS} occupied beds",
        )

    # Do not construct solver data from partially valid input. All casts below
    # are safe because every invalid branch above has already added an issue.
    if issues:
        raise OptimizerInputValidationError(issues)

    valid_admitting_side_id = cast(str, admitting_side_id)
    valid_admitting_limit = cast(LoadLimitRange, admitting_limit)
    valid_non_admitting_limit = cast(LoadLimitRange, non_admitting_limit)

    # Phase 6: build deterministic, solver-friendly objects. "ordinal" is the
    # compact internal index; "snapshot_ordinal" preserves source order.
    side_snapshot_ordinal: dict[str, int] = {}
    for index, side_id in enumerate(side_ids):
        side_snapshot_ordinal[cast(str, side_id)] = index

    canonical_side_ids = sorted(
        (cast(str, side_id) for side_id in side_ids),
        key=lambda side_id: (side_snapshot_ordinal[side_id], side_id),
    )

    normalized_sides_list: list[NormalizedDoctorSide] = []
    for index, side_id in enumerate(canonical_side_ids):
        normalized_sides_list.append(
            NormalizedDoctorSide(id=side_id, ordinal=index)
        )
    normalized_sides = tuple(normalized_sides_list)
    side_ordinal = {side.id: side.ordinal for side in normalized_sides}

    room_snapshot_ordinal: dict[str, int] = {}
    room_by_id: dict[str, Mapping[str, Any]] = {}
    for index, (room_id, room) in enumerate(zip(room_ids, rooms, strict=True)):
        valid_room_id = cast(str, room_id)
        room_snapshot_ordinal[valid_room_id] = index
        room_by_id[valid_room_id] = room

    canonical_room_ids = sorted(
        room_by_id,
        key=lambda room_id: (
            side_ordinal[cast(str, room_by_id[room_id]["doctorSideId"])],
            room_snapshot_ordinal[room_id],
            room_id,
        ),
    )
    normalized_rooms_list: list[NormalizedRoom] = []
    for index, room_id in enumerate(canonical_room_ids):
        source_room = room_by_id[room_id]
        doctor_side_id = cast(str, source_room["doctorSideId"])
        normalized_rooms_list.append(
            NormalizedRoom(
                id=room_id,
                doctor_side_id=doctor_side_id,
                ordinal=index,
                side_ordinal=side_ordinal[doctor_side_id],
                snapshot_ordinal=room_snapshot_ordinal[room_id],
            )
        )
    normalized_rooms = tuple(normalized_rooms_list)
    normalized_room_by_id = {room.id: room for room in normalized_rooms}

    bed_snapshot_ordinal: dict[str, int] = {}
    bed_by_id: dict[str, Mapping[str, Any]] = {}
    for index, (bed_id, bed) in enumerate(zip(bed_ids, beds, strict=True)):
        valid_bed_id = cast(str, bed_id)
        bed_snapshot_ordinal[valid_bed_id] = index
        bed_by_id[valid_bed_id] = bed

    canonical_bed_ids = sorted(
        bed_by_id,
        key=lambda bed_id: (
            normalized_room_by_id[cast(str, bed_by_id[bed_id]["roomId"])].ordinal,
            cast(int, bed_by_id[bed_id]["bedNumber"]),
            bed_snapshot_ordinal[bed_id],
            bed_id,
        ),
    )
    participating_bed_ids: list[str] = []
    for bed_id in canonical_bed_ids:
        if bed_id in occupied_state_by_bed_id:
            participating_bed_ids.append(bed_id)

    normalized_beds_list: list[NormalizedOccupiedBed] = []
    for index, bed_id in enumerate(participating_bed_ids):
        source_bed = bed_by_id[bed_id]
        source_state = occupied_state_by_bed_id[bed_id]
        room_id = cast(str, source_bed["roomId"])
        normalized_room = normalized_room_by_id[room_id]
        acuity = cast(Acuity, source_state["acuity"])
        normalized_beds_list.append(
            NormalizedOccupiedBed(
                id=bed_id,
                room_id=room_id,
                doctor_side_id=normalized_room.doctor_side_id,
                acuity=acuity,
                acuity_weight=ACUITY_WEIGHTS[acuity],
                bed_number=cast(int, source_bed["bedNumber"]),
                ordinal=index,
                room_ordinal=normalized_room.ordinal,
                snapshot_ordinal=bed_snapshot_ordinal[bed_id],
            )
        )
    normalized_beds = tuple(normalized_beds_list)

    nurse_snapshot_ordinal: dict[str, int] = {}
    nurse_by_id: dict[str, Mapping[str, Any]] = {}
    for index, (nurse_id, nurse) in enumerate(zip(nurse_ids, nurses, strict=True)):
        valid_nurse_id = cast(str, nurse_id)
        nurse_snapshot_ordinal[valid_nurse_id] = index
        nurse_by_id[valid_nurse_id] = nurse

    canonical_nurse_ids = sorted(
        nurse_by_id,
        key=lambda nurse_id: (nurse_snapshot_ordinal[nurse_id], nurse_id),
    )
    normalized_nurses_list: list[NormalizedNurse] = []
    for index, nurse_id in enumerate(canonical_nurse_ids):
        source_nurse = nurse_by_id[nurse_id]
        normalized_nurses_list.append(
            NormalizedNurse(
                id=nurse_id,
                license_type=cast(LicenseType, source_nurse["licenseType"]),
                experience_level=cast(
                    ExperienceLevel, source_nurse["experienceLevel"]
                ),
                max_patient_load=cast(int, source_nurse["maxPatientLoad"]),
                ordinal=index,
                snapshot_ordinal=nurse_snapshot_ordinal[nurse_id],
            )
        )
    normalized_nurses = tuple(normalized_nurses_list)

    model = NormalizedOptimizerInput(
        admitting_doctor_side_id=valid_admitting_side_id,
        admitting_load_limit=valid_admitting_limit,
        non_admitting_load_limit=valid_non_admitting_limit,
        doctor_sides=normalized_sides,
        rooms=normalized_rooms,
        occupied_beds=normalized_beds,
        nurses=normalized_nurses,
        team_count=_get_team_count(len(normalized_nurses)),
    )
    return NormalizationResult(model=model, fingerprint=_fingerprint(model))
