import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  BedChipRow,
  NumberStepperPlaceholder,
  PlaceholderButton,
  PlaceholderInput,
  ScrollableList,
  WorkflowSection,
  WorkflowScreen,
} from "../components/workflow";
import { colors, spacing, textSize } from "../theme/tokens";

const previewRooms = [
  { label: "101", bedCount: "2", beds: ["101-1", "101-2"] },
  { label: "102", bedCount: "1", beds: ["102-1"] },
];

export default function RoomsAndBedsScreen() {
  return (
    <WorkflowScreen
      activeStep="Rooms"
      headerActionLabel="Floors"
      helperText="Static preview only. Adding and removing rooms comes later."
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/doctor-sides")}
      primaryLabel="Continue"
      subtitle="Step 2 of 4"
      title="Rooms and beds"
    >
      <WorkflowSection
        note="Rooms will become the structure used by the local assignment board."
        title="Add room"
      >
        <PlaceholderInput
          helperText="Room labels can be numbers or short names."
          label="Room label"
          placeholder="101"
        />
        <PlaceholderButton label="Add room" />
      </WorkflowSection>

      <WorkflowSection note="Sample room rows for the static path." title="Rooms">
        <ScrollableList maxHeight={340}>
          {previewRooms.map((room) => (
            <View key={room.label} style={styles.roomRow}>
              <View style={styles.roomTopRow}>
                <View>
                  <Text style={styles.roomLabel}>Room {room.label}</Text>
                  <Text style={styles.roomMeta}>{room.beds.length} beds</Text>
                </View>
                <NumberStepperPlaceholder value={room.bedCount} />
              </View>

              <BedChipRow>
                {room.beds.map((bed) => (
                  <BedChip key={bed} label={bed} />
                ))}
              </BedChipRow>
            </View>
          ))}
        </ScrollableList>
      </WorkflowSection>
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  roomRow: {
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: 0,
  },
  roomTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roomLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  roomMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
  },
});
