import assert from "node:assert/strict";
import test from "node:test";

import { parseNotificationTapPayload } from "../src/utils/notificationTap.ts";

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
