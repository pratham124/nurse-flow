import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createLocalId } from "../helpers/localId";
import {
  appendRequestMessage,
  listRequestMessages,
} from "../services/requestMessageRepository";
import { subscribeToRequestThread } from "../services/realtimeWorkspaceRepository";
import { getSupabaseClient } from "../services/supabaseClient";
import type {
  NurseRequestMessage,
  RealtimeConnectionState,
} from "../types/models";

type UseRequestThreadInput = {
  enabled: boolean;
  requestId?: string;
  shiftId?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getOrderedMessages(messages: NurseRequestMessage[]) {
  return [...messages].sort((firstMessage, secondMessage) => {
    const timeDifference =
      Date.parse(firstMessage.createdAt) - Date.parse(secondMessage.createdAt);

    return timeDifference || firstMessage.id.localeCompare(secondMessage.id);
  });
}

function mergeMessage(
  messages: NurseRequestMessage[],
  nextMessage: NurseRequestMessage,
) {
  const messageById = new Map(
    messages.map((message) => [message.id, message]),
  );

  messageById.set(nextMessage.id, nextMessage);

  return getOrderedMessages(Array.from(messageById.values()));
}

export function useRequestThread({
  enabled,
  requestId,
  shiftId,
}: UseRequestThreadInput) {
  const [connectionState, setConnectionState] =
    useState<RealtimeConnectionState>("disconnected");
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [messages, setMessages] = useState<NurseRequestMessage[]>([]);
  const [retryMutationId, setRetryMutationId] = useState<string>();
  const [sendError, setSendError] = useState("");
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);
  const refreshVersionRef = useRef(0);
  const threadKey = enabled && requestId && shiftId
    ? `${shiftId}:${requestId}`
    : "";

  useEffect(() => {
    setConnectionState("disconnected");
    setDraft("");
    setIsLoading(Boolean(threadKey));
    setIsSending(false);
    setLoadError("");
    setMessages([]);
    setRetryMutationId(undefined);
    setSendError("");
  }, [threadKey]);

  useEffect(() => {
    if (!threadKey || !requestId || !shiftId) {
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setConnectionState("error");
      setIsLoading(false);
      setLoadError("Supabase is not configured yet.");
      return;
    }

    const activeSupabase = supabase;
    const activeRequestId = requestId;
    const activeShiftId = shiftId;
    let isCurrentThread = true;

    async function refreshMessages(showLoading: boolean) {
      const refreshVersion = refreshVersionRef.current + 1;

      refreshVersionRef.current = refreshVersion;

      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const nextMessages = await listRequestMessages(activeSupabase, {
          requestId: activeRequestId,
          shiftId: activeShiftId,
        });

        if (
          isCurrentThread &&
          refreshVersion === refreshVersionRef.current
        ) {
          setLoadError("");
          setMessages(getOrderedMessages(nextMessages));
        }
      } catch (error) {
        if (
          isCurrentThread &&
          refreshVersion === refreshVersionRef.current
        ) {
          setLoadError(
            getErrorMessage(error, "Request messages could not be loaded."),
          );
        }
      } finally {
        if (
          isCurrentThread &&
          refreshVersion === refreshVersionRef.current
        ) {
          setIsLoading(false);
        }
      }
    }

    setConnectionState("connecting");

    const stopSubscription = subscribeToRequestThread({
      onConnectionStateChange: (nextConnectionState, error) => {
        if (!isCurrentThread) {
          return;
        }

        setConnectionState(nextConnectionState);

        if (error) {
          console.error(
            `[Realtime] Request thread listener ${nextConnectionState}.`,
            error,
          );
        }
      },
      onMessageChanged: () => {
        void refreshMessages(false);
      },
      requestId: activeRequestId,
      shiftId: activeShiftId,
      supabase: activeSupabase,
    });

    void refreshMessages(true);

    return () => {
      isCurrentThread = false;
      refreshVersionRef.current += 1;
      stopSubscription();
    };
  }, [requestId, shiftId, subscriptionAttempt, threadKey]);

  const changeDraft = useCallback((nextDraft: string) => {
    setDraft(nextDraft);
    setRetryMutationId(undefined);
    setSendError("");
  }, []);

  const retryThread = useCallback(() => {
    setLoadError("");
    setSubscriptionAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmedDraft = draft.trim();

    if (!enabled || !requestId || !shiftId || !trimmedDraft || isSending) {
      return;
    }

    if (connectionState !== "live") {
      setSendError("Reconnect before sending this message.");
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setSendError("Supabase is not configured yet.");
      return;
    }

    const clientMutationId =
      retryMutationId ?? createLocalId("request-message");

    setIsSending(true);
    setSendError("");

    try {
      const result = await appendRequestMessage(supabase, {
        body: trimmedDraft,
        clientMutationId,
        requestId,
        shiftId,
      });

      setMessages((currentMessages) =>
        mergeMessage(currentMessages, result.message),
      );
      setDraft("");
      setRetryMutationId(undefined);
    } catch (error) {
      setRetryMutationId(clientMutationId);
      setSendError(
        getErrorMessage(error, "Message could not be sent. Try again."),
      );
    } finally {
      setIsSending(false);
    }
  }, [
    connectionState,
    draft,
    enabled,
    isSending,
    requestId,
    retryMutationId,
    shiftId,
  ]);

  return useMemo(
    () => ({
      canSend:
        enabled &&
        connectionState === "live" &&
        Boolean(draft.trim()) &&
        !isSending,
      changeDraft,
      connectionState,
      draft,
      isLoading,
      isSending,
      loadError,
      messages,
      retryThread,
      sendError,
      sendMessage,
    }),
    [
      changeDraft,
      connectionState,
      draft,
      enabled,
      isLoading,
      isSending,
      loadError,
      messages,
      retryThread,
      sendError,
      sendMessage,
    ],
  );
}
