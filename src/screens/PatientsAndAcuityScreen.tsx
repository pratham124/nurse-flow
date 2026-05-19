import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  FilterChip,
  FilterChipRow,
  PlaceholderInput,
  ScrollableList,
  SegmentedPlaceholder,
  StatusPill,
  SummaryTile,
  SummaryTileGrid,
  WorkflowSection,
  WorkflowScreen,
} from "../components/workflow";
import { shiftSetupFlow } from "../utils/workflowFlows";
import { colors, radius, spacing, textSize } from "../theme/tokens";

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
        <SummaryTileGrid>
          <SummaryTile value="2" label="Occupied" />
          <SummaryTile value="3" label="Total beds" />
          <SummaryTile value="1" label="Red" />
        </SummaryTileGrid>
      </WorkflowSection>

      <WorkflowSection
        note="Filters are visual placeholders until patient state exists."
        title="Filters"
      >
        <FilterChipRow>
          {["All", "Occupied", "Empty", "Missing acuity", "Red"].map(
            (filter, index) => (
              <FilterChip key={filter} label={filter} selected={index === 0} />
            ),
          )}
        </FilterChipRow>
      </WorkflowSection>

      {previewBeds.map((room) => (
        <WorkflowSection
          key={room.room}
          note={room.side}
          title={`Room ${room.room}`}
        >
          <ScrollableList maxHeight={420}>
            {room.beds.map((bed) => (
              <View key={bed.label} style={styles.bedRow}>
                <View style={styles.bedHeader}>
                  <BedChip label={bed.label} />
                  <BedStatusBadge occupied={bed.occupied} />
                </View>

                {bed.occupied ? (
                  <>
                    <PlaceholderInput
                      label="Patient initials"
                      placeholder="J.S."
                    />

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
                        <AcuityLegendItem
                          color={colors.status.green700}
                          label="Green"
                        />
                        <AcuityLegendItem
                          color={colors.status.yellow700}
                          label="Yellow"
                        />
                        <AcuityLegendItem
                          color={colors.status.red700}
                          label="Red"
                        />
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
          </ScrollableList>
        </WorkflowSection>
      ))}
    </WorkflowScreen>
  );
}

function BedStatusBadge({ occupied }: { occupied: boolean }) {
  return (
    <StatusPill
      label={occupied ? "Occupied" : "Empty"}
      tone={occupied ? "occupied" : "empty"}
    />
  );
}

function AcuityLegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.acuityLegendItem}>
      <View style={[styles.acuityDot, { backgroundColor: color }]} />
      <Text style={styles.acuityLegendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bedRow: {
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
  },
  bedHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  patientDetailsRow: {
    gap: spacing.md,
  },
  emptyBedNote: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  emptyBedText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  acuityArea: {
    gap: spacing.sm,
  },
  acuityLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: "500",
  },
  acuityLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  acuityLegendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  acuityDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  acuityLegendText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
  },
});
