import type {
  ActiveAssignmentOverridesByBedId,
  NurseIssueReviewStatus,
  NurseRequest,
  Shift,
} from "../types/models";
import {
  getIssueReviewStatus,
  getNurseRequestLifecycleLabel,
  getNurseRequestLifecycleState,
  type NurseRequestLifecycleState,
} from "./nurseRequestLifecycle";
import { getShiftNurseRequests } from "./nurseRequests";

export type NurseRequestDisplay = {
  bedContext: string;
  createdAtText: string;
  id: string;
  issueReviewStatus?: NurseIssueReviewStatus;
  lifecycleState: NurseRequestLifecycleState;
  message: string;
  requestStatus: NurseRequest["status"];
  requestType: NurseRequest["type"];
  requesterName: string;
  resolvedAtText?: string;
  sourceBedId?: string;
  statusLabel: string;
  swapCompletedAtText?: string;
  typeLabel: string;
};

export function getNurseRequestDisplays(
  activeShift?: Shift,
  activeAssignmentOverridesByBedId?: ActiveAssignmentOverridesByBedId,
): NurseRequestDisplay[] {
  if (!activeShift) {
    return [];
  }

  return getShiftNurseRequests(activeShift).map((request) =>
    getNurseRequestDisplay(
      activeShift,
      request,
      activeAssignmentOverridesByBedId,
    ),
  );
}

export function getNurseRequestDisplayById(
  activeShift: Shift | undefined,
  requestId: string | undefined,
  activeAssignmentOverridesByBedId?: ActiveAssignmentOverridesByBedId,
) {
  if (!activeShift || !requestId) {
    return undefined;
  }

  const request = getShiftNurseRequests(activeShift).find(
    (shiftRequest) => shiftRequest.id === requestId,
  );

  return request
    ? getNurseRequestDisplay(
        activeShift,
        request,
        activeAssignmentOverridesByBedId,
      )
    : undefined;
}

function getNurseRequestDisplay(
  activeShift: Shift,
  request: NurseRequest,
  activeAssignmentOverridesByBedId?: ActiveAssignmentOverridesByBedId,
): NurseRequestDisplay {
  return {
    bedContext: getRequestBedContext(activeShift, request),
    createdAtText: formatRequestTimestamp(request.createdAt),
    id: request.id,
    issueReviewStatus:
      request.type === "issue" ? getIssueReviewStatus(request) : undefined,
    lifecycleState: getNurseRequestLifecycleState(
      request,
      activeAssignmentOverridesByBedId,
    ),
    message: request.message,
    requestStatus: request.status,
    requestType: request.type,
    requesterName: request.requestingNurseName,
    resolvedAtText: request.resolvedAt
      ? formatRequestTimestamp(request.resolvedAt)
      : undefined,
    sourceBedId: request.sourceBedId,
    statusLabel: getNurseRequestLifecycleLabel(
      request,
      activeAssignmentOverridesByBedId,
    ),
    swapCompletedAtText: request.swapCompletedAt
      ? formatRequestTimestamp(request.swapCompletedAt)
      : undefined,
    typeLabel: request.type === "swap" ? "Swap request" : "Issue request",
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
