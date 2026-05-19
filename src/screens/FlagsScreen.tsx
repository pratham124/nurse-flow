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
import { colors, spacing, textSize } from "../theme/tokens";

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
            <View key={`${flag.severity}-${flag.target}`} style={styles.flagRow}>
              <View style={styles.flagTopRow}>
                <FlagSeverityBadge severity={flag.severity} />
                <Text style={styles.target}>{flag.target}</Text>
              </View>
              <Text style={styles.message}>{flag.message}</Text>
            </View>
          ))}
        </ScrollableList>
      </WorkflowSection>
    </WorkflowScreen>
  );
}

function FlagSeverityBadge({ severity }: { severity: string }) {
  const tone =
    severity === "Critical"
      ? "critical"
      : severity === "Warning"
        ? "warning"
        : "info";

  return <SeverityPill label={severity} tone={tone} />;
}

const styles = StyleSheet.create({
  flagRow: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
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
