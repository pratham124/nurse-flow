import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  WorkflowSection,
  WorkflowScreen,
  SummaryChip,
} from "../components/workflow";
import { assignmentFlow } from "../constants/workflowFlows";
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
        <View style={styles.summaryRow}>
          <SummaryChip label="0 critical" />
          <SummaryChip label="1 warning" />
          <SummaryChip label="1 info" />
        </View>
      </WorkflowSection>

      <WorkflowSection title="Filters">
        <View style={styles.summaryRow}>
          {["All", "Critical", "Warning", "Info"].map((filter) => (
            <SummaryChip key={filter} label={filter} />
          ))}
        </View>
      </WorkflowSection>

      <WorkflowSection
        note="Flags are local and informational in Phase 1. They do not imply push notifications."
        title="Flag list"
      >
        {flags.map((flag) => (
          <View key={`${flag.severity}-${flag.target}`} style={styles.flagRow}>
            <View style={styles.flagTopRow}>
              <Text
                style={[
                  styles.severity,
                  flag.severity === "Warning" ? styles.warningSeverity : null,
                ]}
              >
                {flag.severity}
              </Text>
              <Text style={styles.target}>{flag.target}</Text>
            </View>
            <Text style={styles.message}>{flag.message}</Text>
          </View>
        ))}
      </WorkflowSection>
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  flagRow: {
    borderTopColor: colors.neutral.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  flagTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  severity: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
    fontWeight: "700",
  },
  warningSeverity: {
    color: colors.acuity.yellow,
  },
  target: {
    color: colors.neutral.text,
    fontSize: textSize.md,
    fontWeight: "700",
  },
  message: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});
