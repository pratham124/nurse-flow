import { useShallow } from "zustand/react/shallow";
import { router } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { RequestThread } from "../components/requests/RequestThread";
import { ResponsiveContent } from "../components/workflow";
import { useOpenChat } from "../hooks/useOpenChat";
import { useRequestThread } from "../hooks/useRequestThread";
import { openJoinedNurseChat } from "../services/serverWorkspaceRepository";
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

type SafeStateProps = {
  message: string;
  title: string;
};

function SafeState({ message, title }: SafeStateProps) {
  return (
    <View style={styles.safeStateCard}>
      <Text style={styles.safeStateTitle}>{title}</Text>
      <Text style={styles.safeStateMessage}>{message}</Text>
    </View>
  );
}

export default function JoinedNurseChatScreen() {
  const { authState } = useAuthSession();
  const { joinedNurseAccessState, retryLoadJoinedNurseAccess } =
    useServerWorkspace(
      useShallow((state) => ({
        joinedNurseAccessState: state.joinedNurseAccessState,
        retryLoadJoinedNurseAccess: state.retryLoadJoinedNurseAccess,
      })),
    );
  const assignmentView =
    joinedNurseAccessState.status === "ready"
      ? joinedNurseAccessState.assignmentView
      : undefined;
  const currentProfileId =
    authState.status === "signed_in" ? authState.profile.id : "";
  const openedChat = useOpenChat({
    chatKey: currentProfileId && assignmentView ? assignmentView.shiftId : "",
    openChat: openJoinedNurseChat,
  });
  const thread = useRequestThread({
    enabled: Boolean(currentProfileId && assignmentView && openedChat.chatId),
    requestId: openedChat.chatId,
    shiftId: assignmentView?.shiftId,
  });

  function handleBackToAssignment() {
    router.replace("/regular-nurse-workspace");
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Sits directly inside the safe area so iOS measures the keyboard
          overlap correctly and the composer rises above the keyboard. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.body}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Chat with charge
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleBackToAssignment}
            style={({ pressed }) => [
              styles.backButton,
              pressed ? styles.backButtonPressed : null,
            ]}
          >
            <Text style={styles.backButtonText}>Back to assignment</Text>
          </Pressable>
        </View>

        {assignmentView && openedChat.chatId ? (
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
          <ScrollView contentContainerStyle={styles.content}>
            <ResponsiveContent expanded>
              <View style={styles.contentColumn}>
                {joinedNurseAccessState.status === "idle" ||
                joinedNurseAccessState.status === "loading" ? (
                  <LoadingState message="Loading chat" />
                ) : null}

                {joinedNurseAccessState.status === "shift_ended" ? (
                  <SafeState
                    message="This chat is no longer available because the shift ended."
                    title="Shift ended"
                  />
                ) : null}

                {joinedNurseAccessState.status === "access_removed" ? (
                  <SafeState
                    message="This account is no longer linked to a nurse on this shift."
                    title="Access removed"
                  />
                ) : null}

                {joinedNurseAccessState.status === "empty" ? (
                  <SafeState
                    message="Join an active shift before chatting with charge."
                    title="No shift access"
                  />
                ) : null}

                {joinedNurseAccessState.status === "error" ? (
                  <ErrorState
                    message={joinedNurseAccessState.errorMessage}
                    onRetry={retryLoadJoinedNurseAccess}
                    title="Chat access could not load"
                  />
                ) : null}

                {assignmentView && openedChat.isOpening ? (
                  <LoadingState message="Opening chat" />
                ) : null}

                {assignmentView && openedChat.errorMessage ? (
                  <ErrorState
                    message={openedChat.errorMessage}
                    onRetry={openedChat.retry}
                    title="Chat could not open"
                  />
                ) : null}
              </View>
            </ResponsiveContent>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.neutral.backgroundPrimary,
    flex: 1,
  },
  body: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderBottomColor: colors.neutral.borderTertiary,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    ...shadows.sm,
  },
  title: {
    color: colors.neutral.textPrimary,
    flex: 1,
    fontSize: textSize.xl,
    fontWeight: fontWeight.bold,
  },
  backButton: {
    alignItems: "center",
    borderColor: colors.neutral.borderSecondary,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  backButtonPressed: {
    opacity: 0.75,
  },
  backButtonText: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  contentColumn: {
    gap: spacing.cardGap,
  },
  safeStateCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.sm,
    padding: spacing.lg,
    ...shadows.sm,
  },
  safeStateTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  safeStateMessage: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.md,
    lineHeight: 20,
  },
});
