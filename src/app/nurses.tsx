import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  NumberStepperPlaceholder,
  PlaceholderButton,
  PlaceholderInput,
  SegmentedPlaceholder,
  WorkflowSection,
  WorkflowScreen,
  SummaryChip,
} from "../components/workflow";
import { shiftSetupFlow } from "../constants/workflowFlows";
import { colors, spacing, textSize } from "../theme/tokens";

const previewNurses = [
  { name: "Taylor", license: "RN", experience: "Experienced", maxLoad: "5" },
  { name: "Sam", license: "LPN", experience: "Mid", maxLoad: "6" },
];

export default function NursesScreen() {
  return (
    <WorkflowScreen
      activeStep="Nurses"
      headerActionLabel="Floors"
      helperText="Static nurse setup only. Nurse rows are sample data for now."
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/patients-and-acuity")}
      primaryLabel="Continue"
      flow={shiftSetupFlow}
      subtitle="Step 2 of 3"
      title="Nurses"
    >
      <WorkflowSection
        note="Later, each nurse will be added to the active local shift."
        title="Add nurse"
      >
        <PlaceholderInput label="Nurse name" placeholder="Taylor" />
        <SegmentedPlaceholder options={["RN", "LPN"]} />
        <SegmentedPlaceholder
          options={["New grad", "Mid", "Experienced"]}
          selectedIndex={2}
        />
        <PlaceholderButton label="Add nurse" />
      </WorkflowSection>

      <WorkflowSection
        note="Max load is a hard cap for assignment in later tasks."
        title="Shift nurses"
      >
        <View style={styles.summaryRow}>
          <SummaryChip label="2 nurses" />
          <SummaryChip label="11 total capacity" />
        </View>

        {previewNurses.map((nurse) => (
          <View key={`${nurse.name}-${nurse.license}`} style={styles.nurseRow}>
            <View style={styles.nurseInfo}>
              <Text style={styles.nurseName}>{nurse.name}</Text>
              <Text style={styles.nurseMeta}>
                {nurse.license} - {nurse.experience}
              </Text>
            </View>
            <View style={styles.maxLoad}>
              <Text style={styles.maxLoadLabel}>Max load</Text>
              <NumberStepperPlaceholder value={nurse.maxLoad} />
            </View>
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
  nurseRow: {
    alignItems: "center",
    borderTopColor: colors.neutral.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
  },
  nurseInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  nurseName: {
    color: colors.neutral.text,
    fontSize: textSize.md,
    fontWeight: "700",
  },
  nurseMeta: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
  },
  maxLoad: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  maxLoadLabel: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
    fontWeight: "700",
  },
});
