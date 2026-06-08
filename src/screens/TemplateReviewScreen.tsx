import { useState } from "react";
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
import { colors, radius, spacing, textSize, fontWeight } from "../theme/tokens";
import type {
  Bed,
  DoctorSide,
  FloorTemplate,
  Room,
} from "../types/models";

type ReviewRoomRowProps = {
  beds: Bed[];
  room: Room;
};

type ReviewDoctorSideSectionProps = {
  beds: Bed[];
  doctorSide: DoctorSide;
  rooms: Room[];
};

const invalidTemplateMessage =
  "Complete the floor name, rooms, beds, and doctor sides before saving.";

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

function getCountLabel(
  count: number,
  singularLabel: string,
  pluralLabel: string,
) {
  return count === 1 ? singularLabel : pluralLabel;
}

function isCompletedFloorTemplate(
  floorTemplate?: FloorTemplate,
): floorTemplate is FloorTemplate {
  if (!floorTemplate) {
    return false;
  }

  const doctorSideIds = floorTemplate.doctorSides.map(
    (doctorSide) => doctorSide.id,
  );
  const hasNamedDoctorSides =
    floorTemplate.doctorSides.length === 2 &&
    floorTemplate.doctorSides.every((doctorSide) => doctorSide.name.trim());
  const hasRooms = floorTemplate.rooms.length > 0;
  const hasValidRooms = floorTemplate.rooms.every(
    (room) =>
      room.label.trim() &&
      room.bedCount > 0 &&
      doctorSideIds.includes(room.doctorSideId),
  );
  const hasBedsForEveryRoom = floorTemplate.rooms.every((room) =>
    floorTemplate.beds.some((bed) => bed.roomId === room.id),
  );

  return (
    Boolean(floorTemplate.name.trim()) &&
    hasNamedDoctorSides &&
    hasRooms &&
    hasValidRooms &&
    hasBedsForEveryRoom
  );
}

function getFloorTemplatesWithSavedTemplate(
  floorTemplates: FloorTemplate[],
  savedTemplate: FloorTemplate,
) {
  const existingTemplate = floorTemplates.find(
    (floorTemplate) => floorTemplate.id === savedTemplate.id,
  );

  if (!existingTemplate) {
    return [...floorTemplates, savedTemplate];
  }

  return floorTemplates.map((floorTemplate) =>
    floorTemplate.id === savedTemplate.id ? savedTemplate : floorTemplate,
  );
}

export default function TemplateReviewScreen() {
  const { localState, saveFloorTemplates, setLocalState } = useLocalState();
  const [saveErrorText, setSaveErrorText] = useState("");
  const draftTemplate = localState.draftFloorTemplate;
  const reviewTemplate = draftTemplate;
  const screenTitle = reviewTemplate?.name ?? "Review floor";
  const roomCount = reviewTemplate?.rooms.length ?? 0;
  const bedCount = reviewTemplate?.beds.length ?? 0;
  const doctorSideCount = reviewTemplate?.doctorSides.length ?? 0;
  const canSaveTemplate = isCompletedFloorTemplate(draftTemplate);
  const actionErrorText =
    saveErrorText ||
    (draftTemplate
      ? canSaveTemplate
        ? ""
        : invalidTemplateMessage
      : "Create a floor template before saving.");

  async function handleSaveTemplate() {
    setSaveErrorText("");

    if (!isCompletedFloorTemplate(draftTemplate)) {
      return;
    }

    const completedDraft = draftTemplate;
    const nextFloorTemplates = getFloorTemplatesWithSavedTemplate(
      localState.floorTemplates,
      completedDraft,
    );

    try {
      await saveFloorTemplates(nextFloorTemplates);
    } catch {
      setSaveErrorText("Template could not be saved to this device. Try again.");
      return;
    }

    setLocalState((currentState) => {
      if (!currentState.draftFloorTemplate) {
        return currentState;
      }

      return {
        ...currentState,
        draftFloorTemplate: undefined,
        floorTemplates: nextFloorTemplates,
      };
    });

    router.push("/");
  }

  return (
    <WorkflowScreen
      activeStep="Review"
      actionErrorText={actionErrorText}
      headerActionLabel="Floors"
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={handleSaveTemplate}
      primaryLabel="Save template"
      subtitle="Step 4 of 4"
      title={screenTitle}
    >
      <WorkflowSection title="✓ Template summary">
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

      {reviewTemplate?.doctorSides.map((doctorSide) => (
        <ReviewDoctorSideSection
          beds={reviewTemplate.beds}
          doctorSide={doctorSide}
          key={doctorSide.id}
          rooms={reviewTemplate.rooms}
        />
      ))}
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  roomRow: {
    backgroundColor: colors.neutral.backgroundPrimary,
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
    fontWeight: fontWeight.bold,
  },
  roomBedCount: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
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
    backgroundColor: colors.neutral.backgroundPrimary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
