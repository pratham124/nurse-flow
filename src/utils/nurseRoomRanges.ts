import type { LicenseType, Shift } from "../types/models";

// A nurse's rooms are grouped like the unit whiteboard: "310 – 313-1, 315".
// Everything here is plain data in, plain data out, so it is easy to test.

export type NurseRoomRow = {
  id: string;
  name: string;
  licenseType: LicenseType;
  // Each range on its own, e.g. ["310 – 313-1", "315"], for one chip per range.
  ranges: string[];
  // The same ranges joined with commas, for places that show one line of text.
  rangeText: string;
  rangeAccessibilityText: string;
  currentLoad: number;
  maxLoad: number;
};

export type NurseSideGroup = {
  doctorSideId: string;
  name: string;
  admitting: boolean;
  nurses: NurseRoomRow[];
};

export type NurseRoomsView = {
  sides: NurseSideGroup[];
  // Nurses who own no assigned beds, in the same order as shift.nurses.
  nursesWithoutPatients: NurseRoomRow[];
};

// One room as seen by one nurse.
// owned = the nurse has every assigned bed in the room.
// split = the nurse has some assigned beds and other nurses have the rest.
type OwnedRoom = {
  roomLabel: string;
  kind: "owned" | "split";
  bedNumbers: number[];
};

// "other" = someone else's beds only. "empty" = no assigned beds at all.
type RoomForNurse = OwnedRoom | "other" | "empty";

type RoomRange = {
  start: OwnedRoom;
  end: OwnedRoom;
  isClosed: boolean;
};

type FloorIndex = {
  // Every bed in floor order: rooms in shift.rooms order, beds by bedNumber.
  bedPositionByBedId: Map<string, number>;
  bedRoomIndexByBedId: Map<string, number>;
  bedNumberByBedId: Map<string, number>;
  bedIdsByRoomIndex: string[][];
};

// A spaced en dash joins the two ends of a range ("310 – 313-1"), so it never
// looks like the hyphen inside a bed label.
const rangeDash = " – ";

// A shared room names the nurse's beds with the app's bed label, "313-1", the
// same label the Board shows on each bed. Several beds read "313-1,3".
function getRoomText(room: OwnedRoom) {
  if (room.kind === "owned") {
    return room.roomLabel;
  }

  return `${room.roomLabel}-${room.bedNumbers.join(",")}`;
}

