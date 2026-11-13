import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChargeChatList,
  findNurseChat,
  getChatRequestId,
  needsReply,
} from "../src/utils/nurseChats.ts";

const nurse = (id, name) => ({
  experienceLevel: "senior",
  id,
  licenseType: "RN",
  maxPatientLoad: 4,
  name,
});

function chat(nurseId, overrides = {}) {
  return {
    createdAt: "2026-11-01T08:00:00Z",
    id: getChatRequestId(nurseId),
    requestingNurseId: nurseId,
    requestingNurseName: nurseId,
    type: "chat",
    ...overrides,
  };
}

test("chat IDs are deterministic per nurse", () => {
  assert.equal(getChatRequestId("nurse-1"), "nurse-chat-nurse-1");
});

test("finds a nurse's chat and ignores legacy issue and swap entries", () => {
  const requests = [
    { ...chat("nurse-1"), id: "nurse-request-1", type: "issue" },
    { ...chat("nurse-1"), id: "nurse-request-2", type: "swap" },
    chat("nurse-1"),
    chat("nurse-2"),
  ];

  assert.equal(findNurseChat(requests, "nurse-1")?.id, "nurse-chat-nurse-1");
  assert.equal(findNurseChat(requests, "nurse-3"), undefined);
  assert.equal(findNurseChat(undefined, "nurse-1"), undefined);
});

test("needs a reply only when the last message is from someone else", () => {
  const withMessage = chat("nurse-1", {
    lastMessageAt: "2026-11-01T09:00:00Z",
    lastMessageAuthorProfileId: "nurse-profile",
  });

  assert.equal(needsReply(withMessage, "charge-profile"), true);
  assert.equal(needsReply(withMessage, "nurse-profile"), false);
  assert.equal(needsReply(chat("nurse-1"), "charge-profile"), false);
  assert.equal(needsReply(undefined, "charge-profile"), false);
});

test("sorts needs-reply first, then newest, then nurses without messages by name", () => {
  const nurses = [
    nurse("a", "Zed"),
    nurse("b", "Ann"),
    nurse("c", "Bea"),
    nurse("d", "Cy"),
    nurse("e", "Dee"),
  ];
  const requests = [
    // Charge replied last, newest activity.
    chat("a", {
      lastMessageAt: "2026-11-01T12:00:00Z",
      lastMessageAuthorProfileId: "charge",
    }),
    // Charge replied last, older.
    chat("c", {
      lastMessageAt: "2026-11-01T10:00:00Z",
      lastMessageAuthorProfileId: "charge",
    }),
    // Needs reply, older than a.
    chat("d", {
      lastMessageAt: "2026-11-01T09:00:00Z",
      lastMessageAuthorProfileId: "nurse-d",
    }),
    // Needs reply, newest of the needs-reply group.
    chat("e", {
      lastMessageAt: "2026-11-01T11:00:00Z",
      lastMessageAuthorProfileId: "nurse-e",
    }),
    // b has a chat entry but no messages.
    chat("b"),
  ];

  const rows = buildChargeChatList(nurses, requests, "charge");

  assert.deepEqual(
    rows.map((row) => row.nurse.id),
    ["e", "d", "a", "c", "b"],
  );
  assert.deepEqual(
    rows.map((row) => row.needsReply),
    [true, true, false, false, false],
  );
});

test("lists every nurse even without a chat entry", () => {
  const rows = buildChargeChatList(
    [nurse("b", "Bea"), nurse("a", "Ann")],
    undefined,
    "charge",
  );

  assert.deepEqual(
    rows.map((row) => row.nurse.name),
    ["Ann", "Bea"],
  );
  assert.ok(rows.every((row) => row.chat === undefined && !row.needsReply));
});
