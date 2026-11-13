// Launched by TestChatHTTPDemo with synthetic JWTs and local Postgres.
// Never point this script at a live project or supply real user credentials.
import assert from "node:assert/strict";
import {
  loadJoinedNurseAssignmentView,
  openJoinedNurseChat,
  openShiftNurseChat,
} from "../src/services/serverWorkspaceRepository.ts";
import { loadServerActiveShift } from "../src/services/shiftRepository.ts";
import {
  appendRequestMessage,
  listRequestMessages,
} from "../src/services/requestMessageRepository.ts";
import {
  buildChargeChatList,
  findNurseChat,
  getChatRequestId,
  needsReply,
} from "../src/utils/nurseChats.ts";

const env = (name) => process.env[name];
const client = (token) => ({
  auth: {
    getSession: async () => ({ data: { session: { access_token: token } } }),
  },
});
const alphaProfile = JSON.parse(env("NURSEFLOW_CHAT_ALPHA_PROFILE"));
const regularProfile = JSON.parse(env("NURSEFLOW_CHAT_REGULAR_PROFILE"));
const alpha = client(env("NURSEFLOW_CHAT_ALPHA_TOKEN"));
const regular = client(env("NURSEFLOW_CHAT_REGULAR_TOKEN"));
const beta = client(env("NURSEFLOW_CHAT_BETA_TOKEN"));
const shiftId = env("NURSEFLOW_CHAT_SHIFT_ID");
const linkedNurseId = env("NURSEFLOW_CHAT_LINKED_NURSE_ID");
const otherNurseId = env("NURSEFLOW_CHAT_OTHER_NURSE_ID");
const chatId = `nurse-chat-${linkedNurseId}`;
const thread = { shiftId, requestId: chatId };

// 1. The nurse opens their chat; opening again is idempotent.
const opened = await openJoinedNurseChat(regular);
assert.equal(opened.id, chatId);
assert.equal(opened.type, "chat");
assert.equal(getChatRequestId(linkedNurseId), chatId);
assert.equal((await openJoinedNurseChat(regular)).id, chatId);

// 2. The nurse sends a message; their joined view shows it, nothing to reply to.
const firstBody = "Room 101 needs help turning a patient.";
const sent = await appendRequestMessage(regular, { ...thread, body: firstBody });
assert.equal(sent.status, "saved");
const nurseView = await loadJoinedNurseAssignmentView(regular, regularProfile);
const nurseChat = findNurseChat(nurseView.requestHistory, linkedNurseId);
assert.ok(nurseChat);
assert.equal(nurseChat.lastMessagePreview, firstBody);
assert.equal(nurseChat.lastMessageAuthorProfileId, regularProfile.id);
assert.equal(needsReply(nurseChat, regularProfile.id), false);

// 3. Charge loads the shift: the nurse's chat is first and needs a reply.
const record = await loadServerActiveShift(alpha, alphaProfile);
assert.equal(record.id, shiftId);
const shift = record.shiftSnapshot;
const rows = buildChargeChatList(shift.nurses, shift.nurseRequests, alphaProfile.id);
assert.equal(rows.length, 2);
assert.equal(rows[0].nurse.id, linkedNurseId);
assert.equal(rows[0].needsReply, true);
assert.equal(rows[0].chat.lastMessagePreview, firstBody);
assert.equal(rows[1].nurse.id, otherNurseId);
assert.equal(rows[1].needsReply, false);

// 4. Charge opens the same chat, reads the nurse's message, and replies.
const chargeChat = await openShiftNurseChat(alpha, { shiftId, nurseId: linkedNurseId });
assert.equal(chargeChat.id, chatId);
const chargeMessages = await listRequestMessages(alpha, thread);
assert.deepEqual(chargeMessages.map((m) => m.body), [firstBody]);
const replyBody = "On my way.";
await appendRequestMessage(alpha, { ...thread, body: replyBody });
const nurseMessages = await listRequestMessages(regular, thread);
assert.deepEqual(nurseMessages.map((m) => m.body), [firstBody, replyBody]);
assert.deepEqual(nurseMessages.map((m) => m.authorProfileId), [
  regularProfile.id,
  alphaProfile.id,
]);
const nurseViewAfter = await loadJoinedNurseAssignmentView(regular, regularProfile);
const nurseChatAfter = findNurseChat(nurseViewAfter.requestHistory, linkedNurseId);
assert.equal(nurseChatAfter.lastMessagePreview, replyBody);
assert.equal(needsReply(nurseChatAfter, regularProfile.id), true);
const shiftAfter = (await loadServerActiveShift(alpha, alphaProfile)).shiftSnapshot;
const rowsAfter = buildChargeChatList(
  shiftAfter.nurses,
  shiftAfter.nurseRequests,
  alphaProfile.id,
);
assert.equal(rowsAfter.find((r) => r.nurse.id === linkedNurseId).needsReply, false);

// 5. Charge opens a chat with the nurse who has no linked account: created, empty.
const otherChat = await openShiftNurseChat(alpha, { shiftId, nurseId: otherNurseId });
assert.equal(otherChat.id, `nurse-chat-${otherNurseId}`);
assert.deepEqual(
  await listRequestMessages(alpha, { shiftId, requestId: otherChat.id }),
  [],
);

// 6. An unknown nurse is rejected with the nurse_not_found message.
await assert.rejects(
  openShiftNurseChat(alpha, { shiftId, nurseId: "nurse-ghost" }),
  /no longer on this shift/,
);

// 7. A different charge nurse cannot read this chat (thread_not_found).
await assert.rejects(
  listRequestMessages(beta, thread),
  /do not have access to this request thread/,
);

console.log(
  "Actual TS repositories -> Go HTTP/JWT/role -> limited-role Postgres chat flow passed: open (idempotent), nurse send, charge list ordering and needs-reply, charge open/reply, ordered messages, unlinked-nurse chat, nurse_not_found, foreign charge denied.",
);
