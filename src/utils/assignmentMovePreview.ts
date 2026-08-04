import type { AssignmentResult, Flag, Shift } from "../types/models";
import { generateAssignmentFlags } from "./assignmentFlags";
import { isOccupiedBedState } from "./census";
import { getAssignmentLoadsByNurseId } from "./effectiveAssignment";

export type AssignmentMoveBlockingReasonCode =
  | "bed_not_found"
  | "bed_not_occupied"
  | "bed_not_assigned"
  | "target_nurse_not_found"
  | "same_nurse"
  | "outside_room_coverage"
  | "red_requires_rn";

export type AssignmentMoveBlockingReason = {
  code: AssignmentMoveBlockingReasonCode;
  message: string;
};

export type AssignmentMoveLoadChange = {
  before: number;
  after: number;
  nurseId: string;
};

export type AssignmentMovePreview = {
  bedId: string;
  blockingReasons: AssignmentMoveBlockingReason[];
  fromNurseId?: string;
  resultingAssignmentResult?: AssignmentResult;
  resultingLoadSummary: AssignmentMoveLoadChange[];
  toNurseId: string;
  warnings: Flag[];
};

const previewWarningTypes = new Set<Flag["type"]>([
  "over_side_load_limit",
  "over_max_load",
  "team_imbalance",
]);

function getNewOrWorsenedWarnings(currentFlags: Flag[], proposedFlags: Flag[]) {
  const currentFlagsById = new Map(currentFlags.map((flag) => [flag.id, flag]));

  return proposedFlags.filter((flag) => {
    if (!previewWarningTypes.has(flag.type)) {
      return false;
    }

    const currentFlag = currentFlagsById.get(flag.id);

    return !currentFlag || currentFlag.message !== flag.message;
  });
}

function getLoadSummary(
  currentAssignmentResult: AssignmentResult,
  proposedAssignmentResult: AssignmentResult,
  nurseIds: string[],
): AssignmentMoveLoadChange[] {
  const currentLoads = getAssignmentLoadsByNurseId(currentAssignmentResult);
  const proposedLoads = getAssignmentLoadsByNurseId(proposedAssignmentResult);

  return Array.from(new Set(nurseIds)).map((nurseId) => ({
    after: proposedLoads[nurseId] ?? 0,
    before: currentLoads[nurseId] ?? 0,
    nurseId,
  }));
}

export function getAssignmentMovePreview(
  activeShift: Shift,
  currentAssignmentResult: AssignmentResult,
  bedId: string,
  toNurseId: string,
): AssignmentMovePreview {
  const blockingReasons: AssignmentMoveBlockingReason[] = [];
  const bed = activeShift.beds.find((candidateBed) => candidateBed.id === bedId);
  const bedState = activeShift.bedStates.find(
    (candidateBedState) => candidateBedState.bedId === bedId,
  );
  const currentAssignment = currentAssignmentResult.bedAssignments.find(
    (assignment) => assignment.bedId === bedId,
  );
  const targetNurse = activeShift.nurses.find(
    (nurse) => nurse.id === toNurseId,
  );

  if (!bed) {
    blockingReasons.push({
      code: "bed_not_found",
      message: "This bed is no longer part of the active shift.",
    });
  } else if (!isOccupiedBedState(bedState)) {
    blockingReasons.push({
      code: "bed_not_occupied",
      message: `Bed ${bed.label} is not occupied.`,
    });
  }

  if (!currentAssignment) {
    blockingReasons.push({
      code: "bed_not_assigned",
      message: "This bed does not currently have an assigned nurse.",
    });
  }

  if (!targetNurse) {
    blockingReasons.push({
      code: "target_nurse_not_found",
      message: "The selected nurse is no longer on this shift.",
    });
  }

  if (currentAssignment?.nurseId === toNurseId) {
    blockingReasons.push({
      code: "same_nurse",
      message: "Choose a different nurse for this bed.",
    });
  }

  const roomCoverage = bed
    ? currentAssignmentResult.roomCoverage.find(
        (coverage) => coverage.roomId === bed.roomId,
      )
    : undefined;

  if (bed && targetNurse && !roomCoverage?.nurseIds.includes(targetNurse.id)) {
    blockingReasons.push({
      code: "outside_room_coverage",
      message: `${targetNurse.name} does not cover this room.`,
    });
  }

  if (
    bedState?.acuity === "red" &&
    targetNurse &&
    targetNurse.licenseType !== "RN"
  ) {
    blockingReasons.push({
      code: "red_requires_rn",
      message: "A red-acuity bed must be assigned to an RN.",
    });
  }

  if (blockingReasons.length > 0 || !currentAssignment) {
    return {
      bedId,
      blockingReasons,
      fromNurseId: currentAssignment?.nurseId,
      resultingLoadSummary: [],
      toNurseId,
      warnings: [],
    };
  }

  const resultingAssignmentResult: AssignmentResult = {
    ...currentAssignmentResult,
    bedAssignments: currentAssignmentResult.bedAssignments.map((assignment) =>
      assignment.bedId === bedId
        ? { ...assignment, nurseId: toNurseId }
        : { ...assignment },
    ),
  };
  const currentFlags = generateAssignmentFlags(
    activeShift,
    currentAssignmentResult,
  );
  const proposedFlags = generateAssignmentFlags(
    activeShift,
    resultingAssignmentResult,
  );

  return {
    bedId,
    blockingReasons,
    fromNurseId: currentAssignment.nurseId,
    resultingAssignmentResult,
    resultingLoadSummary: getLoadSummary(
      currentAssignmentResult,
      resultingAssignmentResult,
      [currentAssignment.nurseId, toNurseId],
    ),
    toNurseId,
    warnings: getNewOrWorsenedWarnings(currentFlags, proposedFlags),
  };
}
