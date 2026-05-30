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
import type { Bed, DoctorSide, Room } from "../types/models";

type ReviewRoomRowProps = {
  beds: Bed[];
  room: Room;
};

type ReviewDoctorSideSectionProps = {
  beds: Bed[];
  doctorSide: DoctorSide;
  rooms: Room[];
};

function ReviewRoomRow({ beds, room }: ReviewRoomRowProps) {
  const bedCountLabel = getCountLabel(beds.length, "bed", "beds");

  return (
    <View style={styles.roomRow}>
      <View style={styles.roomTopRow}>
        <Text style={styles.roomLabel}>Room {room.label}</Text>
        <Text style={styles.roomBedCount}>
          {beds.length} {bedCountLabel}
        </Text>
      </View>
      <BedChipRow>
        {beds.map((bed) => (
          <BedChip key={bed.id} label={bed.label} />
        ))}
      </BedChipRow>
    </View>
  );
}

function ReviewDoctorSideSection({
  beds,
  doctorSide,
  rooms,
}: ReviewDoctorSideSectionProps) {
  const sideRooms = rooms.filter((room) => room.doctorSideId === doctorSide.id);
  const sideBedCount = sideRooms.reduce(
    (count, room) => count + getRoomBeds(room, beds).length,
    0,
  );

  return (
    <WorkflowSection key={doctorSide.id} title={doctorSide.name}>
      <View style={styles.sideSummaryRow}>
        <Text style={styles.sideSummaryText}>
          {sideRooms.length} {getCountLabel(sideRooms.length, "room", "rooms")}
        </Text>
        <Text style={styles.sideSummaryText}>
          {sideBedCount} {getCountLabel(sideBedCount, "bed", "beds")}
        </Text>
      </View>

      <ScrollableList maxHeight={280}>
        {sideRooms.length ? (
          sideRooms.map((room) => (
            <ReviewRoomRow
              beds={getRoomBeds(room, beds)}
              key={room.id}
              room={room}
            />
          ))
        ) : (
          <Text style={styles.emptySideText}>
            No rooms assigned to this side.
          </Text>
        )}
      </ScrollableList>
    </WorkflowSection>
  );
}

function getRoomBeds(room: Room, beds: Bed[]) {
  return beds
    .filter((bed) => bed.roomId === room.id)
    .sort((firstBed, secondBed) => firstBed.bedNumber - secondBed.bedNumber);
}

function getCountLabel(count: number, singularLabel: string, pluralLabel: string) {
  return count === 1 ? singularLabel : pluralLabel;
}

export default function TemplateReviewScreen() {
  const { localState } = useLocalState();
  const draftTemplate = localState.draftFloorTemplate;
  const screenTitle = draftTemplate?.name ?? "Review floor";
  const roomCount = draftTemplate?.rooms.length ?? 0;
  const bedCount = draftTemplate?.beds.length ?? 0;
  const doctorSideCount = draftTemplate?.doctorSides.length ?? 0;

  return (
    <WorkflowScreen
      activeStep="Review"
      headerActionLabel="Floors"
      helperText="Review-only for this task. Local template saving comes next."
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => undefined}
      primaryLabel="Save template"
      subtitle="Step 4 of 4"
      title={screenTitle}
    >
      <WorkflowSection
        note="This preview shows the information the charge nurse will confirm."
        title="Template summary"
      >
        <SummaryTileGrid>
          <SummaryTile
            value={roomCount.toString()}
            label={getCountLabel(roomCount, "Room", "Rooms")}
          />
          <SummaryTile
            value={bedCount.toString()}
            label={getCountLabel(bedCount, "Bed", "Beds")}
          />
          <SummaryTile
            value={doctorSideCount.toString()}
            label={getCountLabel(
              doctorSideCount,
              "Doctor side",
              "Doctor sides",
            )}
          />
        </SummaryTileGrid>
      </WorkflowSection>

      {draftTemplate?.doctorSides.map((doctorSide) => (
        <ReviewDoctorSideSection
          beds={draftTemplate.beds}
          doctorSide={doctorSide}
          key={doctorSide.id}
          rooms={draftTemplate.rooms}
        />
      ))}
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  roomRow: {
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
  },
  roomTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  roomLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "600",
  },
  roomBedCount: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
  },
  emptySideText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  sideSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sideSummaryText: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
