import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  BedChipRow,
  NumberStepperPlaceholder,
  PlaceholderButton,
  PlaceholderInput,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize } from "../theme/tokens";

const previewRooms = [
  { label: "101", bedCount: "2", beds: ["101-1", "101-2"] },
  { label: "102", bedCount: "1", beds: ["102-1"] },
];

type PreviewRoom = (typeof previewRooms)[number];

function RoomsListHeader() {
  return (
    <View style={styles.headerContent}>
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

      <View style={styles.roomsHeader}>
        <Text style={styles.roomsTitle}>Rooms</Text>
        <Text style={styles.roomsNote}>Sample room rows for the static path.</Text>
      </View>
    </View>
  );
}

function RoomPreviewRow({ room }: { room: PreviewRoom }) {
  return (
    <View style={styles.roomRow}>
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
  );
}

function renderRoomPreviewItem({ item }: { item: PreviewRoom }) {
  return <RoomPreviewRow room={item} />;
}

function getPreviewRoomKey(room: PreviewRoom) {
  return room.label;
}

export default function RoomsAndBedsScreen() {
  const { localState } = useLocalState();
  const screenTitle = localState.draftFloorTemplate?.name ?? "Rooms and beds";

  return (
    <WorkflowListScreen
      activeStep="Rooms"
      data={previewRooms}
      headerActionLabel="Floors"
      helperText="Static preview only. Adding and removing rooms comes later."
      keyExtractor={getPreviewRoomKey}
      listHeader={<RoomsListHeader />}
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/doctor-sides")}
      primaryLabel="Continue"
      renderItem={renderRoomPreviewItem}
      subtitle="Step 2 of 4"
      title={screenTitle}
    />
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  roomsHeader: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  roomsTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "500",
  },
  roomsNote: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  roomRow: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
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
