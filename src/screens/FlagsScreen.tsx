import { useShallow } from "zustand/react/shallow";
import { useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  BoardSubTabBar,
  SegmentedControl,
  SeverityBadge,
  SummaryChip,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import {
  colors,
  radius,
  spacing,
  textSize,
  fontWeight,
  shadows,
} from "../theme/tokens";
import { useAuthSession } from "../store/AuthSessionContext";
import type { Flag, FlagSeverity, Shift } from "../types/models";
import {
  buildChargeChatList,
  formatChatTime,
  type ChargeChatRow,
} from "../utils/nurseChats";
import { assignmentFlow } from "../utils/workflowFlows";

const flagFilters = ["All", "Critical", "Warning", "Info"] as const;

type FlagFilter = (typeof flagFilters)[number];
type ReviewTab = "Flags" | "Chats";

type FlagRowViewModel = {
  id: string;
  message: string;
  severity: FlagSeverity;
  severityLabel: string;
  target: string;
};

type FlagsListHeaderProps = {
  activeReviewTab: ReviewTab;
  chatRows: ChargeChatRow[];
  criticalCount: number;
  infoCount: number;
  onFilterPress: (filter: FlagFilter) => void;
  selectedFilter: FlagFilter;
  setActiveReviewTab: (tab: ReviewTab) => void;
  warningCount: number;
};

type FlagSummaryCountProps = {
  label: string;
  value: number;
};

type FilterGroupProps<FilterValue extends string> = {
  filters: readonly FilterValue[];
  label: string;
  onFilterPress: (filter: FilterValue) => void;
  selectedFilter: FilterValue;
};

type FlagRowProps = {
  flag: FlagRowViewModel;
};

type EmptyFlagRowProps = {
  message: string;
};

type SectionHeaderRowProps = {
  subtitle?: string;
  title: string;
};

type ChatRowProps = {
  onOpen: (nurseId: string) => void;
  row: ChargeChatRow;
};

type FlagListItem =
  | { type: "section"; id: string; subtitle?: string; title: string }
  | { type: "flag"; flag: FlagRowViewModel }
  | { type: "chat"; row: ChargeChatRow }
  | { type: "empty"; id: string; message: string };

function FlagsListHeader({
  activeReviewTab,
  chatRows,
  criticalCount,
  infoCount,
  onFilterPress,
  selectedFilter,
  setActiveReviewTab,
  warningCount,
}: FlagsListHeaderProps) {
  const needsReplyCount = chatRows.filter((row) => row.needsReply).length;
  const totalFlags = criticalCount + warningCount + infoCount;

  return (
    <View style={styles.headerContent}>
      {activeReviewTab === "Flags" ? (
        <WorkflowSection title="Flag summary">
          <View style={styles.flagSummaryCard}>
            <View style={styles.flagSummaryTopRow}>
              <View>
                <Text style={styles.flagSummaryEyebrow}>Active review</Text>
                <Text style={styles.flagSummaryTitle}>
                  {totalFlags} assignment flags
                </Text>
              </View>
              <SummaryChip label={`${totalFlags} flags`} />
            </View>
            <View style={styles.flagSummaryCounts}>
              <FlagSummaryCount label="Critical" value={criticalCount} />
              <FlagSummaryCount label="Warning" value={warningCount} />
              <FlagSummaryCount label="Info" value={infoCount} />
            </View>
          </View>
        </WorkflowSection>
      ) : (
        <WorkflowSection title="Chat summary">
          <View style={styles.flagSummaryCard}>
            <View style={styles.flagSummaryTopRow}>
              <View>
                <Text style={styles.flagSummaryEyebrow}>Active shift</Text>
                <Text style={styles.flagSummaryTitle}>
                  {chatRows.length} nurses
                </Text>
              </View>
              <SummaryChip label={`${needsReplyCount} need a reply`} />
            </View>
          </View>
        </WorkflowSection>
      )}

      <SegmentedControl
        options={["Flags", "Chats"] as const}
        selectedOption={activeReviewTab}
        onSelect={setActiveReviewTab}
      />

      {activeReviewTab === "Flags" ? (
        <WorkflowSection title="Flag filters">
          <FilterGroup
            filters={flagFilters}
            label="Severity"
            onFilterPress={onFilterPress}
            selectedFilter={selectedFilter}
          />
        </WorkflowSection>
      ) : null}
    </View>
  );
}

function FlagSummaryCount({ label, value }: FlagSummaryCountProps) {
  return (
    <View style={styles.flagSummaryCount}>
      <Text style={styles.flagSummaryCountValue}>{value}</Text>
      <Text style={styles.flagSummaryCountLabel}>{label}</Text>
    </View>
  );
}

function FilterGroup<FilterValue extends string>({
  filters,
  label,
  onFilterPress,
  selectedFilter,
}: FilterGroupProps<FilterValue>) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupLabel}>{label}</Text>
      <SegmentedControl
        options={filters}
        selectedOption={selectedFilter}
        onSelect={onFilterPress}
      />
    </View>
  );
}

