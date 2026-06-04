import type {
  Acuity,
  AssignmentResult,
  Bed,
  BedAssignment,
  Flag,
  GeneratedTeam,
  Room,
  RoomCoverage,
  Shift,
} from "../types/models";
import { isOccupiedBedState } from "./census";

type OccupiedBed = {
  acuity?: Acuity;
  bed: Bed;
  room?: Room;
};

const acuityWeight: Record<Acuity, number> = {
  green: 1,
  yellow: 2,
  red: 3,
};

function getOccupiedBeds(activeShift: Shift): OccupiedBed[] {
  return activeShift.beds.flatMap((bed) => {
    const bedState = activeShift.bedStates.find(
      (shiftBedState) => shiftBedState.bedId === bed.id,
    );

    if (!isOccupiedBedState(bedState)) {
      return [];
    }

    return [
      {
        acuity: bedState?.acuity,
        bed,
        room: activeShift.rooms.find((room) => room.id === bed.roomId),
      },
    ];
  });
}

function getNurseById(activeShift: Shift, nurseId: string) {
  return activeShift.nurses.find((nurse) => nurse.id === nurseId);
}

function getAssignedBedCountsByNurseId(bedAssignments: BedAssignment[]) {
  const assignedBedCountsByNurseId = new Map<string, number>();

  bedAssignments.forEach((bedAssignment) => {
    assignedBedCountsByNurseId.set(
      bedAssignment.nurseId,
      (assignedBedCountsByNurseId.get(bedAssignment.nurseId) ?? 0) + 1,
    );
  });

  return assignedBedCountsByNurseId;
}

function getRoomCoverageByRoomId(roomCoverage: RoomCoverage[]) {
  return new Map(roomCoverage.map((coverage) => [coverage.roomId, coverage]));
}

function getBedAssignmentByBedId(bedAssignments: BedAssignment[]) {
  return new Map(
    bedAssignments.map((bedAssignment) => [bedAssignment.bedId, bedAssignment]),
  );
}

function getEligibleCoverageNurseIds(
  activeShift: Shift,
  occupiedBed: OccupiedBed,
  coverage: RoomCoverage | undefined,
  assignedBedCountsByNurseId: Map<string, number>,
) {
  return (
    coverage?.nurseIds.filter((nurseId) => {
      const nurse = getNurseById(activeShift, nurseId);

      if (!nurse) {
        return false;
      }

      if (occupiedBed.acuity === "red" && nurse.licenseType !== "RN") {
        return false;
      }

      return (assignedBedCountsByNurseId.get(nurseId) ?? 0) < nurse.maxPatientLoad;
    }) ?? []
  );
}

function getNurseLoadLimit(
  activeShift: Shift,
  assignmentResult: AssignmentResult,
  nurseId: string,
) {
  const coversAdmittingSide = assignmentResult.roomCoverage.some((coverage) =>
    coverage.nurseIds.includes(nurseId) &&
    activeShift.rooms.some(
      (room) =>
        room.id === coverage.roomId &&
        room.doctorSideId === activeShift.admittingDoctorSideId,
    ),
  );

  return coversAdmittingSide
    ? activeShift.sideLoadLimits.admitting.max
    : activeShift.sideLoadLimits.nonAdmitting.max;
}

function getTeamForNurse(
  generatedTeams: GeneratedTeam[],
  nurseId: string,
): GeneratedTeam | undefined {
  return generatedTeams.find((team) => team.nurseIds.includes(nurseId));
}

