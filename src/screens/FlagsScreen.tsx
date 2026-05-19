import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  FilterChip,
  FilterChipRow,
  ScrollableList,
  SeverityBadge as SeverityPill,
  SummaryTile,
  SummaryTileGrid,
  WorkflowSection,
  WorkflowScreen,
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

export default function FlagsScreen() {
  return (
    <WorkflowScreen
      activeStep="Flags"
      headerActionLabel="Floors"
      helperText="Static flags only. Real flags are generated after the assignment algorithm exists."
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/floor-board")}
      primaryLabel="Return to board"
      flow={assignmentFlow}
      subtitle="Local assignment issues"
      title="Flags"
    >
      <WorkflowSection title="Flag summary">
        <SummaryTileGrid>
          <SummaryTile value="0" label="Critical" />
          <SummaryTile value="1" label="Warning" />
          <SummaryTile value="1" label="Info" />
        </SummaryTileGrid>
      </WorkflowSection>

      <WorkflowSection title="Filters">
        <FilterChipRow>
          {["All", "Critical", "Warning", "Info"].map((filter, index) => (
            <FilterChip key={filter} label={filter} selected={index === 0} />
          ))}
        </FilterChipRow>
      </WorkflowSection>

      <WorkflowSection
        note="Flags are local and informational in Phase 1. They do not imply push notifications."
        title="Flag list"
      >
        <ScrollableList maxHeight={280}>
          {flags.map((flag) => (
            <FlagRow
              key={`${flag.severity}-${flag.target}`}
              message={flag.message}
              severity={flag.severity}
              target={flag.target}
            />
          ))}
        </ScrollableList>
      </WorkflowSection>
    </WorkflowScreen>
  );
}

function FlagRow({
  message,
  severity,
  target,
}: {
  message: string;
  severity: FlagSeverity;
  target: string;
}) {
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

function FlagSeverityBadge({ severity }: { severity: FlagSeverity }) {
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
