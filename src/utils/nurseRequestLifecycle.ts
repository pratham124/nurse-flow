import type {
  ActiveAssignmentOverridesByBedId,
  NurseIssueReviewStatus,
  NurseRequest,
} from "../types/models";

export const NURSE_REQUEST_LIFECYCLE_STATE = {
  ISSUE_OPEN: "issue_open",
  ISSUE_REVIEWED: "issue_reviewed",
  ISSUE_RESOLVED: "issue_resolved",
  SWAP_ACCEPTED_PENDING_CHANGE: "swap_accepted_pending_change",
  SWAP_COMPLETED: "swap_completed",
  SWAP_COMPLETED_ASSIGNMENT_CHANGED:
    "swap_completed_assignment_changed",
  SWAP_DECLINED: "swap_declined",
  SWAP_PENDING: "swap_pending",
} as const;

export type NurseRequestLifecycleState =
  (typeof NURSE_REQUEST_LIFECYCLE_STATE)[
    keyof typeof NURSE_REQUEST_LIFECYCLE_STATE
  ];

export function getIssueReviewStatus(
  request: NurseRequest,
): NurseIssueReviewStatus {
  if (request.type !== "issue") {
    return "open";
  }

  return request.issueReviewStatus ?? "open";
}

export function getNurseRequestLifecycleState(
  request: NurseRequest,
  activeAssignmentOverridesByBedId?: ActiveAssignmentOverridesByBedId,
): NurseRequestLifecycleState {
  if (request.type === "issue") {
    const issueStatus = getIssueReviewStatus(request);

    if (issueStatus === "reviewed") {
      return NURSE_REQUEST_LIFECYCLE_STATE.ISSUE_REVIEWED;
    }

    if (issueStatus === "resolved") {
      return NURSE_REQUEST_LIFECYCLE_STATE.ISSUE_RESOLVED;
    }

    return NURSE_REQUEST_LIFECYCLE_STATE.ISSUE_OPEN;
  }

  if (request.status === "pending") {
    return NURSE_REQUEST_LIFECYCLE_STATE.SWAP_PENDING;
  }

  if (request.status === "declined") {
    return NURSE_REQUEST_LIFECYCLE_STATE.SWAP_DECLINED;
  }

  if (!request.completedOverrideId) {
    return NURSE_REQUEST_LIFECYCLE_STATE.SWAP_ACCEPTED_PENDING_CHANGE;
  }

  const activeOverride = request.sourceBedId
    ? activeAssignmentOverridesByBedId?.[request.sourceBedId]
    : undefined;
  const assignmentChangedLater =
    request.completedAssignmentChangedLater === true ||
    (activeAssignmentOverridesByBedId !== undefined &&
      activeOverride?.id !== request.completedOverrideId);

  return assignmentChangedLater
    ? NURSE_REQUEST_LIFECYCLE_STATE.SWAP_COMPLETED_ASSIGNMENT_CHANGED
    : NURSE_REQUEST_LIFECYCLE_STATE.SWAP_COMPLETED;
}

export function getNurseRequestLifecycleLabel(
  request: NurseRequest,
  activeAssignmentOverridesByBedId?: ActiveAssignmentOverridesByBedId,
) {
  const state = getNurseRequestLifecycleState(
    request,
    activeAssignmentOverridesByBedId,
  );

  switch (state) {
    case NURSE_REQUEST_LIFECYCLE_STATE.ISSUE_OPEN:
      return "Open";
    case NURSE_REQUEST_LIFECYCLE_STATE.ISSUE_REVIEWED:
      return "Reviewed";
    case NURSE_REQUEST_LIFECYCLE_STATE.ISSUE_RESOLVED:
      return "Resolved";
    case NURSE_REQUEST_LIFECYCLE_STATE.SWAP_PENDING:
      return "Pending";
    case NURSE_REQUEST_LIFECYCLE_STATE.SWAP_DECLINED:
      return "Declined";
    case NURSE_REQUEST_LIFECYCLE_STATE.SWAP_ACCEPTED_PENDING_CHANGE:
      return "Accepted — assignment change pending";
    case NURSE_REQUEST_LIFECYCLE_STATE.SWAP_COMPLETED_ASSIGNMENT_CHANGED:
      return "Completed — assignment later changed";
    case NURSE_REQUEST_LIFECYCLE_STATE.SWAP_COMPLETED:
      return "Completed";
  }
}
