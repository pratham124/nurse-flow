"""Immutable data contracts used by the assignment optimizer core."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Acuity = Literal["green", "yellow", "red"]
ExperienceLevel = Literal["new_grad", "mid", "experienced"]
LicenseType = Literal["RN", "LPN"]


@dataclass(frozen=True)
class LoadLimitRange:
    """Recommended patient-load range for one doctor-side category."""

    minimum: int
    maximum: int

    def to_dict(self) -> dict[str, int]:
        return {"min": self.minimum, "max": self.maximum}


@dataclass(frozen=True)
class NormalizedDoctorSide:
    """Doctor-side identity plus its small internal solver index."""

    id: str
    ordinal: int

    def to_dict(self) -> dict[str, int | str]:
        return {"id": self.id, "ordinal": self.ordinal}


@dataclass(frozen=True)
class NormalizedRoom:
    """Validated room data and the indexes used for canonical ordering."""

    id: str
    doctor_side_id: str
    ordinal: int
    side_ordinal: int
    snapshot_ordinal: int

    def to_dict(self) -> dict[str, int | str]:
        return {
            "id": self.id,
            "doctorSideId": self.doctor_side_id,
            "ordinal": self.ordinal,
            "sideOrdinal": self.side_ordinal,
            "snapshotOrdinal": self.snapshot_ordinal,
        }


@dataclass(frozen=True)
class NormalizedOccupiedBed:
    """One occupied bed containing only assignment-relevant information."""

    id: str
    room_id: str
    doctor_side_id: str
    acuity: Acuity
    acuity_weight: int
    bed_number: int
    ordinal: int
    room_ordinal: int
    snapshot_ordinal: int

    def to_dict(self) -> dict[str, int | str]:
        return {
            "id": self.id,
            "roomId": self.room_id,
            "doctorSideId": self.doctor_side_id,
            "acuity": self.acuity,
            "acuityWeight": self.acuity_weight,
            "bedNumber": self.bed_number,
            "ordinal": self.ordinal,
            "roomOrdinal": self.room_ordinal,
            "snapshotOrdinal": self.snapshot_ordinal,
        }


@dataclass(frozen=True)
class NormalizedNurse:
    """One nurse containing only fields that can change an assignment."""

    id: str
    license_type: LicenseType
    experience_level: ExperienceLevel
    max_patient_load: int
    ordinal: int
    snapshot_ordinal: int

    def to_dict(self) -> dict[str, int | str]:
        return {
            "id": self.id,
            "licenseType": self.license_type,
            "experienceLevel": self.experience_level,
            "maxPatientLoad": self.max_patient_load,
            "ordinal": self.ordinal,
            "snapshotOrdinal": self.snapshot_ordinal,
        }


@dataclass(frozen=True)
class NormalizedOptimizerInput:
    """Complete validated, canonical input consumed by the solver."""

    admitting_doctor_side_id: str
    admitting_load_limit: LoadLimitRange
    non_admitting_load_limit: LoadLimitRange
    doctor_sides: tuple[NormalizedDoctorSide, ...]
    rooms: tuple[NormalizedRoom, ...]
    occupied_beds: tuple[NormalizedOccupiedBed, ...]
    nurses: tuple[NormalizedNurse, ...]
    team_count: int
    schema_version: int = 1

    def to_dict(self) -> dict[str, object]:
        return {
            "schemaVersion": self.schema_version,
            "admittingDoctorSideId": self.admitting_doctor_side_id,
            "sideLoadLimits": {
                "admitting": self.admitting_load_limit.to_dict(),
                "nonAdmitting": self.non_admitting_load_limit.to_dict(),
            },
            "teamCount": self.team_count,
            "doctorSides": [side.to_dict() for side in self.doctor_sides],
            "rooms": [room.to_dict() for room in self.rooms],
            "occupiedBeds": [bed.to_dict() for bed in self.occupied_beds],
            "nurses": [nurse.to_dict() for nurse in self.nurses],
        }


@dataclass(frozen=True)
class NormalizationResult:
    """Normalized input plus its deterministic SHA-256 fingerprint."""

    model: NormalizedOptimizerInput
    fingerprint: str


@dataclass(frozen=True)
class InputValidationIssue:
    """One validation problem with a machine code and source-data path."""

    code: str
    path: str
    message: str


class OptimizerInputValidationError(ValueError):
    """Raised when a shift snapshot is unsafe to pass to the solver."""

    def __init__(self, issues: list[InputValidationIssue]) -> None:
        self.issues = tuple(issues)
        summary = "; ".join(f"{issue.path}: {issue.message}" for issue in issues)
        super().__init__(summary)