function joinWithAnd(items: string[]) {
  if (items.length <= 1) {
    return items.join("");
  }

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function getRoomAccessibilityText(room: OwnedRoom) {
  if (room.kind === "owned") {
    return room.roomLabel;
  }

  const bedWord = room.bedNumbers.length === 1 ? "bed" : "beds";

  return `${room.roomLabel} ${bedWord} ${joinWithAnd(room.bedNumbers.map(String))}`;
}

function isSingleRoomRange(range: RoomRange) {
  return range.start === range.end;
}

// A line may break at the spaces around the dash, which splits "302 – 304"
// across two lines on a narrow phone. Non-breaking spaces keep each range on
// one line, so long lists wrap only after the commas between ranges.
const nonBreakingSpace = "\u00a0";

export function keepRangesTogether(rangeText: string) {
  return rangeText
    .split(rangeDash)
    .join(`${nonBreakingSpace}–${nonBreakingSpace}`);
}

function getRangeText(range: RoomRange) {
  return isSingleRoomRange(range)
    ? getRoomText(range.start)
    : `${getRoomText(range.start)}${rangeDash}${getRoomText(range.end)}`;
}

function getRangeAccessibilityText(range: RoomRange) {
  return isSingleRoomRange(range)
    ? getRoomAccessibilityText(range.start)
    : `${getRoomAccessibilityText(range.start)} to ${getRoomAccessibilityText(range.end)}`;
}

/**
 * Groups one nurse's rooms (in floor order) into ranges.
 * - A room that holds only someone else's beds ends the range.
 * - A room with no assigned beds is skipped and does not end the range.
 * - A split room can only be the start or the end of a range, never the middle.
 */
function buildRoomRanges(rooms: RoomForNurse[]) {
  const ranges: RoomRange[] = [];
  let currentRange: RoomRange | undefined;

  for (const room of rooms) {
    if (room === "other") {
      currentRange = undefined;
    } else if (room !== "empty") {
      if (currentRange && !currentRange.isClosed) {
        currentRange.end = room;
        // A split room reached while extending is where the range must stop.
        currentRange.isClosed = room.kind === "split";
      } else {
        currentRange = { start: room, end: room, isClosed: false };
        ranges.push(currentRange);
      }
    }
  }

  return ranges;
}

function createFloorIndex(shift: Shift): FloorIndex {
  const bedPositionByBedId = new Map<string, number>();
  const bedRoomIndexByBedId = new Map<string, number>();
  const bedNumberByBedId = new Map<string, number>();
  const bedIdsByRoomIndex: string[][] = [];
  let position = 0;

  shift.rooms.forEach((room, roomIndex) => {
    const roomBeds = shift.beds
      .filter((bed) => bed.roomId === room.id)
      .sort((first, second) => first.bedNumber - second.bedNumber);

    bedIdsByRoomIndex.push(roomBeds.map((bed) => bed.id));
    roomBeds.forEach((bed) => {
      bedPositionByBedId.set(bed.id, position);
      bedRoomIndexByBedId.set(bed.id, roomIndex);
      bedNumberByBedId.set(bed.id, bed.bedNumber);
      position += 1;
    });
  });

  return {
    bedPositionByBedId,
    bedRoomIndexByBedId,
    bedNumberByBedId,
    bedIdsByRoomIndex,
  };
}

// Which nurse owns each bed. Beds that are not on the floor are ignored.
function getNurseIdByBedId(shift: Shift, floorIndex: FloorIndex) {
  const nurseIdByBedId = new Map<string, string>();

  for (const assignment of shift.assignmentResult?.bedAssignments ?? []) {
    if (floorIndex.bedPositionByBedId.has(assignment.bedId)) {
      nurseIdByBedId.set(assignment.bedId, assignment.nurseId);
    }
  }

  return nurseIdByBedId;
}

function getNurseRoomText(
  shift: Shift,
  floorIndex: FloorIndex,
  nurseIdByBedId: Map<string, string>,
  nurseId: string,
) {
  const rooms = shift.rooms.map((room, roomIndex): RoomForNurse => {
    const assignedBedIds = floorIndex.bedIdsByRoomIndex[roomIndex].filter(
      (bedId) => nurseIdByBedId.has(bedId),
    );
    const ownedBedIds = assignedBedIds.filter(
      (bedId) => nurseIdByBedId.get(bedId) === nurseId,
    );

    if (assignedBedIds.length === 0) {
      return "empty";
    }

    if (ownedBedIds.length === 0) {
      return "other";
    }

    return {
      roomLabel: room.label,
      kind: ownedBedIds.length === assignedBedIds.length ? "owned" : "split",
      bedNumbers: ownedBedIds.map(
        (bedId) => floorIndex.bedNumberByBedId.get(bedId) ?? 0,
      ),
    };
  });
  const ranges = buildRoomRanges(rooms);
  const useSingularRoom = ranges.length === 1 && isSingleRoomRange(ranges[0]);
  const rangeTexts = ranges.map(getRangeText);

  return {
    ranges: rangeTexts,
    rangeText: rangeTexts.join(", "),
    rangeAccessibilityText: ranges.length
      ? `${useSingularRoom ? "room" : "rooms"} ${ranges.map(getRangeAccessibilityText).join(", ")}`
      : "no rooms",
  };
}

// Picks the side holding most of the nurse's beds. Checking sides in order
// with ">" means a tie goes to the side listed first.
function getMainSideIndex(
  shift: Shift,
  floorIndex: FloorIndex,
  ownedBedIds: string[],
) {
  const bedCountBySideIndex = shift.doctorSides.map(() => 0);

  ownedBedIds.forEach((bedId) => {
    const room = shift.rooms[floorIndex.bedRoomIndexByBedId.get(bedId) ?? -1];
    const sideIndex = shift.doctorSides.findIndex(
      (side) => side.id === room?.doctorSideId,
    );

    if (sideIndex >= 0) {
      bedCountBySideIndex[sideIndex] += 1;
    }
  });

  let mainSideIndex = 0;

  bedCountBySideIndex.forEach((count, sideIndex) => {
    if (count > bedCountBySideIndex[mainSideIndex]) {
      mainSideIndex = sideIndex;
    }
  });

  return mainSideIndex;
}

/**
 * Builds the Nurses view: each nurse sits under the doctor side where most of
 * their beds are, ordered by their first bed on the floor. Nurses with no beds
 * go in their own list at the end.
 */
export function buildNurseRoomsView(shift: Shift): NurseRoomsView {
  const floorIndex = createFloorIndex(shift);
  const nurseIdByBedId = getNurseIdByBedId(shift, floorIndex);
  const nursesBySideIndex = shift.doctorSides.map(
    () => [] as { firstBedPosition: number; row: NurseRoomRow }[],
  );
  const nursesWithoutPatients: NurseRoomRow[] = [];

  for (const nurse of shift.nurses) {
    const ownedBedIds = [...nurseIdByBedId.keys()].filter(
      (bedId) => nurseIdByBedId.get(bedId) === nurse.id,
    );
    const roomText = getNurseRoomText(shift, floorIndex, nurseIdByBedId, nurse.id);
    const row: NurseRoomRow = {
      id: nurse.id,
      name: nurse.name,
      licenseType: nurse.licenseType,
      ranges: roomText.ranges,
      rangeText: roomText.rangeText,
      rangeAccessibilityText: roomText.rangeAccessibilityText,
      currentLoad: ownedBedIds.length,
      maxLoad: nurse.maxPatientLoad,
    };

    if (ownedBedIds.length === 0) {
      nursesWithoutPatients.push(row);
    } else {
      const firstBedPosition = Math.min(
        ...ownedBedIds.map(
          (bedId) => floorIndex.bedPositionByBedId.get(bedId) ?? 0,
        ),
      );

      nursesBySideIndex[getMainSideIndex(shift, floorIndex, ownedBedIds)].push({
        firstBedPosition,
        row,
      });
    }
  }

  return {
    sides: shift.doctorSides.map((side, sideIndex) => ({
      doctorSideId: side.id,
      name: side.name,
      admitting: side.id === shift.admittingDoctorSideId,
      nurses: nursesBySideIndex[sideIndex]
        .sort((first, second) => first.firstBedPosition - second.firstBedPosition)
        .map((entry) => entry.row),
    })),
    nursesWithoutPatients,
  };
}
