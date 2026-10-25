import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { goApiClient } from "./goApiClient";
import { getGoAuthHeaders } from "./goApiAuth";
import { readGoApiFailure, throwGoNetworkError } from "./goApiErrors";

import type { NurseRequestMessage } from "../types/models";

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

const requestMessageSchema = z.object({
  authorProfileId: z.string().min(1),
  body: z.string().min(1),
  clientMutationId: z.string().nullish(),
  createdAt: z.string().min(1),
  id: z.string().min(1),
  requestId: z.string().min(1),
  shiftId: z.string().min(1),
});

const messageListSchema = z.object({ messages: z.array(requestMessageSchema) });

const appendResultSchema = z.object({
  message: requestMessageSchema,
  status: z.enum(["saved", "duplicate"]),
});

function toNurseRequestMessage(
  message: z.infer<typeof requestMessageSchema>,
): NurseRequestMessage {
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

// Turns a failed Go request into an error the screen can show. The server's
// own message is used when it sent one.
function threadRequestError(error: unknown): never {
  const failure = readGoApiFailure(error);

  if (!failure) {
    return throwGoNetworkError(error, "request thread service");
  }

  if (failure.status === 401) {
    throw new Error("Your session expired. Sign in again.");
  }

  throw new Error(
    failure.message || "The request thread is temporarily unavailable. Try again.",
  );
}

function getMessagesPath(thread: { requestId: string; shiftId: string }) {
  return `/shifts/${encodeURIComponent(thread.shiftId)}/requests/${encodeURIComponent(thread.requestId)}/messages`;
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
  const headers = await getGoAuthHeaders(supabase);
  const response = await goApiClient
    .get<unknown>(getMessagesPath(thread), { headers })
    .catch(threadRequestError);
  const result = messageListSchema.safeParse(response.data);

  if (response.status !== 200 || !result.success) {
    throw new Error("The request thread returned an invalid server shape.");
  }

  return result.data.messages.map(toNurseRequestMessage);
}

export async function appendRequestMessage(
  supabase: SupabaseClient,
  input: AppendRequestMessageInput,
): Promise<AppendRequestMessageResult> {
  const thread = requireThreadInput(input);
  const body = getRequestMessageBody(input.body);
  const clientMutationId = getClientMutationId(input.clientMutationId);
  const headers = await getGoAuthHeaders(supabase);
  const response = await goApiClient
    .post<unknown>(
      getMessagesPath(thread),
      clientMutationId ? { body, client_mutation_id: clientMutationId } : { body },
      { headers },
    )
    .catch(threadRequestError);
  const result = appendResultSchema.safeParse(response.data);

  if (
    !result.success ||
    (response.status !== 200 && response.status !== 201)
  ) {
    throw new Error("The request message returned an invalid server result.");
  }

  return {
    message: toNurseRequestMessage(result.data.message),
    status: result.data.status,
  };
}
