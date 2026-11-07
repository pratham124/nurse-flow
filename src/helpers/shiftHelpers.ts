import { createLocalId } from "./localId";
import type { FloorTemplate, Shift } from "../types/models";

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
