import { useShallow } from "zustand/react/shallow";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { RequestThread } from "../components/requests/RequestThread";
import { WorkflowScreen } from "../components/workflow";
import { useOpenChat } from "../hooks/useOpenChat";
import { useRequestThread } from "../hooks/useRequestThread";
import { openShiftNurseChat } from "../services/serverWorkspaceRepository";
import { useAuthSession } from "../store/AuthSessionContext";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import {
  colors,
  fontWeight,
  radius,
  shadows,
  spacing,
  textSize,
} from "../theme/tokens";
import { assignmentFlow } from "../utils/workflowFlows";

function getParamValue(param: string | string[] | undefined) {
  return Array.isArray(param) ? param[0] : param;
}

export default function ChargeNurseChatScreen() {
  const { authState } = useAuthSession();
  const { activeShift } = useServerWorkspace(
    useShallow((state) => ({ activeShift: state.activeShift })),
  );
  const { nurseId } = useLocalSearchParams<{
    nurseId?: string | string[];
  }>();
  const selectedNurseId = getParamValue(nurseId);
  const nurse = activeShift?.nurses.find(
    (shiftNurse) => shiftNurse.id === selectedNurseId,
  );
  const currentProfileId =
    authState.status === "signed_in" ? authState.profile.id : "";
  const shiftId = activeShift?.id;
  const openedChat = useOpenChat({
    chatKey:
      currentProfileId && shiftId && nurse ? `${shiftId}:${nurse.id}` : "",
    openChat: (supabase) =>
      openShiftNurseChat(supabase, {
        nurseId: nurse?.id ?? "",
        shiftId: shiftId ?? "",
      }),
  });
  const thread = useRequestThread({
    enabled: Boolean(currentProfileId && nurse && openedChat.chatId),
    requestId: openedChat.chatId,
    shiftId,
  });

  return (
    <WorkflowScreen
      activeStep="Board"
      avoidKeyboard
      flow={assignmentFlow}
      headerActionLabel="Floors"
      managesOwnScrolling
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/flags")}
      primaryAppearance="compactSecondary"
      primaryLabel="Back to chats"
      subtitle=""
      title={nurse ? nurse.name : "Chat"}
    >
      {nurse && openedChat.chatId ? (
        <RequestThread
          canSend={thread.canSend}
          connectionState={thread.connectionState}
          currentProfileId={currentProfileId}
          draft={thread.draft}
          isLoading={thread.isLoading}
          isSending={thread.isSending}
          loadError={thread.loadError}
          messages={thread.messages}
          onDraftChange={thread.changeDraft}
          onRetryThread={thread.retryThread}
          onSend={thread.sendMessage}
          sendError={thread.sendError}
        />
      ) : (
        <View style={styles.stateWrap}>
          {!nurse ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Chat unavailable</Text>
              <Text style={styles.stateMessage}>
                Return to Flags and choose a nurse from the active shift.
              </Text>
            </View>
          ) : null}

          {nurse && openedChat.isOpening ? (
            <LoadingState message="Opening chat" />
          ) : null}

          {nurse && openedChat.errorMessage ? (
            <ErrorState
              message={openedChat.errorMessage}
              onRetry={openedChat.retry}
              title="Chat could not open"
            />
          ) : null}
        </View>
      )}
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  stateWrap: {
    padding: spacing.xl,
  },
  stateCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.lg,
    ...shadows.sm,
  },
  stateTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  stateMessage: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
});
