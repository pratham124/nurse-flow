import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  WorkflowSection,
  WorkflowScreen,
  SummaryChip,
} from "../components/workflow";
import { colors, spacing, textSize } from "../theme/tokens";

const reviewSides = [
  { name: "AB Side", rooms: [{ label: "101", beds: ["101-1", "101-2"] }] },
  { name: "SK Side", rooms: [{ label: "102", beds: ["102-1"] }] },
];

export default function TemplateReviewScreen() {
  return (
    <WorkflowScreen
      activeStep="Review"
      headerActionLabel="Floors"
      helperText="Static preview only. Local template saving comes in later tasks."
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/start-shift")}
      primaryLabel="Save template"
      subtitle="Step 4 of 4"
      title="Review floor"
    >
      <WorkflowSection
        note="This preview shows the information the charge nurse will confirm."
        title="Template summary"
      >
        <Text style={styles.floorName}>4 North</Text>
        <View style={styles.summaryRow}>
          <SummaryChip label="2 rooms" />
          <SummaryChip label="3 beds" />
          <SummaryChip label="2 doctor sides" />
        </View>
      </WorkflowSection>

      {reviewSides.map((side) => (
        <WorkflowSection key={side.name} title={side.name}>
          {side.rooms.map((room) => (
            <View key={room.label} style={styles.roomRow}>
              <Text style={styles.roomLabel}>Room {room.label}</Text>
              <View style={styles.bedRow}>
                {room.beds.map((bed) => (
                  <BedChip key={bed} label={bed} />
                ))}
              </View>
            </View>
          ))}
        </WorkflowSection>
      ))}

      <View style={styles.editArea}>
        <Text style={styles.editTitle}>Edit actions</Text>
        <Text style={styles.editText}>
          Later tasks will connect these to floor details, rooms, and doctor
          sides so the template can be corrected before saving.
        </Text>
      </View>
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  floorName: {
    color: colors.brand.burgundy,
    fontSize: textSize.lg,
    fontWeight: "700",
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  roomRow: {
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
  bedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  editArea: {
    backgroundColor: colors.brand.warmGold,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  editTitle: {
    color: colors.neutral.text,
    fontSize: textSize.md,
    fontWeight: "700",
  },
  editText: {
    color: colors.neutral.text,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});
