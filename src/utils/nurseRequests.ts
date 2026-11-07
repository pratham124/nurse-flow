import type { NurseRequest, Shift } from "../types/models";

const nurseRequestIdPrefix = "nurse-request";

export function getShiftNurseRequests(activeShift?: Shift): NurseRequest[] {
  const requests = activeShift?.nurseRequests ?? [];
  const usedIds = new Set<string>();
  let nextNumber = requests.length + 1;

  return requests.map((request) => {
    if (!usedIds.has(request.id)) {
      usedIds.add(request.id);
      return request;
    }

    let nextId = `${nurseRequestIdPrefix}-${nextNumber}`;

    while (usedIds.has(nextId)) {
      nextNumber += 1;
      nextId = `${nurseRequestIdPrefix}-${nextNumber}`;
    }

    usedIds.add(nextId);
    nextNumber += 1;

    return {
      ...request,
      id: nextId,
    };
  });
}

export function getNurseRequestsForNurse(
  activeShift: Shift | undefined,
  nurseId: string | undefined,
): NurseRequest[] {
  if (!nurseId) {
    return [];
  }

  return getShiftNurseRequests(activeShift).filter(
    (request) => request.requestingNurseId === nurseId,
  );
}
