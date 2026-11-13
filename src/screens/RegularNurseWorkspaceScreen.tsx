import { useShallow } from "zustand/react/shallow";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { LiveStatusChip, ResponsiveContent } from "../components/workflow";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
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
import type { JoinedNurseAssignmentView } from "../types/models";
import { findNurseChat, formatChatTime, needsReply } from "../utils/nurseChats";

type AssignmentSummaryProps = {
  assignmentView: JoinedNurseAssignmentView;
};

type ChatWithChargeCardProps = {
  assignmentView: JoinedNurseAssignmentView;
  currentProfileId: string;
  onOpenChat: () => void;
};

type AssignedRoomGroup = {
  beds: {
    doctorSideName: string;
    id: string;
    label: string;
  }[];
  id: string;
  roomLabel: string;
};

function getShortBedLabel(
  assignedBed: JoinedNurseAssignmentView["assignedBeds"][number],
) {
  return assignedBed.bed.label.startsWith(`${assignedBed.room.label}-`)
    ? assignedBed.bed.label.slice(assignedBed.room.label.length + 1)
    : assignedBed.bed.label;
}

function getAssignedRoomGroups(
  assignmentView: JoinedNurseAssignmentView,
): AssignedRoomGroup[] {
  const groups = new Map<string, AssignedRoomGroup>();

  assignmentView.assignedBeds.forEach((assignedBed) => {
    const existingGroup = groups.get(assignedBed.room.id);
    const group = existingGroup ?? {
      beds: [],
      id: assignedBed.room.id,
      roomLabel: assignedBed.room.label,
    };

    group.beds.push({
      doctorSideName: assignedBed.doctorSide.name,
      id: assignedBed.bed.id,
      label: getShortBedLabel(assignedBed),
    });
    groups.set(assignedBed.room.id, group);
  });

  return Array.from(groups.values());
}

