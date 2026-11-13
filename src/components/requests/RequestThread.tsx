import { memo, useRef, type ReactNode } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from "react-native";

import { ErrorState } from "../ErrorState";
import { LoadingState } from "../LoadingState";
import { LiveStatusChip, ResponsiveContent } from "../workflow";
import { expandedContentMaxWidth } from "../../hooks/useResponsiveLayout";
import { requestMessageBodyMaxLength } from "../../services/requestMessageRepository";
import {
  colors,
  fontWeight,
  radius,
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
  // Shown above the messages and scrolls away with them, so long request
  // details never push the composer off screen.
  listHeader?: ReactNode;
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

const messageTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
});

function getMessageTime(createdAt: string) {
  const createdDate = new Date(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return "Server time unavailable";
  }

  return messageTimeFormatter.format(createdDate);
}

const RequestMessageRow = memo(function RequestMessageRow({
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
});

function EmptyThread() {
  return (
    <View style={styles.emptyThread}>
      <Text style={styles.emptyThreadTitle}>No messages yet</Text>
      <Text style={styles.emptyThreadMessage}>Send the first message.</Text>
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
  const sendLabel = isSending ? "Sending..." : sendError ? "Retry" : "Send";

  return (
    <View style={styles.composerCard}>
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

      <View style={styles.composerRow}>
        <TextInput
          accessibilityHint="Don't include patient details"
          accessibilityLabel="Chat message"
          editable={isConnected && !isSending}
          maxLength={requestMessageBodyMaxLength}
          multiline
          onChangeText={onDraftChange}
          placeholder={
            isConnected
              ? "Message (no patient details)"
              : "Reconnect to send messages"
          }
          placeholderTextColor={colors.neutral.textTertiary}
          style={[
            styles.composerInput,
            !isConnected ? styles.disabledComposerInput : null,
          ]}
          textAlignVertical="top"
          value={draft}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: isSending, disabled: !canSend }}
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
    </View>
  );
}

// A chat-style thread: the messages scroll inside their own list and the
// composer stays pinned underneath it. The parent screen gives this component
// the remaining height (flex: 1) and handles the keyboard.
export function RequestThread({
  canSend,
  connectionState,
  currentProfileId,
  draft,
  isLoading,
  isSending,
  listHeader,
  loadError,
  messages,
  onDraftChange,
  onRetryThread,
  onSend,
  sendError,
}: RequestThreadProps) {
  const listRef = useRef<FlatList<NurseRequestMessage>>(null);
  const showMessages = !isLoading && !loadError;
  // The list is inverted (newest first, drawn from the bottom up), the usual
  // chat pattern: the newest message sits just above the composer, new
  // messages appear there, and it stays in view when the keyboard opens.
  const newestFirstMessages = showMessages ? [...messages].reverse() : [];

  function handleSend() {
    // Offset 0 is the bottom of an inverted list: show the message being sent.
    listRef.current?.scrollToOffset({ animated: true, offset: 0 });
    onSend();
  }

  const renderMessage: ListRenderItem<NurseRequestMessage> = ({ item }) => (
    <RequestMessageRow currentProfileId={currentProfileId} message={item} />
  );

  return (
    <View style={styles.thread}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={newestFirstMessages}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(message) => message.id}
        // In an inverted list the header is drawn at the bottom, just above
        // the composer. The empty state goes here rather than in
        // ListEmptyComponent: React Native un-flips that slot by passing it a
        // style prop, which a custom component ignores, so on iOS it showed
        // upside down.
        ListHeaderComponent={
          showMessages && messages.length === 0 ? <EmptyThread /> : null
        }
        inverted
        // In an inverted list the footer is drawn at the top, above the
        // oldest message, and scrolls away with the conversation.
        ListFooterComponent={
          <ResponsiveContent expanded>
            <View style={styles.listHeader}>
              {listHeader}
              <View style={styles.threadHeader}>
                <Text accessibilityRole="header" style={styles.threadTitle}>
                  Conversation
                </Text>
                <LiveStatusChip
                  connectionState={connectionState}
                  onRefresh={onRetryThread}
                />
              </View>

              {isLoading ? (
                <LoadingState message="Loading conversation" />
              ) : null}

              {loadError && !isLoading ? (
                <ErrorState
                  message={loadError}
                  onRetry={onRetryThread}
                  title="Conversation could not load"
                />
              ) : null}
            </View>
          </ResponsiveContent>
        }
        ref={listRef}
        renderItem={renderMessage}
        style={styles.list}
      />

      <View style={styles.composerBar}>
        <ResponsiveContent expanded>
          <RequestMessageComposer
            canSend={canSend}
            connectionState={connectionState}
            draft={draft}
            isSending={isSending}
            onDraftChange={onDraftChange}
            onSend={handleSend}
            sendError={sendError}
          />
        </ResponsiveContent>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  thread: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: spacing.sm,
    padding: spacing.xl,
  },
  listHeader: {
    gap: spacing.cardGap,
    paddingBottom: spacing.sm,
    width: "100%",
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
  messageRow: {
    alignSelf: "center",
    flexDirection: "row",
    maxWidth: expandedContentMaxWidth,
    width: "100%",
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
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.neutral.backgroundTertiary,
    borderRadius: radius.lg,
    gap: spacing.sm,
    justifyContent: "center",
    maxWidth: expandedContentMaxWidth,
    minHeight: 144,
    padding: spacing.xl,
    width: "100%",
  },
  emptyThreadTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  emptyThreadMessage: {
    textAlign: "center",
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  composerBar: {
    backgroundColor: colors.neutral.surface,
    borderTopColor: colors.neutral.borderTertiary,
    borderTopWidth: 0.5,
  },
  composerCard: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  composerRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.sm,
  },
  composerInput: {
    backgroundColor: colors.neutral.backgroundTertiary,
    borderColor: colors.neutral.borderSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.neutral.textPrimary,
    flex: 1,
    fontSize: textSize.md,
    lineHeight: 20,
    // Grows with the draft up to about five lines, then scrolls inside.
    maxHeight: 124,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: spacing.md,
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
