import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  PlaceholderInput,
  SegmentedPlaceholder,
  WorkflowSection,
  WorkflowScreen,
  SummaryChip,
} from "../components/workflow";
import { colors, spacing, textSize } from "../theme/tokens";

const previewAssignments = [
  { room: "101", selectedIndex: 0 },
  { room: "102", selectedIndex: 1 },
];

export default function DoctorSidesScreen() {
  return (
    <WorkflowScreen
      activeStep="Sides"
      headerActionLabel="Floors"
      helperText="Static preview only. Side names and room choices are not saved yet."
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/template-review")}
      primaryLabel="Review"
      subtitle="Step 3 of 4"
      title="Doctor sides"
    >
      <WorkflowSection
        note="Phase 1 uses exactly two doctor sides."
        title="Side names"
      >
        <PlaceholderInput label="Doctor side 1" placeholder="AB Side" />
        <PlaceholderInput label="Doctor side 2" placeholder="SK Side" />
      </WorkflowSection>

      <WorkflowSection
        note="Every room will eventually belong to exactly one side."
        title="Room assignments"
      >
        <View style={styles.summaryRow}>
          <SummaryChip label="AB Side: 1 room" />
          <SummaryChip label="SK Side: 1 room" />
        </View>

        {previewAssignments.map((assignment) => (
          <View key={assignment.room} style={styles.assignmentRow}>
            <View>
              <Text style={styles.roomLabel}>Room {assignment.room}</Text>
              <Text style={styles.roomMeta}>Choose one doctor side</Text>
            </View>
            <SegmentedPlaceholder
              options={["AB Side", "SK Side"]}
              selectedIndex={assignment.selectedIndex}
            />
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
  assignmentRow: {
    borderTopColor: colors.neutral.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.xs,
    padding: spacing.md,
    paddingHorizontal: 0,
  },
  roomLabel: {
    color: colors.neutral.text,
    fontSize: textSize.md,
    fontWeight: "700",
  },
  roomMeta: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
  },
});