function getSeverityLabel(severity: FlagSeverity) {
  if (severity === "critical") {
    return "Critical";
  }

  if (severity === "warning") {
    return "Warning";
  }

  return "Info";
}

function getFlagTarget(activeShift: Shift, flag: Flag) {
  if (flag.bedId) {
    const bed = activeShift.beds.find((shiftBed) => shiftBed.id === flag.bedId);
    const room = activeShift.rooms.find(
      (shiftRoom) => shiftRoom.id === (flag.roomId ?? bed?.roomId),
    );

    return room && bed
      ? `Bed ${bed.label} / Room ${room.label}`
      : bed
        ? `Bed ${bed.label}`
        : "Bed";
  }

  if (flag.roomId) {
    const room = activeShift.rooms.find(
      (shiftRoom) => shiftRoom.id === flag.roomId,
    );

    return room ? `Room ${room.label}` : "Room";
  }

  if (flag.nurseId) {
    const nurse = activeShift.nurses.find(
      (shiftNurse) => shiftNurse.id === flag.nurseId,
    );

    return nurse?.name ?? "Nurse";
  }

  if (flag.teamId) {
    const team = activeShift.assignmentResult?.generatedTeams.find(
      (generatedTeam) => generatedTeam.id === flag.teamId,
    );

    return team?.label ?? "Team";
  }

  return "Floor";
}

function getFlagRows(
  activeShift: Shift | undefined,
  effectiveAssignmentFlags: Flag[],
): FlagRowViewModel[] {
  if (!activeShift) {
    return [];
  }

  return effectiveAssignmentFlags.map((flag) => ({
    id: flag.id,
    message: flag.message,
    severity: flag.severity,
    severityLabel: getSeverityLabel(flag.severity),
    target: getFlagTarget(activeShift, flag),
  }));
}

function filterFlagRows(flags: FlagRowViewModel[], selectedFilter: FlagFilter) {
  if (selectedFilter === "All") {
    return flags;
  }

  return flags.filter((flag) => flag.severityLabel === selectedFilter);
}

