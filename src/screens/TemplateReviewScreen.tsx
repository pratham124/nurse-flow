import { useEffect } from "react";
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
import { createLocalId } from "../helpers/localId";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize, fontWeight } from "../theme/tokens";
import type {
  Bed,
  BedState,
  DoctorSide,
  FloorTemplate,
  Room,
  Shift,
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

function isCompletedFloorTemplate(floorTemplate?: FloorTemplate) {
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

function getFloorTemplateFromActiveShift(
  activeShift?: Shift,
): FloorTemplate | undefined {
  if (!activeShift) {
    return undefined;
  }

  return {
    id: activeShift.floorTemplateId,
    name: activeShift.floorName,
    doctorSides: activeShift.doctorSides,
    rooms: activeShift.rooms,
    beds: activeShift.beds,
  };
}

function getSyncedBedStates(shift: Shift, floorTemplate: FloorTemplate) {
  const templateBedIds = floorTemplate.beds.map((bed) => bed.id);
  const bedStatesForBedsStillInTemplate = shift.bedStates.filter((bedState) =>
    templateBedIds.includes(bedState.bedId),
  );
  const bedIdsWithExistingShiftState = bedStatesForBedsStillInTemplate.map(
    (bedState) => bedState.bedId,
  );
  const bedStatesForNewTemplateBeds: BedState[] = floorTemplate.beds
    .filter((bed) => !bedIdsWithExistingShiftState.includes(bed.id))
    .map((bed) => ({
      id: createLocalId("bed-state"),
      bedId: bed.id,
    }));

  return [...bedStatesForBedsStillInTemplate, ...bedStatesForNewTemplateBeds];
}

function getShiftSyncedWithTemplate(
  shift: Shift,
  floorTemplate: FloorTemplate,
) {
  const hasCurrentAdmittingSide = floorTemplate.doctorSides.some(
    (doctorSide) => doctorSide.id === shift.admittingDoctorSideId,
  );

  return {
    ...shift,
    floorName: floorTemplate.name,
    doctorSides: floorTemplate.doctorSides,
    rooms: floorTemplate.rooms,
    beds: floorTemplate.beds,
    bedStates: getSyncedBedStates(shift, floorTemplate),
    admittingDoctorSideId: hasCurrentAdmittingSide
      ? shift.admittingDoctorSideId
      : "",
  };
}

export default function TemplateReviewScreen() {
  const { localState, setLocalState } = useLocalState();
  const draftTemplate = localState.draftFloorTemplate;
  const activeShift = localState.activeShift;
  const activeShiftTemplate = getFloorTemplateFromActiveShift(activeShift);
  const reviewTemplate = draftTemplate ?? activeShiftTemplate;
  const isReviewingActiveShiftTemplate =
    Boolean(reviewTemplate) && Boolean(localState.isEditingActiveShiftTemplate);
  const screenTitle = reviewTemplate?.name ?? "Review floor";
  const roomCount = reviewTemplate?.rooms.length ?? 0;
  const bedCount = reviewTemplate?.beds.length ?? 0;
  const doctorSideCount = reviewTemplate?.doctorSides.length ?? 0;
  const canSaveTemplate = isCompletedFloorTemplate(draftTemplate);
  const actionErrorText = isReviewingActiveShiftTemplate
    ? ""
    : draftTemplate
      ? canSaveTemplate
        ? ""
        : invalidTemplateMessage
      : "Create a floor template before saving.";

  useEffect(() => {
    if (!activeShift) {
      return;
    }

    setLocalState((currentState) => {
      if (!currentState.activeShift) {
        return currentState;
      }

      const shouldEditActiveShiftTemplate =
        Boolean(currentState.isEditingActiveShiftTemplate) ||
        !currentState.draftFloorTemplate;
      const draftTemplateForActiveShiftEdit =
        currentState.draftFloorTemplate ??
        getFloorTemplateFromActiveShift(currentState.activeShift);

      if (
        currentState.draftFloorTemplate &&
        currentState.isEditingActiveShiftTemplate ===
          shouldEditActiveShiftTemplate
      ) {
        return currentState;
      }

      return {
        ...currentState,
        draftFloorTemplate: draftTemplateForActiveShiftEdit,
        isEditingActiveShiftTemplate: shouldEditActiveShiftTemplate,
      };
    });
  }, [activeShift, setLocalState]);

  function handleSaveTemplate() {
    if (isReviewingActiveShiftTemplate) {
      if (draftTemplate) {
        setLocalState((currentState) => ({
          ...currentState,
          isEditingActiveShiftTemplate: true,
          activeShift:
            currentState.activeShift?.floorTemplateId === draftTemplate.id
              ? getShiftSyncedWithTemplate(
                  currentState.activeShift,
                  draftTemplate,
                )
              : currentState.activeShift,
        }));
      }

      router.push("/start-shift");
      return;
    }

    if (!isCompletedFloorTemplate(draftTemplate)) {
      return;
    }

    setLocalState((currentState) => {
      if (!currentState.draftFloorTemplate) {
        return currentState;
      }

      const completedDraft = currentState.draftFloorTemplate;

      return {
        ...currentState,
        activeShift:
          currentState.activeShift?.floorTemplateId === completedDraft.id
            ? getShiftSyncedWithTemplate(
                currentState.activeShift,
                completedDraft,
              )
            : currentState.activeShift,
        draftFloorTemplate: undefined,
        isEditingActiveShiftTemplate: false,
        floorTemplates: [
          ...currentState.floorTemplates.filter(
            (floorTemplate) => floorTemplate.id !== completedDraft.id,
          ),
          completedDraft,
        ],
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
      primaryLabel={
        isReviewingActiveShiftTemplate ? "Back to shift" : "Save template"
      }
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
