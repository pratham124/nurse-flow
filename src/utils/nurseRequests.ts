import type { LocalId, NurseRequest, Shift } from "../types/models";

const nurseRequestIdPrefix = "nurse-request";

export function getShiftNurseRequests(activeShift?: Shift): NurseRequest[] {
  return getRequestsWithUniqueIds(activeShift?.nurseRequests ?? []);
}

export function createNurseRequestId(activeShift?: Shift): LocalId {
  const requests = getShiftNurseRequests(activeShift);
  const usedIds = new Set(requests.map((request) => request.id));
  let nextNumber = requests.length + 1;
  let nextId = `${nurseRequestIdPrefix}-${nextNumber}`;

  while (usedIds.has(nextId)) {
    nextNumber += 1;
    nextId = `${nurseRequestIdPrefix}-${nextNumber}`;
  }

  return nextId;
}

function getRequestsWithUniqueIds(requests: NurseRequest[]): NurseRequest[] {
  const usedIds = new Set<LocalId>();
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
  nurseId: LocalId | undefined,
): NurseRequest[] {
  if (!nurseId) {
    return [];
  }

  return getShiftNurseRequests(activeShift).filter(
    (request) => request.requestingNurseId === nurseId,
  );
}