function getFlagListItems(
  flags: FlagRowViewModel[],
  chatRows: ChargeChatRow[],
  selectedFilter: FlagFilter,
  activeReviewTab: ReviewTab,
): FlagListItem[] {
  if (activeReviewTab === "Flags") {
    if (!flags.length) {
      return [
        {
          id: "empty-assignment-flags",
          message:
            selectedFilter === "All"
              ? "No assignment flags."
              : `No ${selectedFilter.toLowerCase()} flags.`,
          type: "empty",
        },
      ];
    }

    return flags.map((flag) => ({ flag, type: "flag" }));
  }

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

function getFlagItemKey(item: FlagListItem) {
  if (item.type === "flag") {
    return `flag-${item.flag.id}`;
  }

  if (item.type === "chat") {
    return `chat-${item.row.nurse.id}`;
  }

  return item.id;
}

function openChat(nurseId: string) {
  router.push(`/charge-chat?nurseId=${encodeURIComponent(nurseId)}`);
}

function renderFlagItem({ item }: { item: FlagListItem }) {
  if (item.type === "section") {
    return <SectionHeaderRow subtitle={item.subtitle} title={item.title} />;
  }

  if (item.type === "empty") {
    return <EmptyFlagRow message={item.message} />;
  }

  if (item.type === "chat") {
    return <ChatRow onOpen={openChat} row={item.row} />;
  }

  return <FlagRow flag={item.flag} />;
}

export default function FlagsScreen() {
  const { authState } = useAuthSession();
  const { activeShift, effectiveAssignmentFlags } = useServerWorkspace(
    useShallow((state) => ({
      activeShift: state.activeShift,
      effectiveAssignmentFlags: state.effectiveAssignmentFlags,
    })),
  );
  const [activeReviewTab, setActiveReviewTab] = useState<ReviewTab>("Flags");
  const [selectedFilter, setSelectedFilter] = useState<FlagFilter>("All");
  const flags = getFlagRows(activeShift, effectiveAssignmentFlags);
  const currentProfileId =
    authState.status === "signed_in" ? authState.profile.id : "";
  const chatRows = buildChargeChatList(
    activeShift?.nurses ?? [],
    activeShift?.nurseRequests,
    currentProfileId,
  );
  const filteredFlags = filterFlagRows(flags, selectedFilter);
  const criticalCount = flags.filter(
    (flag) => flag.severity === "critical",
  ).length;
  const warningCount = flags.filter(
    (flag) => flag.severity === "warning",
  ).length;
  const infoCount = flags.filter((flag) => flag.severity === "info").length;

  return (
    <WorkflowListScreen
      activeStep="Board"
      data={getFlagListItems(
        filteredFlags,
        chatRows,
        selectedFilter,
        activeReviewTab,
      )}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      keyExtractor={getFlagItemKey}
      listHeader={
        <FlagsListHeader
          activeReviewTab={activeReviewTab}
          chatRows={chatRows}
          criticalCount={criticalCount}
          infoCount={infoCount}
          onFilterPress={setSelectedFilter}
          selectedFilter={selectedFilter}
          setActiveReviewTab={setActiveReviewTab}
          warningCount={warningCount}
        />
      }
      onHeaderActionPress={() => router.push("/")}
      bottomAccessory={<BoardSubTabBar activeTab="flags" />}
      renderItem={renderFlagItem}
      subtitle=""
      title={activeShift?.floorName ?? "Flags and chats"}
    />
  );
}

function FlagRow({ flag }: FlagRowProps) {
  const emojiLabel =
    flag.severity === "critical"
      ? `🚨 ${flag.severityLabel}`
      : flag.severity === "warning"
        ? `⚠️ ${flag.severityLabel}`
        : `ℹ️ ${flag.severityLabel}`;

  const displaySeverityLabel = flag.severityLabel || emojiLabel;

  return (
    <View
      style={[
        styles.flagRow,
        severityAccentStyles[flag.severity],
        severityBackgroundStyles[flag.severity],
      ]}
    >
      <View style={styles.flagTopRow}>
        <SeverityBadge label={displaySeverityLabel} tone={flag.severity} />
        <Text style={styles.target}>{flag.target}</Text>
      </View>
      <Text style={styles.message}>{flag.message}</Text>
    </View>
  );
}

function SectionHeaderRow({ subtitle, title }: SectionHeaderRowProps) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      {subtitle ? (
        <Text style={styles.sectionHeaderSubtitle}>{subtitle}</Text>
      ) : null}
    </View>
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
        styles.requestRow,
        row.needsReply ? styles.chatRowNeedsReply : null,
        pressed ? styles.requestRowPressed : null,
      ]}
    >
      <View style={styles.requestTopRow}>
        <View style={styles.requestChipRow}>
          <Text style={styles.requestRequester}>{row.nurse.name}</Text>
          {row.needsReply ? <SummaryChip label="Needs reply" /> : null}
        </View>
        {lastMessageTime ? (
          <Text style={styles.requestTime}>{lastMessageTime}</Text>
        ) : null}
      </View>
      <Text numberOfLines={2} style={styles.message}>
        {preview || "No messages yet"}
      </Text>
    </Pressable>
  );
}

function EmptyFlagRow({ message }: EmptyFlagRowProps) {
  return (
    <View style={styles.emptyFlagRow}>
      <Text style={styles.emptyFlagTitle}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  flagSummaryCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
  },
  flagSummaryTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  flagSummaryEyebrow: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  flagSummaryTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs,
  },
  flagSummaryCounts: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  flagSummaryCount: {
    backgroundColor: colors.neutral.backgroundTertiary,
    borderRadius: radius.sm,
    flex: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  flagSummaryCountValue: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  flagSummaryCountLabel: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.semibold,
  },
  filterGroup: {
    gap: spacing.sm,
  },
  filterGroupLabel: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  sectionHeaderRow: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
  },
  sectionHeaderTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  sectionHeaderSubtitle: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  flagRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  flagTopRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  target: {
    color: colors.neutral.textPrimary,
    flexShrink: 1,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  message: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
    fontWeight: fontWeight.medium,
  },
  requestRow: {
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
  requestRowPressed: {
    opacity: 0.82,
  },
  requestTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  requestChipRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  requestTime: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.medium,
    lineHeight: 16,
    textAlign: "right",
  },
  requestRequester: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
    lineHeight: 20,
  },
  chatRowNeedsReply: {
    borderLeftColor: colors.status.amber800,
  },
  emptyFlagRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  emptyFlagTitle: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
    fontWeight: fontWeight.medium,
  },
});

const severityAccentStyles = StyleSheet.create({
  critical: {
    borderLeftColor: colors.status.red800,
  },
  info: {
    borderLeftColor: colors.status.blue800,
  },
  warning: {
    borderLeftColor: colors.status.amber800,
  },
});

const severityBackgroundStyles = StyleSheet.create({
  critical: {
    backgroundColor: colors.status.red50,
  },
  warning: {
    backgroundColor: colors.status.amber50,
  },
  info: {
    backgroundColor: colors.status.blue50,
  },
});