function getTeamLoadSummaries(
  activeShift: Shift,
  assignmentResult: AssignmentResult,
) {
  const teamLoadByTeamId = new Map(
    assignmentResult.generatedTeams.map((team) => [
      team.id,
      {
        patientCount: 0,
        redBedCount: 0,
        rnCount: team.nurseIds.filter(
          (nurseId) => getNurseById(activeShift, nurseId)?.licenseType === "RN",
        ).length,
        weightedAcuityLoad: 0,
      },
    ]),
  );
  const assignedBedById = getBedAssignmentByBedId(
    assignmentResult.bedAssignments,
  );

  getOccupiedBeds(activeShift).forEach((occupiedBed) => {
    const assignedNurseId = assignedBedById.get(occupiedBed.bed.id)?.nurseId;
    const team = assignedNurseId
      ? getTeamForNurse(assignmentResult.generatedTeams, assignedNurseId)
      : undefined;
    const teamLoad = team ? teamLoadByTeamId.get(team.id) : undefined;

    if (!teamLoad || !occupiedBed.acuity) {
      return;
    }

    teamLoad.patientCount += 1;
    teamLoad.weightedAcuityLoad += acuityWeight[occupiedBed.acuity];

    if (occupiedBed.acuity === "red") {
      teamLoad.redBedCount += 1;
    }
  });

  return assignmentResult.generatedTeams.map((team) => ({
    team,
    load: teamLoadByTeamId.get(team.id) ?? {
      patientCount: 0,
      redBedCount: 0,
      rnCount: 0,
      weightedAcuityLoad: 0,
    },
  }));
}

function addCapacityFlags(
  activeShift: Shift,
  assignmentResult: AssignmentResult,
  flags: Flag[],
) {
  const assignedBedCountsByNurseId = getAssignedBedCountsByNurseId(
    assignmentResult.bedAssignments,
  );

  activeShift.nurses.forEach((nurse) => {
    const assignedBedCount = assignedBedCountsByNurseId.get(nurse.id) ?? 0;
    const sideLoadLimit = getNurseLoadLimit(
      activeShift,
      assignmentResult,
      nurse.id,
    );

    if (assignedBedCount > sideLoadLimit) {
      flags.push({
        id: `flag-${activeShift.id}-side-load-${nurse.id}`,
        message: `${nurse.name} has ${assignedBedCount} assigned patients, above the side load limit of ${sideLoadLimit}.`,
        nurseId: nurse.id,
        severity: "warning",
        type: "over_side_load_limit",
      });
    }

    if (assignedBedCount > nurse.maxPatientLoad) {
      flags.push({
        id: `flag-${activeShift.id}-max-load-${nurse.id}`,
        message: `${nurse.name} has ${assignedBedCount} assigned patients, above their max load of ${nurse.maxPatientLoad}.`,
        nurseId: nurse.id,
        severity: "critical",
        type: "over_max_load",
      });
    }
  });
}

function addCoverageFlags(
  activeShift: Shift,
  assignmentResult: AssignmentResult,
  flags: Flag[],
) {
  const assignedBedCountsByNurseId = getAssignedBedCountsByNurseId(
    assignmentResult.bedAssignments,
  );
  const assignmentByBedId = getBedAssignmentByBedId(
    assignmentResult.bedAssignments,
  );
  const coverageByRoomId = getRoomCoverageByRoomId(
    assignmentResult.roomCoverage,
  );
  const occupiedBeds = getOccupiedBeds(activeShift);

  activeShift.rooms.forEach((room) => {
    const occupiedBedsInRoom = occupiedBeds.filter(
      (occupiedBed) => occupiedBed.room?.id === room.id,
    );
    const coverage = coverageByRoomId.get(room.id);

    if (occupiedBedsInRoom.length > 0 && !coverage?.nurseIds.length) {
      flags.push({
        id: `flag-${activeShift.id}-room-coverage-${room.id}`,
        message: `Room ${room.label} has occupied beds but no generated nurse coverage.`,
        roomId: room.id,
        severity: "warning",
        type: "no_eligible_coverage",
      });
    }
  });

  occupiedBeds.forEach((occupiedBed) => {
    const assignment = assignmentByBedId.get(occupiedBed.bed.id);
    const coverage = coverageByRoomId.get(occupiedBed.bed.roomId);
    const eligibleNurseIds = getEligibleCoverageNurseIds(
      activeShift,
      occupiedBed,
      coverage,
      assignedBedCountsByNurseId,
    );

    if (!assignment) {
      flags.push({
        bedId: occupiedBed.bed.id,
        id: `flag-${activeShift.id}-unassigned-${occupiedBed.bed.id}`,
        message: `Bed ${occupiedBed.bed.label} is occupied but could not be assigned.`,
        roomId: occupiedBed.room?.id,
        severity: "warning",
        type: "unassigned_bed",
      });
    }

    if (occupiedBed.acuity === "red" && eligibleNurseIds.length === 0) {
      flags.push({
        bedId: occupiedBed.bed.id,
        id: `flag-${activeShift.id}-rn-required-${occupiedBed.bed.id}`,
        message: `Bed ${occupiedBed.bed.label} is red and needs eligible RN coverage.`,
        roomId: occupiedBed.room?.id,
        severity: "critical",
        type: "rn_required",
      });
    }

    if (!assignment && eligibleNurseIds.length === 0) {
      flags.push({
        bedId: occupiedBed.bed.id,
        id: `flag-${activeShift.id}-bed-coverage-${occupiedBed.bed.id}`,
        message: `Bed ${occupiedBed.bed.label} has no eligible nurse coverage under the current limits.`,
        roomId: occupiedBed.room?.id,
        severity: "warning",
        type: "no_eligible_coverage",
      });
    }
  });
}

