import type {
  Acuity,
  AssignmentResult,
  BedAssignment,
  GeneratedTeam,
  Nurse,
  RoomCoverage,
  Shift,
} from "../types/models";
import type { AssignmentNeedSummary } from "./assignmentNeedSummary";
import { getAssignmentNeedSummary } from "./assignmentNeedSummary";
import { isOccupiedBedState } from "./census";

type TeamDraft = GeneratedTeam & {
  capacity: number;
  rnCount: number;
  strengthScore: number;
};

type NurseWithIndex = {
  nurse: Nurse;
  originalIndex: number;
};

type AssignableBed = {
  bedId: string;
  roomId: string;
  acuity: Acuity;
  originalIndex: number;
};

const acuityAssignmentPriority: Record<Acuity, number> = {
  red: 0,
  yellow: 1,
  green: 2,
};

function getExperienceScore(nurse: Nurse) {
  switch (nurse.experienceLevel) {
    case "experienced":
      return 3;
    case "mid":
      return 2;
    case "new_grad":
      return 1;
  }
}

function getLicenseScore(nurse: Nurse) {
  return nurse.licenseType === "RN" ? 3 : 1;
}

function getNurseStrengthScore(nurse: Nurse) {
  return nurse.maxPatientLoad * 2 + getLicenseScore(nurse) + getExperienceScore(nurse);
}

function sortNursesForTeamBalancing(
  firstNurse: NurseWithIndex,
  secondNurse: NurseWithIndex,
) {
  const firstRnScore = firstNurse.nurse.licenseType === "RN" ? 1 : 0;
  const secondRnScore = secondNurse.nurse.licenseType === "RN" ? 1 : 0;

  if (firstRnScore !== secondRnScore) {
    return secondRnScore - firstRnScore;
  }

  const experienceDifference =
    getExperienceScore(secondNurse.nurse) - getExperienceScore(firstNurse.nurse);

  if (experienceDifference !== 0) {
    return experienceDifference;
  }

  if (firstNurse.nurse.maxPatientLoad !== secondNurse.nurse.maxPatientLoad) {
    return secondNurse.nurse.maxPatientLoad - firstNurse.nurse.maxPatientLoad;
  }

  return firstNurse.originalIndex - secondNurse.originalIndex;
}

function createTeamDrafts(activeShift: Shift): TeamDraft[] {
  const teamCount = Math.min(activeShift.nurses.length, 2);

  return Array.from({ length: teamCount }).map((_, index) => ({
    id: `assignment-${activeShift.id}-team-${index + 1}`,
    label: `Team ${String.fromCharCode(65 + index)}`,
    nurseIds: [],
    capacity: 0,
    rnCount: 0,
    strengthScore: 0,
  }));
}

function getWeightedPatientDemand(patientNeedSummary: AssignmentNeedSummary) {
  return patientNeedSummary.sides.reduce(
    (totalDemand, side) =>
      totalDemand +
      side.acuityCounts.green +
      side.acuityCounts.yellow * 2 +
      side.acuityCounts.red * 3,
    0,
  );
}

function getGuidedTeamStrengthTarget(
  activeShift: Shift,
  patientNeedSummary: AssignmentNeedSummary,
  teamCount: number,
) {
  const highestSideLoadLimit = Math.max(
    activeShift.sideLoadLimits.admitting.max,
    activeShift.sideLoadLimits.nonAdmitting.max,
  );
  const weightedPatientDemand = getWeightedPatientDemand(patientNeedSummary);

  return Math.max(
    highestSideLoadLimit,
    Math.ceil(weightedPatientDemand / Math.max(teamCount, 1)),
  );
}

function getBestTeamForNurse(
  teams: TeamDraft[],
  nurse: Nurse,
  shouldSpreadRnCoverage: boolean,
  teamStrengthTarget: number,
) {
  const nurseStrengthScore = getNurseStrengthScore(nurse);

  return [...teams].sort((firstTeam, secondTeam) => {
    if (shouldSpreadRnCoverage && nurse.licenseType === "RN") {
      if (firstTeam.rnCount !== secondTeam.rnCount) {
        return firstTeam.rnCount - secondTeam.rnCount;
      }
    }

    const firstProjectedGap = Math.abs(
      firstTeam.strengthScore + nurseStrengthScore - teamStrengthTarget,
    );
    const secondProjectedGap = Math.abs(
      secondTeam.strengthScore + nurseStrengthScore - teamStrengthTarget,
    );

    if (firstProjectedGap !== secondProjectedGap) {
      return firstProjectedGap - secondProjectedGap;
    }

    if (firstTeam.strengthScore !== secondTeam.strengthScore) {
      return firstTeam.strengthScore - secondTeam.strengthScore;
    }

    if (firstTeam.capacity !== secondTeam.capacity) {
      return firstTeam.capacity - secondTeam.capacity;
    }

    return firstTeam.label.localeCompare(secondTeam.label);
  })[0];
}

