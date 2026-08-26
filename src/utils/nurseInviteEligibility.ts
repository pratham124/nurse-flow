import type { AssignmentResult, Shift } from "../types/models";
import { isOccupiedBedState } from "./census";

export function getNurseAssignedPatientCount(
  shift: Shift | undefined,
  assignmentResult: AssignmentResult | undefined,
  nurseId: string,
) {
  if (!shift || !assignmentResult) {
    return 0;
  }

  const occupiedBedIds = new Set(
    shift.bedStates
      .filter(isOccupiedBedState)
      .map((bedState) => bedState.bedId),
  );

  return assignmentResult.bedAssignments.filter(
    (assignment) =>
      assignment.nurseId === nurseId && occupiedBedIds.has(assignment.bedId),
  ).length;
}

export function nurseHasAssignedPatients(
  shift: Shift | undefined,
  assignmentResult: AssignmentResult | undefined,
  nurseId: string,
) {
  return getNurseAssignedPatientCount(shift, assignmentResult, nurseId) > 0;
}
