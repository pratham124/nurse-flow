import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  PlaceholderInput,
  SegmentedPlaceholder,
  WorkflowSection,
  WorkflowScreen,
  SummaryChip,
} from "../components/workflow";
import { shiftSetupFlow } from "../utils/workflowFlows";
import { colors, spacing, textSize } from "../theme/tokens";

const previewBeds = [
  {
    room: "101",
    side: "AB Side",
    beds: [
      { label: "101-1", occupied: true, acuity: "Yellow" },
      { label: "101-2", occupied: false, acuity: "Empty" },
    ],
  },
  {
    room: "102",
    side: "SK Side",
    beds: [{ label: "102-1", occupied: true, acuity: "Red" }],
  },
];

export default function PatientsAndAcuityScreen() {
  return (
    <WorkflowScreen
      activeStep="Patients"
      headerActionLabel="Floors"
      helperText="Static patient setup only. Assignment logic comes in later tasks."
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/assignment-review")}
      primaryLabel="Review assignment"
      flow={shiftSetupFlow}
      subtitle="Step 3 of 3"
      title="Patients and acuity"
    >
      <WorkflowSection
        note="Census totals will update from local bed state in a later task."
        title="Census"
      >
        <View style={styles.summaryRow}>
          <SummaryChip label="2 occupied" />
          <SummaryChip label="3 total beds" />
          <SummaryChip label="1 red" />
        </View>
      </WorkflowSection>

      <WorkflowSection
        note="Filters are visual placeholders until patient state exists."
        title="Filters"
      >
        <View style={styles.filterRow}>
          {["All", "Occupied", "Empty", "Missing acuity", "Red"].map(
            (filter) => (
              <SummaryChip key={filter} label={filter} />
            ),
          )}
        </View>
      </WorkflowSection>

      {previewBeds.map((room) => (
        <WorkflowSection
          key={room.room}
          note={room.side}
          title={`Room ${room.room}`}
        >
          {room.beds.map((bed) => (
            <View key={bed.label} style={styles.bedRow}>
              <View style={styles.bedHeader}>
                <BedChip label={bed.label} />
                <Text
                  style={[
                    styles.occupancyText,
                    bed.occupied ? styles.occupiedText : null,
                  ]}
                >
                  {bed.occupied ? "Occupied" : "Empty"}
                </Text>
              </View>

              {bed.occupied ? (
                <>
                  <PlaceholderInput label="Patient initials" placeholder="J.S." />

                  <View style={styles.patientDetailsRow}>
                    <PlaceholderInput label="Age" placeholder="67" />
                    <SegmentedPlaceholder options={["F", "M", "Other"]} />
                  </View>

                  <PlaceholderInput
                    label="Diagnosis"
                    placeholder="CHF exacerbation"
                  />

                  <View style={styles.acuityArea}>
                    <Text style={styles.acuityLabel}>Bed acuity</Text>
                    <View style={styles.acuityLegend}>
                      <AcuityDot color={colors.acuity.green} label="Green" />
                      <AcuityDot
                        color={colors.acuity.yellow}
                        label="Yellow"
                      />
                      <AcuityDot color={colors.acuity.red} label="Red" />
                    </View>
                    <SegmentedPlaceholder
                      options={["Green", "Yellow", "Red"]}
                      selectedIndex={bed.acuity === "Red" ? 2 : 1}
                    />
                  </View>
                </>
              ) : (
                <View style={styles.emptyBedNote}>
                  <Text style={styles.emptyBedText}>
                    Empty beds stay visible but do not need patient details or
                    acuity.
                  </Text>
                </View>
              )}
            </View>
          ))}
        </WorkflowSection>
      ))}
    </WorkflowScreen>
  );
}

function AcuityDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.acuityDotItem}>
      <View style={[styles.acuityDot, { backgroundColor: color }]} />
      <Text style={styles.acuityDotText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  bedRow: {
    borderTopColor: colors.neutral.border,
    borderTopWidth: 1,
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
  },
  bedHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  occupancyText: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
    fontWeight: "700",
  },
  occupiedText: {
    color: colors.brand.burgundy,
  },
  patientDetailsRow: {
    gap: spacing.md,
  },
  emptyBedNote: {
    backgroundColor: colors.neutral.background,
    padding: spacing.md,
  },
  emptyBedText: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  acuityArea: {
    gap: spacing.sm,
  },
  acuityLabel: {
    color: colors.neutral.text,
    fontSize: textSize.sm,
    fontWeight: "700",
  },
  acuityLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  acuityDotItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  acuityDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  acuityDotText: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
  },
});
