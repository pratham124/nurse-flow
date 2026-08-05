import type { SupabaseClient } from "@supabase/supabase-js";

import type { NurseRequestMessage } from "../types/models";

type RequestMessageSnapshot = {
  authorProfileId?: string;
  body?: string;
  clientMutationId?: string | null;
  createdAt?: string;
  id?: string;
  requestId?: string;
  shiftId?: string;
};

type AppendRequestMessageRpcResult = {
  message?: unknown;
  status?: string;
};

export type ListRequestMessagesInput = {
  requestId: string;
  shiftId: string;
};

export type AppendRequestMessageInput = ListRequestMessagesInput & {
  body: string;
  clientMutationId?: string;
};

export type AppendRequestMessageResult = {
  message: NurseRequestMessage;
  status: "duplicate" | "saved";
};

export const requestMessageBodyMaxLength = 1000;
export const requestMessageMutationIdMaxLength = 120;

function requireIdentifier(value: string, message: string) {
  const identifier = value.trim();

  if (!identifier) {
    throw new Error(message);
  }

  return identifier;
}

function getRequestMessageBody(body: string) {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    throw new Error("Write a message before sending.");
  }

  if (trimmedBody.length > requestMessageBodyMaxLength) {
    throw new Error(
      `Keep messages to ${requestMessageBodyMaxLength} characters or fewer.`,
    );
  }

  return trimmedBody;
}

function getClientMutationId(clientMutationId?: string) {
  const normalizedId = clientMutationId?.trim();

  if (!normalizedId) {
    return undefined;
  }

  if (normalizedId.length > requestMessageMutationIdMaxLength) {
    throw new Error(
      `Message retry identifiers must be ${requestMessageMutationIdMaxLength} characters or fewer.`,
    );
  }

  return normalizedId;
}

function requireRequestMessage(value: unknown): NurseRequestMessage {
  const message = value as RequestMessageSnapshot | undefined;

  if (
    !message?.id ||
    !message.shiftId ||
    !message.requestId ||
    !message.authorProfileId ||
    !message.body ||
    !message.createdAt
  ) {
    throw new Error("A request message has an invalid server shape.");
  }

  return {
    authorProfileId: message.authorProfileId,
    body: message.body,
    clientMutationId: message.clientMutationId ?? undefined,
    createdAt: message.createdAt,
    id: message.id,
    requestId: message.requestId,
    shiftId: message.shiftId,
  };
}

function requireThreadInput(input: ListRequestMessagesInput) {
  return {
    requestId: requireIdentifier(
      input.requestId,
      "Choose a nurse request before loading its messages.",
    ),
    shiftId: requireIdentifier(
      input.shiftId,
      "Choose an active shift before loading request messages.",
    ),
  };
}

export async function listRequestMessages(
  supabase: SupabaseClient,
  input: ListRequestMessagesInput,
) {
  const thread = requireThreadInput(input);
  const { data, error } = await supabase.rpc("list_nurse_request_messages", {
    p_request_id: thread.requestId,
    p_shift_id: thread.shiftId,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!Array.isArray(data)) {
    throw new Error("The request thread returned an invalid server shape.");
  }

  return data.map(requireRequestMessage);
}

export async function appendRequestMessage(
  supabase: SupabaseClient,
  input: AppendRequestMessageInput,
): Promise<AppendRequestMessageResult> {
  const thread = requireThreadInput(input);
  const body = getRequestMessageBody(input.body);
  const clientMutationId = getClientMutationId(input.clientMutationId);
  const { data, error } = await supabase.rpc("append_nurse_request_message", {
    p_body: body,
    p_client_mutation_id: clientMutationId ?? null,
    p_request_id: thread.requestId,
    p_shift_id: thread.shiftId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = data as AppendRequestMessageRpcResult | null;

  if (result?.status !== "saved" && result?.status !== "duplicate") {
    throw new Error("The request message returned an invalid server result.");
  }

  return {
    message: requireRequestMessage(result.message),
    status: result.status,
  };
}
