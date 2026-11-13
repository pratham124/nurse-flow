import type { Nurse, NurseRequest } from "../types/models";

export type ChargeChatRow = {
  chat?: NurseRequest;
  needsReply: boolean;
  nurse: Nurse;
};

const chatIdPrefix = "nurse-chat-";

// The chat between charge and one nurse has a fixed ID, so both apps (and the
// server) always agree on which thread belongs to which nurse.
export function getChatRequestId(nurseId: string) {
  return `${chatIdPrefix}${nurseId}`;
}

// Works on the shift's requests (charge side) and on the joined nurse's
// request history. Old issue/swap entries are skipped because the ID differs.
export function findNurseChat(
  requests: NurseRequest[] | undefined,
  nurseId: string,
) {
  const chatId = getChatRequestId(nurseId);

  return requests?.find(
    (request) => request.type === "chat" && request.id === chatId,
  );
}

// A chat needs a reply when it has messages and the newest one was written by
// someone other than the person looking at it.
export function needsReply(
  chat: NurseRequest | undefined,
  currentProfileId: string,
) {
  if (!chat?.lastMessageAt || !chat.lastMessageAuthorProfileId) {
    return false;
  }

  return chat.lastMessageAuthorProfileId !== currentProfileId;
}

function getMessageTimestamp(chat?: NurseRequest) {
  const timestamp = Date.parse(chat?.lastMessageAt ?? "");

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

// One row per nurse: needs-reply first, then newest message, then nurses
// without any messages by name.
export function buildChargeChatList(
  nurses: Nurse[],
  requests: NurseRequest[] | undefined,
  chargeProfileId: string,
): ChargeChatRow[] {
  const rows = nurses.map((nurse) => {
    const chat = findNurseChat(requests, nurse.id);

    return { chat, needsReply: needsReply(chat, chargeProfileId), nurse };
  });

  return rows.sort((first, second) => {
    if (first.needsReply !== second.needsReply) {
      return first.needsReply ? -1 : 1;
    }

    const timeDifference =
      getMessageTimestamp(second.chat) - getMessageTimestamp(first.chat);

    return timeDifference || first.nurse.name.localeCompare(second.nurse.name);
  });
}

const chatTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
});

// Short label for the "latest message" time on chat cards and rows.
export function formatChatTime(timestamp: string | undefined) {
  const date = new Date(timestamp ?? "");

  return Number.isNaN(date.getTime()) ? "" : chatTimeFormatter.format(date);
}
