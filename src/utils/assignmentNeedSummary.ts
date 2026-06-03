import type { Acuity, Shift } from "../types/models";
import { isOccupiedBedState } from "./census";

type AcuityCounts = Record<Acuity, number>;

export type AssignmentNeedRoomSummary = {
  id: string;
  label: string;
  occupiedBedCount: number;
  acuityCounts: AcuityCounts;
  redBedLabels: string[];
};

export type AssignmentNeedSideSummary = {
  id: string;
  name: string;
  occupiedBedCount: number;
  acuityCounts: AcuityCounts;
  redBedLabels: string[];
  rooms: AssignmentNeedRoomSummary[];
};

export type AssignmentNeedSummary = {
  occupiedBedCount: number;
  totalRedBedCount: number;
  sides: AssignmentNeedSideSummary[];
};

function createEmptyAcuityCounts(): AcuityCounts {
  return {
    green: 0,
    yellow: 0,
    red: 0,
  };
}

function addAcuityCount(acuityCounts: AcuityCounts, acuity?: Acuity) {
  if (!acuity) {
    return;
  }

  acuityCounts[acuity] += 1;
}

function addAcuityCounts(
  totalAcuityCounts: AcuityCounts,
  acuityCountsToAdd: AcuityCounts,
) {
  totalAcuityCounts.green += acuityCountsToAdd.green;
  totalAcuityCounts.yellow += acuityCountsToAdd.yellow;
  totalAcuityCounts.red += acuityCountsToAdd.red;
}

export function getAssignmentNeedSummary(
  activeShift?: Shift,
): AssignmentNeedSummary {
  if (!activeShift) {
    return {
      occupiedBedCount: 0,
      totalRedBedCount: 0,
      sides: [],
    };
  }

  const sides = activeShift.doctorSides.map((doctorSide) => {
    const sideAcuityCounts = createEmptyAcuityCounts();
    const sideRedBedLabels: string[] = [];
    const sideRooms = activeShift.rooms.filter(
      (room) => room.doctorSideId === doctorSide.id,
    );
    const rooms = sideRooms.map((room) => {
      const roomAcuityCounts = createEmptyAcuityCounts();
      let roomOccupiedBedCount = 0;
      const roomRedBedLabels: string[] = [];
      const roomBeds = activeShift.beds.filter((bed) => bed.roomId === room.id);

      roomBeds.forEach((bed) => {
        const bedState = activeShift.bedStates.find(
          (shiftBedState) => shiftBedState.bedId === bed.id,
        );

        if (!isOccupiedBedState(bedState)) {
          return;
        }

        roomOccupiedBedCount += 1;
        addAcuityCount(roomAcuityCounts, bedState?.acuity);

        if (bedState?.acuity === "red") {
          roomRedBedLabels.push(bed.label);
        }
      });

      addAcuityCounts(sideAcuityCounts, roomAcuityCounts);
      sideRedBedLabels.push(...roomRedBedLabels);

      return {
        id: room.id,
        label: room.label,
        occupiedBedCount: roomOccupiedBedCount,
        acuityCounts: roomAcuityCounts,
        redBedLabels: roomRedBedLabels,
      };
    });

    return {
      id: doctorSide.id,
      name: doctorSide.name,
      occupiedBedCount: rooms.reduce(
        (count, room) => count + room.occupiedBedCount,
        0,
      ),
      acuityCounts: sideAcuityCounts,
      redBedLabels: sideRedBedLabels,
      rooms,
    };
  });

  return {
    occupiedBedCount: sides.reduce(
      (count, side) => count + side.occupiedBedCount,
      0,
    ),
    totalRedBedCount: sides.reduce(
      (count, side) => count + side.acuityCounts.red,
      0,
    ),
    sides,
  };
}
