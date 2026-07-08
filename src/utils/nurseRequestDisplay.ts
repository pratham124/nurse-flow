import type { NurseRequest, Shift } from "../types/models";
import { getShiftNurseRequests } from "./nurseRequests";

export type NurseRequestDisplay = {
  bedContext: string;
  createdAtText: string;
  id: string;
  message: string;
  requestStatus: NurseRequest["status"];
  requestType: NurseRequest["type"];
  requesterName: string;
  resolvedAtText?: string;
  statusLabel: string;
  typeLabel: string;
};

export function getRequestTypeLabel(request: NurseRequest) {
  return request.type === "swap" ? "Swap request" : "Issue request";
}

export function getRequestStatusLabel(request: NurseRequest) {
  return request.status.charAt(0).toUpperCase() + request.status.slice(1);
}

export function getNurseRequestDisplays(
  activeShift?: Shift,
): NurseRequestDisplay[] {
  if (!activeShift) {
    return [];
  }

  return getShiftNurseRequests(activeShift).map((request) =>
    getNurseRequestDisplay(activeShift, request),
  );
}

export function getNurseRequestDisplayById(
  activeShift: Shift | undefined,
  requestId: string | undefined,
) {
  if (!activeShift || !requestId) {
    return undefined;
  }

  const request = getShiftNurseRequests(activeShift).find(
    (shiftRequest) => shiftRequest.id === requestId,
  );

  return request ? getNurseRequestDisplay(activeShift, request) : undefined;
}

function getNurseRequestDisplay(
  activeShift: Shift,
  request: NurseRequest,
): NurseRequestDisplay {
  return {
    bedContext: getRequestBedContext(activeShift, request),
    createdAtText: formatRequestTimestamp(request.createdAt),
    id: request.id,
    message: request.message,
    requestStatus: request.status,
    requestType: request.type,
    requesterName: request.requestingNurseName,
    resolvedAtText: request.resolvedAt
      ? formatRequestTimestamp(request.resolvedAt)
      : undefined,
    statusLabel: getRequestStatusLabel(request),
    typeLabel: getRequestTypeLabel(request),
  };
}

function formatRequestTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "numeric",
    year: "numeric",
  });
}

function getRequestBedContext(activeShift: Shift, request: NurseRequest) {
  if (!request.sourceBedId) {
    return request.type === "swap" ? "Bed no longer available" : "No specific bed";
  }

  const bed = activeShift.beds.find(
    (shiftBed) => shiftBed.id === request.sourceBedId,
  );

  if (!bed) {
    return "Bed no longer available";
  }

  const room = activeShift.rooms.find(
    (shiftRoom) => shiftRoom.id === bed.roomId,
  );

  return room
    ? `Room ${room.label} - Bed ${bed.label}`
    : `Bed ${bed.label}`;
}
