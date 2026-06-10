import { createLocalId } from "./localId";
import type { FloorTemplate, PreviousShiftSnapshot, Shift } from "../types/models";

export function isCompletedFloorTemplate(floorTemplate: FloorTemplate): boolean {
  const doctorSideIds = floorTemplate.doctorSides.map(
    (doctorSide) => doctorSide.id,
  );
  const hasNamedDoctorSides =
    floorTemplate.doctorSides.length === 2 &&
    floorTemplate.doctorSides.every((doctorSide) => doctorSide.name.trim());
  const hasRooms = floorTemplate.rooms.length > 0;
  const hasValidRooms = floorTemplate.rooms.every(
    (room) =>
      room.label.trim() &&
      room.bedCount > 0 &&
      doctorSideIds.includes(room.doctorSideId),
  );
  const hasBedsForEveryRoom = floorTemplate.rooms.every((room) =>
    floorTemplate.beds.some((bed) => bed.roomId === room.id),
  );

  return (
    Boolean(floorTemplate.name.trim()) &&
    hasNamedDoctorSides &&
    hasRooms &&
    hasValidRooms &&
    hasBedsForEveryRoom
  );
}

export function createShiftFromTemplate(floorTemplate: FloorTemplate): Shift {
  return {
    id: createLocalId("shift"),
    floorTemplateId: floorTemplate.id,
    floorName: floorTemplate.name,
    startedAt: new Date().toISOString(),
    status: "setup",
    admittingDoctorSideId: "",
    doctorSides: floorTemplate.doctorSides.map((doctorSide) => ({
      ...doctorSide,
    })),
    rooms: floorTemplate.rooms.map((room) => ({ ...room })),
    beds: floorTemplate.beds.map((bed) => ({ ...bed })),
    sideLoadLimits: {
      admitting: { min: 4, max: 5 },
      nonAdmitting: { min: 6, max: 7 },
    },
    nurses: [],
    bedStates: floorTemplate.beds.map((bed) => ({
      id: createLocalId("bed-state"),
      bedId: bed.id,
    })),
    flags: [],
    nurseRequests: [],
  };
}

export function copyFloorTemplate(floorTemplate: FloorTemplate): FloorTemplate {
  return {
    id: floorTemplate.id,
    name: floorTemplate.name,
    doctorSides: floorTemplate.doctorSides.map((doctorSide) => ({
      ...doctorSide,
    })),
    rooms: floorTemplate.rooms.map((room) => ({ ...room })),
    beds: floorTemplate.beds.map((bed) => ({ ...bed })),
  };
}

export function createPreviousShiftSnapshot(activeShift: Shift): PreviousShiftSnapshot {
  return {
    id: createLocalId("previous-shift"),
    floorTemplateId: activeShift.floorTemplateId,
    completedAt: new Date().toISOString(),
    nurseSuggestions: activeShift.nurses.map((nurse) => ({
      id: createLocalId("nurse-suggestion"),
      previousNurseId: nurse.id,
      name: nurse.name,
      licenseType: nurse.licenseType,
      experienceLevel: nurse.experienceLevel,
    })),
    patientSuggestions: activeShift.bedStates.flatMap((bedState) => {
      if (!bedState.patient?.initials.trim()) {
        return [];
      }

      const previousBed = activeShift.beds.find(
        (bed) => bed.id === bedState.bedId,
      );

      return [
        {
          id: createLocalId("patient-suggestion"),
          previousBedId: bedState.bedId,
          previousBedLabel: previousBed?.label ?? "Unknown bed",
          patient: { ...bedState.patient },
          acuity: bedState.acuity,
        },
      ];
    }),
  };
}
