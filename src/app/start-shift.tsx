import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  NumberStepperPlaceholder,
  SegmentedPlaceholder,
  WorkflowSection,
  WorkflowScreen,
  SummaryChip,
} from "../components/workflow";
import { shiftSetupFlow } from "../constants/workflowFlows";
import { colors, spacing, textSize } from "../theme/tokens";

export default function StartShiftScreen() {
  return (
    <WorkflowScreen
      activeStep="Shift"
      headerActionLabel="Floors"
      helperText="Static shift setup only. No active shift is saved yet."
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/nurses")}
      primaryLabel="Continue"
      flow={shiftSetupFlow}
      subtitle="Step 1 of 3"
      title="Start shift"
    >
      <WorkflowSection
        note="This summary previews the saved floor template that will start a local shift later."
        title="4 North template"
      >
        <View style={styles.summaryRow}>
          <SummaryChip label="2 doctor sides" />
          <SummaryChip label="2 rooms" />
          <SummaryChip label="3 beds" />
        </View>
      </WorkflowSection>

      <WorkflowSection
        note="Phase 1 requires one admitting side before assignment."
        title="Admitting side"
      >
        <SegmentedPlaceholder options={["AB Side", "SK Side"]} />
      </WorkflowSection>

      <WorkflowSection
        note="These defaults guide local assignment later; nurse max load still stays the hard cap."
        title="Side-based load limits"
      >
        <View style={styles.limitRow}>
          <View style={styles.limitText}>
            <Text style={styles.limitTitle}>Admitting-side coverage</Text>
            <Text style={styles.limitMeta}>Default target around 4-5 patients</Text>
          </View>
          <NumberStepperPlaceholder value="5" />
        </View>

        <View style={styles.limitRow}>
          <View style={styles.limitText}>
            <Text style={styles.limitTitle}>Non-admitting only</Text>
            <Text style={styles.limitMeta}>Default target around 6-7 patients</Text>
          </View>
          <NumberStepperPlaceholder value="6" />
        </View>
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
  limitRow: {
    alignItems: "center",
    borderTopColor: colors.neutral.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
  },
  limitText: {
    flex: 1,
    gap: spacing.xs,
  },
  limitTitle: {
    color: colors.neutral.text,
    fontSize: textSize.md,
    fontWeight: "700",
  },
  limitMeta: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});
