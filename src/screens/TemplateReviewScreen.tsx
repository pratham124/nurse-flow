import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  BedChipRow,
  ScrollableList,
  SummaryTile,
  SummaryTileGrid,
  WorkflowSection,
  WorkflowScreen,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize } from "../theme/tokens";

const reviewSides = [
  { name: "AB Side", rooms: [{ label: "101", beds: ["101-1", "101-2"] }] },
  { name: "SK Side", rooms: [{ label: "102", beds: ["102-1"] }] },
];

export default function TemplateReviewScreen() {
  const { localState } = useLocalState();
  const screenTitle = localState.draftFloorTemplate?.name ?? "Review floor";

  return (
    <WorkflowScreen
      activeStep="Review"
      headerActionLabel="Floors"
      helperText="Static preview only. Local template saving comes in later tasks."
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/start-shift")}
      primaryLabel="Save template"
      subtitle="Step 4 of 4"
      title={screenTitle}
    >
      <WorkflowSection
        note="This preview shows the information the charge nurse will confirm."
        title="Template summary"
      >
        <Text style={styles.floorName}>{screenTitle}</Text>
        <SummaryTileGrid>
          <SummaryTile value="2" label="Rooms" />
          <SummaryTile value="3" label="Beds" />
          <SummaryTile value="2" label="Doctor sides" />
        </SummaryTileGrid>
      </WorkflowSection>

      {reviewSides.map((side) => (
        <WorkflowSection key={side.name} title={side.name}>
          <ScrollableList maxHeight={280}>
            {side.rooms.map((room) => (
              <View key={room.label} style={styles.roomRow}>
                <Text style={styles.roomLabel}>Room {room.label}</Text>
                <BedChipRow>
                  {room.beds.map((bed) => (
                    <BedChip key={bed} label={bed} />
                  ))}
                </BedChipRow>
              </View>
            ))}
          </ScrollableList>
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
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "500",
  },
  roomRow: {
    gap: spacing.md,
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: 0,
  },
  roomLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  editArea: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: radius.xl,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  editTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  editText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});
