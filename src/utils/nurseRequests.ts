import type { LocalId, NurseRequest, Shift } from "../types/models";

export function getShiftNurseRequests(activeShift?: Shift): NurseRequest[] {
  return activeShift?.nurseRequests ?? [];
}

export function getNurseRequestsForNurse(
  activeShift: Shift | undefined,
  nurseId: LocalId | undefined,
): NurseRequest[] {
  if (!nurseId) {
    return [];
  }

  return getShiftNurseRequests(activeShift).filter(
    (request) => request.requestingNurseId === nurseId,
  );
}
