import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  FilterChip,
  FilterChipRow,
  SeverityBadge as SeverityPill,
  SummaryTile,
  SummaryTileGrid,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { assignmentFlow } from "../utils/workflowFlows";
import { colors, radius, spacing, textSize } from "../theme/tokens";

const flags = [
  {
    severity: "Warning",
    target: "Floor",
    message: "Total occupied beds are close to current nurse capacity.",
  },
  {
    severity: "Info",
    target: "Sam",
    message: "Sam has room coverage but no assigned beds in this preview.",
  },
];

type FlagSeverity = (typeof flags)[number]["severity"];
type PreviewFlag = (typeof flags)[number];

type FlagRowProps = {
  message: string;
  severity: FlagSeverity;
  target: string;
};

type FlagSeverityBadgeProps = {
  severity: FlagSeverity;
};

const flagFilters = ["All", "Critical", "Warning", "Info"];

function FlagsListHeader() {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection title="Flag summary">
        <SummaryTileGrid>
          <SummaryTile value="0" label="Critical" />
          <SummaryTile value="1" label="Warning" />
          <SummaryTile value="1" label="Info" />
        </SummaryTileGrid>
      </WorkflowSection>

      <WorkflowSection title="Filters">
        <FilterChipRow>
          {flagFilters.map((filter, index) => (
            <FilterChip key={filter} label={filter} selected={index === 0} />
          ))}
        </FilterChipRow>
      </WorkflowSection>

      <View style={styles.flagListHeader}>
        <Text style={styles.flagListTitle}>Flag list</Text>
      </View>
    </View>
  );
}

function renderFlagItem({ item }: { item: PreviewFlag }) {
  return (
    <FlagRow
      message={item.message}
      severity={item.severity}
      target={item.target}
    />
  );
}

function getFlagKey(flag: PreviewFlag) {
  return `${flag.severity}-${flag.target}`;
}

export default function FlagsScreen() {
  return (
    <WorkflowListScreen
      activeStep="Flags"
      data={flags}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      keyExtractor={getFlagKey}
      listHeader={<FlagsListHeader />}
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/floor-board")}
      primaryLabel="Return to board"
      renderItem={renderFlagItem}
      subtitle="Local assignment issues"
      title="Flags"
    />
  );
}

function FlagRow({
  message,
  severity,
  target,
}: FlagRowProps) {
  const tone = getSeverityTone(severity);

  return (
    <View style={[styles.flagRow, severityAccentStyles[tone]]}>
      <View style={styles.flagTopRow}>
        <FlagSeverityBadge severity={severity} />
        <Text style={styles.target}>{target}</Text>
      </View>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

function FlagSeverityBadge({ severity }: FlagSeverityBadgeProps) {
  return <SeverityPill label={severity} tone={getSeverityTone(severity)} />;
}

function getSeverityTone(severity: FlagSeverity) {
  const tone =
    severity === "Critical"
      ? "critical"
      : severity === "Warning"
        ? "warning"
        : "info";

  return tone;
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  flagListHeader: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  flagListTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "500",
  },
  flagRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  flagTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  target: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  message: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
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