function AssignmentSummary({ assignmentView }: AssignmentSummaryProps) {
  const roomGroups = getAssignedRoomGroups(assignmentView);

  return (
    <View style={styles.assignmentPanel}>
      <Text style={styles.sectionLabel}>Current assignment</Text>
      <Text style={styles.floorName}>{assignmentView.floorName}</Text>

      <View style={styles.statRow}>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>
            {assignmentView.assignedBeds.length}
          </Text>
          <Text style={styles.statLabel}>Beds</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{roomGroups.length}</Text>
          <Text style={styles.statLabel}>Rooms</Text>
        </View>
      </View>

      <View style={styles.bedList}>
        <Text style={styles.sectionLabel}>Assigned rooms</Text>
        {/* Every room is listed inline and the whole screen scrolls. A
            fixed-height inner list hid rooms on phones. */}
        {roomGroups.length ? (
          <View style={styles.roomListContent}>
            {roomGroups.map((roomGroup) => (
              <View key={roomGroup.id} style={styles.bedRow}>
                <Text style={styles.bedTitle}>Room {roomGroup.roomLabel}</Text>
                {roomGroup.beds.map((bed) => (
                  <Text key={bed.id} style={styles.bedDetail}>
                    Bed {bed.label} - {bed.doctorSideName}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyDetail}>No beds assigned yet.</Text>
        )}
      </View>
    </View>
  );
}

function ChatWithChargeCard({
  assignmentView,
  currentProfileId,
  onOpenChat,
}: ChatWithChargeCardProps) {
  const chat = findNurseChat(
    assignmentView.requestHistory,
    assignmentView.access.nurseId,
  );
  const replyNeeded = needsReply(chat, currentProfileId);
  const lastMessageTime = formatChatTime(chat?.lastMessageAt);

  return (
    <View style={styles.chatCard}>
      <View style={styles.chatCardHeader}>
        <Text style={styles.chatCardTitle}>Chat with charge</Text>
        {replyNeeded ? (
          <Text style={styles.needsReplyBadge}>Needs your reply</Text>
        ) : null}
      </View>

      {chat?.lastMessagePreview ? (
        <View style={styles.chatPreview}>
          <Text numberOfLines={2} style={styles.bedDetail}>
            {chat.lastMessagePreview}
          </Text>
          {lastMessageTime ? (
            <Text style={styles.chatTime}>{lastMessageTime}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.emptyDetail}>
          Message charge about your assignment. Don&apos;t include patient
          details.
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={onOpenChat}
        style={({ pressed }) => [
          styles.chatButton,
          pressed ? styles.chatButtonPressed : null,
        ]}
      >
        <Text style={styles.chatButtonText}>Open chat</Text>
      </Pressable>
    </View>
  );
}

export default function RegularNurseWorkspaceScreen() {
  const { isExpanded } = useResponsiveLayout();
  const { authState } = useAuthSession();
  const {
    joinedNurseAccessState,
    joinedNurseRealtimeConnectionState,
    retryLoadJoinedNurseAccess,
  } = useServerWorkspace(
    useShallow((state) => ({
      joinedNurseAccessState: state.joinedNurseAccessState,
      joinedNurseRealtimeConnectionState:
        state.joinedNurseRealtimeConnectionState,
      retryLoadJoinedNurseAccess: state.retryLoadJoinedNurseAccess,
    })),
  );
  const displayName =
    authState.status === "signed_in" ? authState.profile.displayName : "Nurse";
  const currentProfileId =
    authState.status === "signed_in" ? authState.profile.id : "";

  function handleBackHome() {
    router.replace("/");
  }

  function handleOpenChat() {
    router.push("/joined-chat");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ResponsiveContent expanded>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>My shift</Text>
            <Text style={styles.title}>{displayName}</Text>

            {joinedNurseAccessState.status === "ready" ? (
              <LiveStatusChip
                connectionState={joinedNurseRealtimeConnectionState}
                onRefresh={retryLoadJoinedNurseAccess}
              />
            ) : null}

            {joinedNurseAccessState.status === "loading" ||
            joinedNurseAccessState.status === "idle" ? (
              <LoadingState message="Checking shift access" />
            ) : null}

            {joinedNurseAccessState.status === "empty" ? (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyTitle}>No shift access yet</Text>
                <Text style={styles.message}>
                  Enter a nurse code from charge to connect this account to an
                  active shift.
                </Text>
              </View>
            ) : null}

            {joinedNurseAccessState.status === "shift_ended" ? (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyTitle}>Shift ended</Text>
                <Text style={styles.message}>
                  This live assignment is no longer active. Return home for a
                  safe place to continue.
                </Text>
              </View>
            ) : null}

            {joinedNurseAccessState.status === "access_removed" ? (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyTitle}>Access removed</Text>
                <Text style={styles.message}>
                  This account is no longer linked to that nurse assignment. Ask
                  charge for a new code if you still need access.
                </Text>
              </View>
            ) : null}

            {joinedNurseAccessState.status === "ready" ? (
              <View
                style={[
                  styles.readyContent,
                  isExpanded ? styles.expandedReadyContent : null,
                ]}
              >
                <View
                  style={[
                    styles.readyColumn,
                    isExpanded ? styles.expandedReadyColumn : null,
                  ]}
                >
                  <AssignmentSummary
                    assignmentView={joinedNurseAccessState.assignmentView}
                  />
                </View>
                <View
                  style={[
                    styles.readyColumn,
                    isExpanded ? styles.expandedReadyColumn : null,
                  ]}
                >
                  <ChatWithChargeCard
                    assignmentView={joinedNurseAccessState.assignmentView}
                    currentProfileId={currentProfileId}
                    onOpenChat={handleOpenChat}
                  />
                </View>
              </View>
            ) : null}

            {joinedNurseAccessState.status === "error" ? (
              <ErrorState
                message={joinedNurseAccessState.errorMessage}
                onRetry={retryLoadJoinedNurseAccess}
                title="Shift access could not load"
              />
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={handleBackHome}
              style={({ pressed }) => [
                styles.homeButton,
                pressed && styles.homeButtonPressed,
              ]}
            >
              <Text style={styles.homeButtonText}>Back to home</Text>
            </Pressable>
          </View>
        </ResponsiveContent>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.neutral.backgroundPrimary,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.xl,
    ...shadows.sm,
  },
  readyContent: {
    gap: spacing.cardGap,
  },
  expandedReadyContent: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  readyColumn: {
    width: "100%",
  },
  expandedReadyColumn: {
    flex: 1,
    minWidth: 0,
    width: "auto",
  },
  assignmentPanel: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.lg,
  },
  bedDetail: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  bedList: {
    gap: spacing.sm,
  },
  bedRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.md,
  },
  bedTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  emptyDetail: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  emptyPanel: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  eyebrow: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.xl,
    fontWeight: fontWeight.heavy,
  },
  message: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.md,
    fontWeight: fontWeight.medium,
    lineHeight: 20,
  },
  floorName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.heavy,
  },
  sectionLabel: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  roomListContent: {
    gap: spacing.sm,
  },
  chatCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  chatCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  chatCardTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  needsReplyBadge: {
    backgroundColor: colors.status.amber50,
    borderRadius: radius.pill,
    color: colors.status.amber800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chatPreview: {
    gap: spacing.xs,
  },
  chatTime: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.medium,
  },
  chatButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  chatButtonPressed: {
    opacity: 0.82,
  },
  chatButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  statLabel: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.semibold,
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statTile: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    flex: 1,
    gap: spacing.xs,
    minWidth: 86,
    padding: spacing.md,
  },
  statValue: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  homeButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.lg,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  homeButtonPressed: {
    opacity: 0.82,
  },
  homeButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
});
