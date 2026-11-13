import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  BoardSubTabBar,
  SummaryChip,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
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
import {
  buildChargeChatList,
  formatChatTime,
  type ChargeChatRow,
} from "../utils/nurseChats";
import { assignmentFlow } from "../utils/workflowFlows";

type ChatListItem =
  | { type: "chat"; row: ChargeChatRow }
  | { type: "empty"; id: string; message: string };

type ChatsListHeaderProps = {
  chatRows: ChargeChatRow[];
};

type ChatRowProps = {
  onOpen: (nurseId: string) => void;
  row: ChargeChatRow;
};

type EmptyChatRowProps = {
  message: string;
};

function openChat(nurseId: string) {
  router.push(`/charge-chat?nurseId=${encodeURIComponent(nurseId)}`);
}

function getChatListItems(chatRows: ChargeChatRow[]): ChatListItem[] {
  if (!chatRows.length) {
    return [
      {
        id: "empty-chats",
        message: "No nurses on this shift yet.",
        type: "empty",
      },
    ];
  }

  return chatRows.map((row) => ({ row, type: "chat" }));
}

function getChatItemKey(item: ChatListItem) {
  return item.type === "chat" ? `chat-${item.row.nurse.id}` : item.id;
}

function renderChatItem({ item }: { item: ChatListItem }) {
  if (item.type === "empty") {
    return <EmptyChatRow message={item.message} />;
  }

  return <ChatRow onOpen={openChat} row={item.row} />;
}

export default function ChargeChatsScreen() {
  const { authState } = useAuthSession();
  const activeShift = useServerWorkspace((state) => state.activeShift);
  const currentProfileId =
    authState.status === "signed_in" ? authState.profile.id : "";
  // With no active shift there are no nurses, so the list shows its empty row.
  const chatRows = buildChargeChatList(
    activeShift?.nurses ?? [],
    activeShift?.nurseRequests,
    currentProfileId,
  );

  return (
    <WorkflowListScreen
      activeStep="Board"
      bottomAccessory={<BoardSubTabBar activeTab="chats" />}
      data={getChatListItems(chatRows)}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      keyExtractor={getChatItemKey}
      listHeader={<ChatsListHeader chatRows={chatRows} />}
      onHeaderActionPress={() => router.push("/")}
      renderItem={renderChatItem}
      subtitle=""
      title={activeShift?.floorName ?? "Chats"}
    />
  );
}

function ChatsListHeader({ chatRows }: ChatsListHeaderProps) {
  const needsReplyCount = chatRows.filter((row) => row.needsReply).length;

  return (
    <WorkflowSection title="Chat summary">
      <View style={styles.summaryCard}>
        <View style={styles.summaryTopRow}>
          <View>
            <Text style={styles.summaryEyebrow}>Active shift</Text>
            <Text style={styles.summaryTitle}>{chatRows.length} nurses</Text>
          </View>
          <SummaryChip label={`${needsReplyCount} need a reply`} />
        </View>
      </View>
    </WorkflowSection>
  );
}

function ChatRow({ onOpen, row }: ChatRowProps) {
  const lastMessageTime = formatChatTime(row.chat?.lastMessageAt);
  const preview = row.chat?.lastMessagePreview;

  return (
    <Pressable
      accessibilityLabel={`Chat with ${row.nurse.name}${row.needsReply ? ", needs reply" : ""}`}
      accessibilityRole="button"
      onPress={() => onOpen(row.nurse.id)}
      style={({ pressed }) => [
        styles.chatRow,
        row.needsReply ? styles.chatRowNeedsReply : null,
        pressed ? styles.chatRowPressed : null,
      ]}
    >
      <View style={styles.chatTopRow}>
        <View style={styles.chatChipRow}>
          <Text style={styles.chatName}>{row.nurse.name}</Text>
          {row.needsReply ? <SummaryChip label="Needs reply" /> : null}
        </View>
        {lastMessageTime ? (
          <Text style={styles.chatTime}>{lastMessageTime}</Text>
        ) : null}
      </View>
      <Text numberOfLines={2} style={styles.chatPreview}>
        {preview || "No messages yet"}
      </Text>
    </Pressable>
  );
}

function EmptyChatRow({ message }: EmptyChatRowProps) {
  return (
    <View style={styles.emptyRow}>
      <Text style={styles.emptyTitle}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
  },
  summaryTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  summaryEyebrow: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  summaryTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs,
  },
  chatRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderLeftColor: colors.status.blue800,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  chatRowNeedsReply: {
    borderLeftColor: colors.status.amber800,
  },
  chatRowPressed: {
    opacity: 0.82,
  },
  chatTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  chatChipRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chatName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
    lineHeight: 20,
  },
  chatTime: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.medium,
    lineHeight: 16,
    textAlign: "right",
  },
  chatPreview: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  emptyRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  emptyTitle: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
});
