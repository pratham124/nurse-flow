import { useState } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  FilterChip,
  FilterChipRow,
  SeverityBadge,
  SummaryTile,
  SummaryTileGrid,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize, fontWeight, shadows } from "../theme/tokens";
import type { Flag, FlagSeverity, Shift } from "../types/models";
import { assignmentFlow } from "../utils/workflowFlows";

const flagFilters = ["All", "Critical", "Warning", "Info"] as const;

type FlagFilter = (typeof flagFilters)[number];

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
  onFilterPress: (filter: FlagFilter) => void;
  selectedFilter: FlagFilter;
  warningCount: number;
};

type FlagRowProps = {
  flag: FlagRowViewModel;
};

type EmptyFlagRowProps = {
  selectedFilter: FlagFilter;
};

type FlagListItem =
  | { type: "flag"; flag: FlagRowViewModel }
  | { type: "empty"; id: string; selectedFilter: FlagFilter };

function FlagsListHeader({
  criticalCount,
  infoCount,
  onFilterPress,
  selectedFilter,
  warningCount,
}: FlagsListHeaderProps) {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection title="Flag summary">
        <SummaryTileGrid>
          <SummaryTile value={criticalCount.toString()} label="Critical" />
          <SummaryTile value={warningCount.toString()} label="Warning" />
          <SummaryTile value={infoCount.toString()} label="Info" />
        </SummaryTileGrid>
      </WorkflowSection>

      <WorkflowSection title="Filters">
        <FilterChipRow>
          {flagFilters.map((filter) => (
            <FilterChip
              key={filter}
              label={filter}
              onPress={() => onFilterPress(filter)}
              selected={filter === selectedFilter}
            />
          ))}
        </FilterChipRow>
      </WorkflowSection>

      <View style={styles.flagListHeader}>
        <Text style={styles.flagListTitle}>Flag list</Text>
      </View>
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

function getFlagListItems(
  flags: FlagRowViewModel[],
  selectedFilter: FlagFilter,
): FlagListItem[] {
  if (!flags.length) {
    return [{ id: "empty-flags", selectedFilter, type: "empty" }];
  }

  return flags.map((flag) => ({ flag, type: "flag" }));
}

function getFlagItemKey(item: FlagListItem) {
  return item.type === "flag" ? item.flag.id : item.id;
}

function renderFlagItem({ item }: { item: FlagListItem }) {
  if (item.type === "empty") {
    return <EmptyFlagRow selectedFilter={item.selectedFilter} />;
  }

  return <FlagRow flag={item.flag} />;
}

export default function FlagsScreen() {
  const { localState } = useLocalState();
  const [selectedFilter, setSelectedFilter] = useState<FlagFilter>("All");
  const flags = getFlagRows(localState.activeShift);
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
      activeStep="Flags"
      data={getFlagListItems(filteredFlags, selectedFilter)}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      keyExtractor={getFlagItemKey}
      listHeader={
        <FlagsListHeader
          criticalCount={criticalCount}
          infoCount={infoCount}
          onFilterPress={setSelectedFilter}
          selectedFilter={selectedFilter}
          warningCount={warningCount}
        />
      }
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/floor-board")}
      primaryLabel="Return to board"
      renderItem={renderFlagItem}
      subtitle=""
      title="Flags"
    />
  );
}

function FlagRow({ flag }: FlagRowProps) {
  const emojiLabel = flag.severity === "critical"
    ? `🚨 ${flag.severityLabel}`
    : flag.severity === "warning"
      ? `⚠️ ${flag.severityLabel}`
      : `ℹ️ ${flag.severityLabel}`;

  return (
    <View
      style={[
        styles.flagRow,
        severityAccentStyles[flag.severity],
        severityBackgroundStyles[flag.severity],
      ]}
    >
      <View style={styles.flagTopRow}>
        <SeverityBadge label={emojiLabel} tone={flag.severity} />
        <Text style={styles.target}>{flag.target}</Text>
      </View>
      <Text style={styles.message}>{flag.message}</Text>
    </View>
  );
}

function EmptyFlagRow({ selectedFilter }: EmptyFlagRowProps) {
  const message =
    selectedFilter === "All"
      ? "No assignment issues found."
      : `No ${selectedFilter.toLowerCase()} flags.`;

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
  flagListHeader: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.lg,
    ...shadows.sm,
  },
  flagListTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
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