function addNurseToTeam(team: TeamDraft, nurse: Nurse) {
  team.nurseIds.push(nurse.id);
  team.capacity += nurse.maxPatientLoad;
  team.strengthScore += getNurseStrengthScore(nurse);

  if (nurse.licenseType === "RN") {
    team.rnCount += 1;
  }
}

function getNurseById(activeShift: Shift, nurseId: string) {
  return activeShift.nurses.find((nurse) => nurse.id === nurseId);
}

function getTeamStrength(activeShift: Shift, team: GeneratedTeam) {
  return team.nurseIds.reduce((strength, nurseId) => {
    const nurse = getNurseById(activeShift, nurseId);

    return nurse ? strength + getNurseStrengthScore(nurse) : strength;
  }, 0);
}

function getTeamHasRn(activeShift: Shift, team: GeneratedTeam) {
  return team.nurseIds.some(
    (nurseId) => getNurseById(activeShift, nurseId)?.licenseType === "RN",
  );
}

function getTeamCapacity(activeShift: Shift, team: GeneratedTeam) {
  return team.nurseIds.reduce((capacity, nurseId) => {
    const nurse = getNurseById(activeShift, nurseId);

    return nurse ? capacity + nurse.maxPatientLoad : capacity;
  }, 0);
}

function getStableCoverageNurseIds(activeShift: Shift, nurseIds: string[]) {
  const uniqueNurseIds = Array.from(new Set(nurseIds));

  return uniqueNurseIds.sort((firstNurseId, secondNurseId) => {
    const firstIndex = activeShift.nurses.findIndex(
      (nurse) => nurse.id === firstNurseId,
    );
    const secondIndex = activeShift.nurses.findIndex(
      (nurse) => nurse.id === secondNurseId,
    );

    return firstIndex - secondIndex;
  });
}

function getBestTeamForRoomCoverage(
  activeShift: Shift,
  teams: GeneratedTeam[],
  assignedPatientCountByTeamId: Map<string, number>,
  roomOccupiedBedCount: number,
  roomHasRedBed: boolean,
) {
  const hasAnyRn = activeShift.nurses.some((nurse) => nurse.licenseType === "RN");
  const eligibleTeams =
    roomHasRedBed && hasAnyRn
      ? teams.filter((team) => getTeamHasRn(activeShift, team))
      : teams;

  return [...eligibleTeams].sort((firstTeam, secondTeam) => {
    const firstRemainingCapacity =
      getTeamCapacity(activeShift, firstTeam) -
      (assignedPatientCountByTeamId.get(firstTeam.id) ?? 0);
    const secondRemainingCapacity =
      getTeamCapacity(activeShift, secondTeam) -
      (assignedPatientCountByTeamId.get(secondTeam.id) ?? 0);

    if (firstRemainingCapacity !== secondRemainingCapacity) {
      return secondRemainingCapacity - firstRemainingCapacity;
    }

    const firstProjectedPatientCount =
      (assignedPatientCountByTeamId.get(firstTeam.id) ?? 0) +
      roomOccupiedBedCount;
    const secondProjectedPatientCount =
      (assignedPatientCountByTeamId.get(secondTeam.id) ?? 0) +
      roomOccupiedBedCount;

    if (firstProjectedPatientCount !== secondProjectedPatientCount) {
      return firstProjectedPatientCount - secondProjectedPatientCount;
    }

    const firstStrength = getTeamStrength(activeShift, firstTeam);
    const secondStrength = getTeamStrength(activeShift, secondTeam);

    if (firstStrength !== secondStrength) {
      return secondStrength - firstStrength;
    }

    return firstTeam.label.localeCompare(secondTeam.label);
  })[0];
}

export function generateBalancedTeams(activeShift: Shift): GeneratedTeam[] {
  const teams = createTeamDrafts(activeShift);
  const patientNeedSummary = getAssignmentNeedSummary(activeShift);
  const shouldSpreadRnCoverage = patientNeedSummary.totalRedBedCount > 0;
  const teamStrengthTarget = getGuidedTeamStrengthTarget(
    activeShift,
    patientNeedSummary,
    teams.length,
  );
  const nursesForBalancing = activeShift.nurses
    .map((nurse, originalIndex) => ({ nurse, originalIndex }))
    .sort(sortNursesForTeamBalancing);

  nursesForBalancing.forEach(({ nurse }) => {
    const team = getBestTeamForNurse(
      teams,
      nurse,
      shouldSpreadRnCoverage,
      teamStrengthTarget,
    );
    addNurseToTeam(team, nurse);
  });

  return teams.map((team) => ({
    id: team.id,
    label: team.label,
    nurseIds: team.nurseIds,
  }));
}

