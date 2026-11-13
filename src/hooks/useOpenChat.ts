import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import { getSupabaseClient } from "../services/supabaseClient";
import type { NurseRequest } from "../types/models";

type UseOpenChatInput = {
  // Unique name for the chat being opened, such as "<shiftId>:<nurseId>".
  // Leave it empty while the screen is not ready to open a chat.
  chatKey: string;
  // Calls the Go "open chat" route. It is safe to call more than once because
  // the server returns the existing chat when there already is one.
  openChat: (supabase: SupabaseClient) => Promise<NurseRequest>;
};

type OpenChatState =
  | { chatKey: string; status: "opening" }
  | { chatId: string; chatKey: string; status: "ready" }
  | { chatKey: string; errorMessage: string; status: "error" };

// Opens the chat once when the screen mounts, then reports the chat ID so the
// message thread can load. Shows loading and error states with a retry.
export function useOpenChat({ chatKey, openChat }: UseOpenChatInput) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<OpenChatState>();
  const openChatRef = useRef(openChat);

  useEffect(() => {
    openChatRef.current = openChat;
  }, [openChat]);

  useEffect(() => {
    if (!chatKey) {
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setState({
        chatKey,
        errorMessage: "Supabase is not configured yet.",
        status: "error",
      });
      return;
    }

    let isCurrent = true;

    setState({ chatKey, status: "opening" });
    openChatRef
      .current(supabase)
      .then((chat) => {
        if (isCurrent) {
          setState({ chatId: chat.id, chatKey, status: "ready" });
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setState({
            chatKey,
            errorMessage:
              error instanceof Error
                ? error.message
                : "The chat could not be opened. Try again.",
            status: "error",
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [attempt, chatKey]);

  const retry = useCallback(() => {
    setAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  // Ignore a result that belongs to a different chat than the one requested.
  const currentState = state?.chatKey === chatKey ? state : undefined;

  return {
    chatId: currentState?.status === "ready" ? currentState.chatId : undefined,
    errorMessage:
      currentState?.status === "error" ? currentState.errorMessage : "",
    isOpening:
      Boolean(chatKey) &&
      currentState?.status !== "error" &&
      currentState?.status !== "ready",
    retry,
  };
}