function addUnderstaffedFlag(
  activeShift: Shift,
  occupiedBedCount: number,
  flags: Flag[],
) {
  const totalNurseCapacity = activeShift.nurses.reduce(
    (capacity, nurse) => capacity + nurse.maxPatientLoad,
    0,
  );

  if (occupiedBedCount > totalNurseCapacity) {
    flags.push({
      id: `flag-${activeShift.id}-understaffed`,
      message: `Floor has ${occupiedBedCount} occupied beds and ${totalNurseCapacity} total nurse capacity.`,
      severity: "warning",
      type: "understaffed",
    });
  }
}

function addTeamImbalanceFlag(
  activeShift: Shift,
  assignmentResult: AssignmentResult,
  flags: Flag[],
) {
  const teamLoadSummaries = getTeamLoadSummaries(activeShift, assignmentResult);

  if (teamLoadSummaries.length < 2) {
    return;
  }

  const patientCounts = teamLoadSummaries.map(
    (summary) => summary.load.patientCount,
  );
  const redBedCounts = teamLoadSummaries.map(
    (summary) => summary.load.redBedCount,
  );
  const rnCounts = teamLoadSummaries.map((summary) => summary.load.rnCount);
  const acuityLoads = teamLoadSummaries.map(
    (summary) => summary.load.weightedAcuityLoad,
  );
  const patientCountGap = Math.max(...patientCounts) - Math.min(...patientCounts);
  const redBedGap = Math.max(...redBedCounts) - Math.min(...redBedCounts);
  const rnGap = Math.max(...rnCounts) - Math.min(...rnCounts);
  const acuityLoadGap = Math.max(...acuityLoads) - Math.min(...acuityLoads);

  if (patientCountGap <= 1 && redBedGap <= 1 && rnGap <= 1 && acuityLoadGap <= 3) {
    return;
  }

  flags.push({
    id: `flag-${activeShift.id}-team-imbalance`,
    message:
      "Generated teams have a noticeable difference in patient load, acuity load, or RN coverage.",
    severity: "warning",
    teamId: teamLoadSummaries[0]?.team.id,
    type: "team_imbalance",
  });
}

export function generateAssignmentFlags(
  activeShift: Shift,
  assignmentResult: AssignmentResult,
): Flag[] {
  const flags: Flag[] = [];
  const occupiedBedCount = getOccupiedBeds(activeShift).length;

  addUnderstaffedFlag(activeShift, occupiedBedCount, flags);
  addCoverageFlags(activeShift, assignmentResult, flags);
  addCapacityFlags(activeShift, assignmentResult, flags);
  addTeamImbalanceFlag(activeShift, assignmentResult, flags);

  return flags;
}
