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
import { colors, radius, spacing, textSize, fontWeight, shadows } from "../theme/tokens";
import type { Flag, FlagSeverity, Shift } from "../types/models";
import {
  getNurseRequestDisplays,
  type NurseRequestDisplay,
} from "../utils/nurseRequestDisplay";
import { assignmentFlow } from "../utils/workflowFlows";

const flagFilters = ["All", "Critical", "Warning", "Info"] as const;
const requestFilters = ["All", "Issues", "Swaps"] as const;
const requestStatusFilters = ["All", "Pending", "Accepted", "Declined"] as const;

type FlagFilter = (typeof flagFilters)[number];
type RequestFilter = (typeof requestFilters)[number];
type RequestStatusFilter = (typeof requestStatusFilters)[number];

type FlagRowViewModel = {
  id: string;
  message: string;
  severity: FlagSeverity;
  severityLabel: string;
  target: string;
};

type FlagsListHeaderProps = {
  criticalCount: number;
  infoCount: number;
  requests: NurseRequestDisplay[];
  activeReviewTab: "Flags" | "Requests";
  setActiveReviewTab: (tab: "Flags" | "Requests") => void;
  onFilterPress: (filter: FlagFilter) => void;
  onRequestFilterPress: (filter: RequestFilter) => void;
  onRequestStatusFilterPress: (filter: RequestStatusFilter) => void;
  selectedFilter: FlagFilter;
  selectedRequestFilter: RequestFilter;
  selectedRequestStatusFilter: RequestStatusFilter;
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

type NurseRequestRowProps = {
  onOpen: (requestId: string) => void;
  request: NurseRequestDisplay;
};

type FlagListItem =
  | { type: "section"; id: string; subtitle?: string; title: string }
  | { type: "flag"; flag: FlagRowViewModel }
  | { type: "request"; request: NurseRequestDisplay }
  | { type: "empty"; id: string; message: string };

function FlagsListHeader({
  criticalCount,
  infoCount,
  requests,
  activeReviewTab,
  setActiveReviewTab,
  onFilterPress,
  onRequestFilterPress,
  onRequestStatusFilterPress,
  selectedFilter,
  selectedRequestFilter,
  selectedRequestStatusFilter,
  warningCount,
}: FlagsListHeaderProps) {
  const pendingCount = requests.filter((r) => r.requestStatus === "pending").length;
  const acceptedCount = requests.filter((r) => r.requestStatus === "accepted").length;
  const declinedCount = requests.filter((r) => r.requestStatus === "declined").length;
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
        <WorkflowSection title="Request summary">
          <View style={styles.flagSummaryCard}>
            <View style={styles.flagSummaryTopRow}>
              <View>
                <Text style={styles.flagSummaryEyebrow}>Active review</Text>
                <Text style={styles.flagSummaryTitle}>
                  {requests.length} nurse requests
                </Text>
              </View>
              <SummaryChip label={`${requests.length} requests`} />
            </View>
            <View style={styles.flagSummaryCounts}>
              <FlagSummaryCount label="Pending" value={pendingCount} />
              <FlagSummaryCount label="Accepted" value={acceptedCount} />
              <FlagSummaryCount label="Declined" value={declinedCount} />
            </View>
          </View>
        </WorkflowSection>
      )}

      <SegmentedControl
        options={["Flags", "Requests"] as const}
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
      ) : (
        <WorkflowSection title="Request filters">
          <View style={styles.filterPanel}>
            <FilterGroup
              filters={requestFilters}
              label="Type"
              onFilterPress={onRequestFilterPress}
              selectedFilter={selectedRequestFilter}
            />
            <FilterGroup
              filters={requestStatusFilters}
              label="Status"
              onFilterPress={onRequestStatusFilterPress}
              selectedFilter={selectedRequestStatusFilter}
            />
          </View>
        </WorkflowSection>
      )}
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

function getFlagRows(activeShift?: Shift): FlagRowViewModel[] {
  if (!activeShift) {
    return [];
  }

  return activeShift.flags.map((flag) => ({
    id: flag.id,
    message: flag.message,
    severity: flag.severity,
    severityLabel: getSeverityLabel(flag.severity),
    target: getFlagTarget(activeShift, flag),
  }));
}

function filterFlagRows(
  flags: FlagRowViewModel[],
  selectedFilter: FlagFilter,
) {
  if (selectedFilter === "All") {
    return flags;
  }

  return flags.filter((flag) => flag.severityLabel === selectedFilter);
}

function filterNurseRequestRows(
  requests: NurseRequestDisplay[],
  selectedRequestFilter: RequestFilter,
  selectedRequestStatusFilter: RequestStatusFilter,
) {
  return requests.filter((request) => {
    const matchesType =
      selectedRequestFilter === "All" ||
      request.requestType ===
        (selectedRequestFilter === "Issues" ? "issue" : "swap");
    const matchesStatus =
      selectedRequestStatusFilter === "All" ||
      request.requestStatus === selectedRequestStatusFilter.toLowerCase();

    return matchesType && matchesStatus;
  });
}

