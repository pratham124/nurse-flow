import assert from "node:assert/strict";
import test from "node:test";

import {
  getNotificationTapHref,
  parseNotificationTapPayload,
} from "../src/utils/notificationTap.ts";

test("joined request notifications retain the scoped access and request IDs", () => {
  assert.deepEqual(
    parseNotificationTapPayload({
      recipient_access_id: "access-1",
      related_request_id: "request-1",
      shift_id: "shift-1",
      target_route: "requestDetail",
    }),
    {
      recipientAccessId: "access-1",
      relatedRequestId: "request-1",
      shiftId: "shift-1",
      targetRoute: "requestDetail",
    },
  );
});

test("request-detail notifications without a request ID are rejected", () => {
  assert.equal(
    parseNotificationTapPayload({
      shiftId: "shift-1",
      targetRoute: "requestDetail",
    }),
    undefined,
  );
});

const chat = { requestingNurseId: "nurse-1", type: "chat" };
const legacyIssue = { requestingNurseId: "nurse-1", type: "issue" };

test("a chat message tap opens the nurse's chat", () => {
  assert.equal(
    getNotificationTapHref({
      audience: "joined_nurse",
      request: chat,
      targetRoute: "requestDetail",
    }),
    "/joined-chat",
  );
});

test("a chat message tap opens that nurse's chat for charge", () => {
  assert.equal(
    getNotificationTapHref({
      audience: "charge",
      request: { requestingNurseId: "nurse/1", type: "chat" },
      targetRoute: "requestDetail",
    }),
    "/charge-chat?nurseId=nurse%2F1",
  );
});

test("old issue and swap request taps fall back to the main screens", () => {
  assert.equal(
    getNotificationTapHref({
      audience: "joined_nurse",
      request: legacyIssue,
      targetRoute: "requestDetail",
    }),
    "/regular-nurse-workspace",
  );
  assert.equal(
    getNotificationTapHref({
      audience: "charge",
      request: legacyIssue,
      targetRoute: "requestDetail",
    }),
    "/flags",
  );
});

test("non-request notification taps keep their existing destinations", () => {
  assert.equal(
    getNotificationTapHref({ audience: "charge", targetRoute: "flags" }),
    "/flags",
  );
  assert.equal(
    getNotificationTapHref({ audience: "charge", targetRoute: "floorBoard" }),
    "/floor-board",
  );
  assert.equal(
    getNotificationTapHref({
      audience: "joined_nurse",
      targetRoute: "joinedNurseAssignment",
    }),
    "/regular-nurse-workspace",
  );
});
