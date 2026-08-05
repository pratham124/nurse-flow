import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ErrorState } from "../ErrorState";
import { LoadingState } from "../LoadingState";
import { LiveStatusChip } from "../workflow";
import { requestMessageBodyMaxLength } from "../../services/requestMessageRepository";
import {
  colors,
  fontWeight,
  radius,
  shadows,
  spacing,
  textSize,
} from "../../theme/tokens";
import type {
  NurseRequestMessage,
  RealtimeConnectionState,
} from "../../types/models";

export type RequestThreadProps = {
  canSend: boolean;
  connectionState: RealtimeConnectionState;
  currentProfileId: string;
  draft: string;
  isLoading: boolean;
  isSending: boolean;
  loadError: string;
  messages: NurseRequestMessage[];
  onDraftChange: (draft: string) => void;
  onRetryThread: () => void;
  onSend: () => void;
  sendError: string;
};

type RequestMessageRowProps = {
  currentProfileId: string;
  message: NurseRequestMessage;
};

type RequestMessageComposerProps = {
  canSend: boolean;
  connectionState: RealtimeConnectionState;
  draft: string;
  isSending: boolean;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
  sendError: string;
};

function getMessageTime(createdAt: string) {
  const createdDate = new Date(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return "Server time unavailable";
  }

  return createdDate.toLocaleString([], {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

function RequestMessageRow({
  currentProfileId,
  message,
}: RequestMessageRowProps) {
  const isOwnMessage = message.authorProfileId === currentProfileId;
  const messageTime = getMessageTime(message.createdAt);

  return (
    <View
      accessibilityLabel={`${isOwnMessage ? "Your message" : "Message"}, ${message.body}, ${messageTime}`}
      accessible
      style={[
        styles.messageRow,
        isOwnMessage ? styles.ownMessageRow : styles.otherMessageRow,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
        ]}
      >
        <Text
          style={[
            styles.messageBody,
            isOwnMessage ? styles.ownMessageBody : null,
          ]}
        >
          {message.body}
        </Text>
        <Text
          style={[
            styles.messageTime,
            isOwnMessage ? styles.ownMessageTime : null,
          ]}
        >
          {messageTime}
        </Text>
      </View>
    </View>
  );
}

function RequestMessageComposer({
  canSend,
  connectionState,
  draft,
  isSending,
  onDraftChange,
  onSend,
  sendError,
}: RequestMessageComposerProps) {
  const isConnected = connectionState === "live";
  const sendLabel = isSending
    ? "Sending..."
    : sendError
      ? "Retry"
      : "Send";

  return (
    <View style={styles.composerCard}>
      <Text style={styles.composerLabel}>Reply</Text>
      <TextInput
        accessibilityLabel="Request message"
        editable={isConnected && !isSending}
        maxLength={requestMessageBodyMaxLength}
        multiline
        onChangeText={onDraftChange}
        placeholder={
          isConnected ? "Write a message" : "Reconnect to send messages"
        }
        placeholderTextColor={colors.neutral.textTertiary}
        style={[
          styles.composerInput,
          !isConnected ? styles.disabledComposerInput : null,
        ]}
        textAlignVertical="top"
        value={draft}
      />

      {!isConnected ? (
        <Text style={styles.connectionNote}>
          Messages cannot be sent while disconnected. Drafts are not queued.
        </Text>
      ) : null}

      {sendError ? (
        <Text accessibilityRole="alert" style={styles.sendError}>
          {sendError} Your draft is still here.
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={onSend}
        style={({ pressed }) => [
          styles.sendButton,
          !canSend ? styles.disabledSendButton : null,
          pressed && canSend ? styles.pressedSendButton : null,
        ]}
      >
        <Text style={styles.sendButtonText}>{sendLabel}</Text>
      </Pressable>
    </View>
  );
}

export function RequestThread({
  canSend,
  connectionState,
  currentProfileId,
  draft,
  isLoading,
  isSending,
  loadError,
  messages,
  onDraftChange,
  onRetryThread,
  onSend,
  sendError,
}: RequestThreadProps) {
  return (
    <View style={styles.threadCard}>
      <View style={styles.threadHeader}>
        <Text accessibilityRole="header" style={styles.threadTitle}>
          Conversation
        </Text>
        <LiveStatusChip
          connectionState={connectionState}
          onRefresh={onRetryThread}
        />
      </View>

      {isLoading ? <LoadingState message="Loading conversation" /> : null}

      {loadError && !isLoading ? (
        <ErrorState
          message={loadError}
          onRetry={onRetryThread}
          title="Conversation could not load"
        />
      ) : null}

      {!isLoading && !loadError ? (
        <View style={styles.messageList}>
          {messages.length ? (
            messages.map((message) => (
              <RequestMessageRow
                currentProfileId={currentProfileId}
                key={message.id}
                message={message}
              />
            ))
          ) : (
            <View style={styles.emptyThread}>
              <Text style={styles.emptyThreadTitle}>No replies yet</Text>
              <Text style={styles.emptyThreadMessage}>
                Start the conversation about this request.
              </Text>
            </View>
          )}
        </View>
      ) : null}

      <RequestMessageComposer
        canSend={canSend}
        connectionState={connectionState}
        draft={draft}
        isSending={isSending}
        onDraftChange={onDraftChange}
        onSend={onSend}
        sendError={sendError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  threadCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  threadHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  threadTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  messageList: {
    gap: spacing.sm,
  },
  messageRow: {
    flexDirection: "row",
  },
  ownMessageRow: {
    justifyContent: "flex-end",
  },
  otherMessageRow: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    borderRadius: radius.md,
    gap: spacing.xs,
    maxWidth: "88%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ownMessageBubble: {
    backgroundColor: colors.brand.burgundy,
  },
  otherMessageBubble: {
    backgroundColor: colors.neutral.backgroundSecondary,
  },
  messageBody: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    lineHeight: 20,
  },
  ownMessageBody: {
    color: colors.neutral.surface,
  },
  messageTime: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
  },
  ownMessageTime: {
    color: "rgba(255, 255, 255, 0.78)",
  },
  emptyThread: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  emptyThreadTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  emptyThreadMessage: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  composerCard: {
    borderTopColor: colors.neutral.borderTertiary,
    borderTopWidth: 0.5,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  composerLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  composerInput: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    lineHeight: 20,
    minHeight: 88,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  disabledComposerInput: {
    backgroundColor: colors.neutral.backgroundSecondary,
    color: colors.neutral.textSecondary,
  },
  connectionNote: {
    color: colors.status.amber800,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  sendError: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  sendButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: spacing.lg,
  },
  disabledSendButton: {
    opacity: 0.48,
  },
  pressedSendButton: {
    opacity: 0.82,
  },
  sendButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
});