function getEmptyRequestMessage(
  selectedRequestFilter: RequestFilter,
  selectedRequestStatusFilter: RequestStatusFilter,
) {
  const statusText =
    selectedRequestStatusFilter === "All"
      ? ""
      : `${selectedRequestStatusFilter.toLowerCase()} `;

  if (selectedRequestFilter === "Issues") {
    return `No ${statusText}issue requests yet.`;
  }

  if (selectedRequestFilter === "Swaps") {
    return `No ${statusText}swap requests yet.`;
  }

  return `No ${statusText}requests yet.`;
}

function getFlagListItems(
  flags: FlagRowViewModel[],
  requests: NurseRequestDisplay[],
  selectedFilter: FlagFilter,
  selectedRequestFilter: RequestFilter,
  selectedRequestStatusFilter: RequestStatusFilter,
  activeReviewTab: "Flags" | "Requests",
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
  } else {
    if (!requests.length) {
      return [
        {
          id: "empty-local-requests",
          message: getEmptyRequestMessage(
            selectedRequestFilter,
            selectedRequestStatusFilter,
          ),
          type: "empty",
        },
      ];
    }

    return requests.map((request) => ({ request, type: "request" }));
  }
}

function getFlagItemKey(item: FlagListItem) {
  if (item.type === "flag") {
    return `flag-${item.flag.id}`;
  }

  if (item.type === "request") {
    return `request-${item.request.id}`;
  }

  return item.id;
}

function openRequestDetail(requestId: string) {
  router.push(`/local-request-detail?requestId=${encodeURIComponent(requestId)}`);
}

function renderFlagItem({ item }: { item: FlagListItem }) {
  if (item.type === "section") {
    return <SectionHeaderRow subtitle={item.subtitle} title={item.title} />;
  }

  if (item.type === "empty") {
    return <EmptyFlagRow message={item.message} />;
  }

  if (item.type === "request") {
    return <NurseRequestRow onOpen={openRequestDetail} request={item.request} />;
  }

  return <FlagRow flag={item.flag} />;
}

export default function FlagsScreen() {
  const { activeShift } = useServerWorkspace();
  const [activeReviewTab, setActiveReviewTab] = useState<"Flags" | "Requests">("Flags");
  const [selectedFilter, setSelectedFilter] = useState<FlagFilter>("All");
  const [selectedRequestFilter, setSelectedRequestFilter] =
    useState<RequestFilter>("All");
  const [selectedRequestStatusFilter, setSelectedRequestStatusFilter] =
    useState<RequestStatusFilter>("All");
  const flags = getFlagRows(activeShift);
  const requests = getNurseRequestDisplays(activeShift);
  const filteredFlags = filterFlagRows(flags, selectedFilter);
  const filteredRequests = filterNurseRequestRows(
    requests,
    selectedRequestFilter,
    selectedRequestStatusFilter,
  );
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
        filteredRequests,
        selectedFilter,
        selectedRequestFilter,
        selectedRequestStatusFilter,
        activeReviewTab,
      )}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      keyExtractor={getFlagItemKey}
      listHeader={
        <FlagsListHeader
          criticalCount={criticalCount}
          infoCount={infoCount}
          requests={requests}
          activeReviewTab={activeReviewTab}
          setActiveReviewTab={setActiveReviewTab}
          onFilterPress={setSelectedFilter}
          onRequestFilterPress={setSelectedRequestFilter}
          onRequestStatusFilterPress={setSelectedRequestStatusFilter}
          selectedFilter={selectedFilter}
          selectedRequestFilter={selectedRequestFilter}
          selectedRequestStatusFilter={selectedRequestStatusFilter}
          warningCount={warningCount}
        />
      }
      onHeaderActionPress={() => router.push("/")}
      bottomAccessory={<BoardSubTabBar activeTab="flags" />}
      renderItem={renderFlagItem}
      subtitle=""
      title={activeShift?.floorName ?? "Flags and requests"}
    />
  );
}

function FlagRow({ flag }: FlagRowProps) {
  const emojiLabel = flag.severity === "critical"
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

function NurseRequestRow({ onOpen, request }: NurseRequestRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(request.id)}
      style={({ pressed }) => [
        styles.requestRow,
        pressed ? styles.requestRowPressed : null,
      ]}
    >
      <View style={styles.requestTopRow}>
        <View style={styles.requestChipRow}>
          <SummaryChip label={request.typeLabel} />
          <SummaryChip label={request.statusLabel} />
          <SummaryChip label="Live request" />
        </View>
        <Text style={styles.requestTime}>{request.createdAtText}</Text>
      </View>
      <Text style={styles.requestRequester}>{request.requesterName}</Text>
      <Text style={styles.requestTarget}>{request.bedContext}</Text>
      <Text style={styles.message}>{request.message}</Text>
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
  filterPanel: {
    gap: spacing.md,
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
  requestTarget: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
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
