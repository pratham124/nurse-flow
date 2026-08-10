import type {
  Bed,
  BedAssignment,
  BedState,
  Flag,
  Nurse,
  Room,
  Shift,
} from "../types/models";

export type FloorBoardLookup = {
  assignmentByBedId: Map<string, BedAssignment>;
  assignedBedCountByNurseId: Map<string, number>;
  bedFlagsByBedId: Map<string, Flag[]>;
  bedsByRoomId: Map<string, Bed[]>;
  bedStateByBedId: Map<string, BedState>;
  generatedTeamLabelByNurseId: Map<string, string>;
  nurseById: Map<string, Nurse>;
  nurseFlagsByNurseId: Map<string, Flag[]>;
  roomCoverageNurseIdsByRoomId: Map<string, string[]>;
  roomFlagsByRoomId: Map<string, Flag[]>;
  roomLabelsByNurseId: Map<string, string[]>;
  roomsByDoctorSideId: Map<string, Room[]>;
};

function addToListMap<ItemT>(
  map: Map<string, ItemT[]>,
  key: string | undefined,
  item: ItemT,
) {
  if (!key) {
    return;
  }

  const items = map.get(key) ?? [];

  items.push(item);
  map.set(key, items);
}

export function createFloorBoardLookup(activeShift: Shift): FloorBoardLookup {
  const assignmentByBedId = new Map<string, BedAssignment>();
  const assignedBedCountByNurseId = new Map<string, number>();
  const bedFlagsByBedId = new Map<string, Flag[]>();
  const bedsByRoomId = new Map<string, Bed[]>();
  const bedStateByBedId = new Map<string, BedState>();
  const generatedTeamLabelByNurseId = new Map<string, string>();
  const nurseById = new Map(
    activeShift.nurses.map((nurse) => [nurse.id, nurse]),
  );
  const nurseFlagsByNurseId = new Map<string, Flag[]>();
  const roomCoverageNurseIdsByRoomId = new Map<string, string[]>();
  const roomFlagsByRoomId = new Map<string, Flag[]>();
  const roomLabelById = new Map(
    activeShift.rooms.map((room) => [room.id, room.label]),
  );
  const roomLabelsByNurseId = new Map<string, string[]>();
  const roomsByDoctorSideId = new Map<string, Room[]>();

  activeShift.rooms.forEach((room) => {
    addToListMap(roomsByDoctorSideId, room.doctorSideId, room);
  });

  activeShift.beds.forEach((bed) => {
    addToListMap(bedsByRoomId, bed.roomId, bed);
  });

  activeShift.bedStates.forEach((bedState) => {
    bedStateByBedId.set(bedState.bedId, bedState);
  });

  activeShift.assignmentResult?.bedAssignments.forEach((assignment) => {
    assignmentByBedId.set(assignment.bedId, assignment);
    assignedBedCountByNurseId.set(
      assignment.nurseId,
      (assignedBedCountByNurseId.get(assignment.nurseId) ?? 0) + 1,
    );
  });

  activeShift.assignmentResult?.roomCoverage.forEach((coverage) => {
    roomCoverageNurseIdsByRoomId.set(coverage.roomId, coverage.nurseIds);

    const roomLabel = roomLabelById.get(coverage.roomId);

    if (roomLabel) {
      coverage.nurseIds.forEach((nurseId) => {
        addToListMap(roomLabelsByNurseId, nurseId, roomLabel);
      });
    }
  });

  activeShift.assignmentResult?.generatedTeams.forEach((team) => {
    team.nurseIds.forEach((nurseId) => {
      generatedTeamLabelByNurseId.set(nurseId, team.label);
    });
  });

  activeShift.flags.forEach((flag) => {
    if (flag.bedId) {
      addToListMap(bedFlagsByBedId, flag.bedId, flag);
    } else if (flag.roomId) {
      addToListMap(roomFlagsByRoomId, flag.roomId, flag);
    }

    addToListMap(nurseFlagsByNurseId, flag.nurseId, flag);
  });

  return {
    assignmentByBedId,
    assignedBedCountByNurseId,
    bedFlagsByBedId,
    bedsByRoomId,
    bedStateByBedId,
    generatedTeamLabelByNurseId,
    nurseById,
    nurseFlagsByNurseId,
    roomCoverageNurseIdsByRoomId,
    roomFlagsByRoomId,
    roomLabelsByNurseId,
    roomsByDoctorSideId,
  };
}
