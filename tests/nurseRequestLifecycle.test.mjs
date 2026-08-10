import assert from "node:assert/strict";
import test from "node:test";

import {
  getIssueReviewStatus,
  getNurseRequestLifecycleLabel,
  getNurseRequestLifecycleState,
} from "../src/utils/nurseRequestLifecycle.ts";

const baseIssue = {
  createdAt: "2026-08-08T12:00:00.000Z",
  id: "issue-1",
  message: "Please review this issue.",
  requestingNurseId: "nurse-a",
  requestingNurseName: "Avery",
  status: "pending",
  type: "issue",
};

const baseSwap = {
  createdAt: "2026-08-08T12:00:00.000Z",
  id: "swap-1",
  message: "Please move this patient.",
  requestingNurseId: "nurse-a",
  requestingNurseName: "Avery",
  sourceBedId: "bed-a",
  status: "accepted",
  type: "swap",
};

test("existing issues default to the open lifecycle state", () => {
  assert.equal(getIssueReviewStatus(baseIssue), "open");
  assert.equal(getNurseRequestLifecycleState(baseIssue), "issue_open");
  assert.equal(getNurseRequestLifecycleLabel(baseIssue), "Open");
});

test("issue review and resolution labels use issue lifecycle fields", () => {
  assert.equal(
    getNurseRequestLifecycleLabel({
      ...baseIssue,
      issueReviewStatus: "reviewed",
    }),
    "Reviewed",
  );
  assert.equal(
    getNurseRequestLifecycleLabel({
      ...baseIssue,
      issueReviewStatus: "resolved",
    }),
    "Resolved",
  );
});

test("accepted swaps stay pending until a linked override completes them", () => {
  assert.equal(
    getNurseRequestLifecycleState(baseSwap),
    "swap_accepted_pending_change",
  );
  assert.equal(
    getNurseRequestLifecycleLabel(baseSwap),
    "Accepted — assignment change pending",
  );
});

test("a completed swap stays current while its linked override is active", () => {
  const completedSwap = {
    ...baseSwap,
    completedOverrideId: "override-1",
  };
  const activeOverrides = {
    "bed-a": {
      id: "override-1",
    },
  };

  assert.equal(
    getNurseRequestLifecycleState(completedSwap, activeOverrides),
    "swap_completed",
  );
  assert.equal(
    getNurseRequestLifecycleLabel(completedSwap, activeOverrides),
    "Completed",
  );
});

test("a later same-bed move does not erase the earlier completion", () => {
  const completedSwap = {
    ...baseSwap,
    completedOverrideId: "override-1",
  };
  const activeOverrides = {
    "bed-a": {
      id: "override-2",
    },
  };

  assert.equal(
    getNurseRequestLifecycleState(completedSwap, activeOverrides),
    "swap_completed_assignment_changed",
  );
  assert.equal(
    getNurseRequestLifecycleLabel(completedSwap, activeOverrides),
    "Completed — assignment later changed",
  );
});

test("the joined-nurse scoped marker supports the same later-change label", () => {
  const joinedRequest = {
    ...baseSwap,
    completedAssignmentChangedLater: true,
    completedOverrideId: "override-1",
  };

  assert.equal(
    getNurseRequestLifecycleState(joinedRequest),
    "swap_completed_assignment_changed",
  );
});