export function generateRoomCoverage(
  activeShift: Shift,
  generatedTeams: GeneratedTeam[],
): RoomCoverage[] {
  const patientNeedSummary = getAssignmentNeedSummary(activeShift);
  const roomNeedById = new Map(
    patientNeedSummary.sides.flatMap((side) =>
      side.rooms.map((room) => [room.id, room] as const),
    ),
  );
  const assignedPatientCountByTeamId = new Map<string, number>();
  const coverageNurseIdsByRoomId = new Map<string, string[]>();

  activeShift.rooms.forEach((room) => {
    const roomNeed = roomNeedById.get(room.id);

    if (!roomNeed || roomNeed.occupiedBedCount === 0) {
      coverageNurseIdsByRoomId.set(room.id, []);
      return;
    }

    const selectedTeam = getBestTeamForRoomCoverage(
      activeShift,
      generatedTeams,
      assignedPatientCountByTeamId,
      roomNeed.occupiedBedCount,
      roomNeed.acuityCounts.red > 0,
    );

    if (!selectedTeam) {
      coverageNurseIdsByRoomId.set(room.id, []);
      return;
    }

    coverageNurseIdsByRoomId.set(
      room.id,
      getStableCoverageNurseIds(activeShift, selectedTeam.nurseIds),
    );
    assignedPatientCountByTeamId.set(
      selectedTeam.id,
      (assignedPatientCountByTeamId.get(selectedTeam.id) ?? 0) +
        roomNeed.occupiedBedCount,
    );
  });

  return activeShift.rooms.map((room) => ({
    id: `assignment-${activeShift.id}-coverage-${room.id}`,
    roomId: room.id,
    nurseIds: coverageNurseIdsByRoomId.get(room.id) ?? [],
  }));
}

function getAssignableBeds(activeShift: Shift) {
  const assignableBeds: AssignableBed[] = [];

  activeShift.beds.forEach((bed, originalIndex) => {
    const bedState = activeShift.bedStates.find(
      (shiftBedState) => shiftBedState.bedId === bed.id,
    );

    if (!bedState || !isOccupiedBedState(bedState) || !bedState.acuity) {
      return;
    }

    assignableBeds.push({
      bedId: bed.id,
      roomId: bed.roomId,
      acuity: bedState.acuity,
      originalIndex,
    });
  });

  return assignableBeds.sort((firstBed, secondBed) => {
    const acuityDifference =
      acuityAssignmentPriority[firstBed.acuity] -
      acuityAssignmentPriority[secondBed.acuity];

    if (acuityDifference !== 0) {
      return acuityDifference;
    }

    return firstBed.originalIndex - secondBed.originalIndex;
  });
}

function getEligibleNurseIdsForBed(
  activeShift: Shift,
  roomCoverage: RoomCoverage[],
  assignedBedCountByNurseId: Map<string, number>,
  assignableBed: AssignableBed,
) {
  const coverage = roomCoverage.find(
    (room) => room.roomId === assignableBed.roomId,
  );

  return (
    coverage?.nurseIds.filter((nurseId) => {
      const nurse = getNurseById(activeShift, nurseId);

      if (!nurse) {
        return false;
      }

      if (assignableBed.acuity === "red" && nurse.licenseType !== "RN") {
        return false;
      }

      const assignedBedCount = assignedBedCountByNurseId.get(nurseId) ?? 0;

      return assignedBedCount < nurse.maxPatientLoad;
    }) ?? []
  );
}

export function generateBedAssignments(
  activeShift: Shift,
  roomCoverage: RoomCoverage[],
): BedAssignment[] {
  const assignedBedCountByNurseId = new Map<string, number>();
  const bedAssignments: BedAssignment[] = [];

  getAssignableBeds(activeShift).forEach((assignableBed) => {
    const selectedNurseId = getEligibleNurseIdsForBed(
      activeShift,
      roomCoverage,
      assignedBedCountByNurseId,
      assignableBed,
    )[0];

    if (!selectedNurseId) {
      return;
    }

    bedAssignments.push({
      id: `assignment-${activeShift.id}-bed-${assignableBed.bedId}`,
      bedId: assignableBed.bedId,
      nurseId: selectedNurseId,
    });
    assignedBedCountByNurseId.set(
      selectedNurseId,
      (assignedBedCountByNurseId.get(selectedNurseId) ?? 0) + 1,
    );
  });

  return bedAssignments;
}

export function generateLocalAssignmentResult(
  activeShift: Shift,
): AssignmentResult {
  const generatedTeams = generateBalancedTeams(activeShift);
  const roomCoverage = generateRoomCoverage(activeShift, generatedTeams);

  return {
    id: `assignment-${activeShift.id}`,
    generatedTeams,
    roomCoverage,
    bedAssignments: generateBedAssignments(activeShift, roomCoverage),
  };
}
