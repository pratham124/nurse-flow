import { useEffect, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  PlaceholderInput,
  SegmentedPlaceholder,
  SummaryTile,
  SummaryTileGrid,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { createLocalId } from "../helpers/localId";
import { useWorkflowDraft } from "../store/WorkflowDraftContext";
import { colors, radius, spacing, textSize, fontWeight, shadows } from "../theme/tokens";
import type { DoctorSide, Room } from "../types/models";

const requiredDoctorSideNameMessage = "Doctor side name is required.";
const duplicateDoctorSideNameMessage = "Doctor side names must be different.";
const missingDoctorSideMessage = "Every room needs a doctor side.";

type AssignmentPreviewRowProps = {
  doctorSides: DoctorSide[];
  hasMissingDoctorSide: boolean;
  onAssignRoomToSide: (roomId: string, doctorSideId: string) => void;
  room: Room;
};

type DoctorSidesListHeaderProps = {
  sideOneRoomCount: number;
  sideOneName: string;
  sideOneNameError: string;
  sideTwoRoomCount: number;
  sideTwoName: string;
  sideTwoNameError: string;
  onSideNameChange: (sideIndex: number, name: string) => void;
};

function createDefaultDoctorSide(): DoctorSide {
  return {
    id: createLocalId("doctor-side"),
    name: "",
  };
}

function createTwoDoctorSides(doctorSides: DoctorSide[]) {
  return [0, 1].map((sideIndex) => {
    const existingDoctorSide = doctorSides[sideIndex];

    if (existingDoctorSide) {
      return existingDoctorSide;
    }

    return createDefaultDoctorSide();
  });
}

function validateDoctorSideNames(
  sideOneName: string,
  sideTwoName: string,
  shouldRequireNames: boolean,
) {
  const trimmedSideOneName = sideOneName.trim();
  const trimmedSideTwoName = sideTwoName.trim();
  const errors = ["", ""];

  if (shouldRequireNames && !trimmedSideOneName) {
    errors[0] = requiredDoctorSideNameMessage;
  }

  if (shouldRequireNames && !trimmedSideTwoName) {
    errors[1] = requiredDoctorSideNameMessage;
  }

  if (
    trimmedSideOneName &&
    trimmedSideTwoName &&
    trimmedSideOneName.toLowerCase() === trimmedSideTwoName.toLowerCase()
  ) {
    errors[0] = duplicateDoctorSideNameMessage;
    errors[1] = duplicateDoctorSideNameMessage;
  }

  return errors;
}

function DoctorSidesListHeader({
  sideOneRoomCount,
  sideOneName,
  sideOneNameError,
  sideTwoRoomCount,
  sideTwoName,
  sideTwoNameError,
  onSideNameChange,
}: DoctorSidesListHeaderProps) {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection title="Side names">
        <PlaceholderInput
          errorText={sideOneNameError}
          label="Doctor side 1"
          onChangeText={(text) => onSideNameChange(0, text)}
          placeholder="AB Side"
          value={sideOneName}
        />
        <PlaceholderInput
          errorText={sideTwoNameError}
          label="Doctor side 2"
          onChangeText={(text) => onSideNameChange(1, text)}
          placeholder="SK Side"
          value={sideTwoName}
        />
      </WorkflowSection>

      <View style={styles.divider} />

      <View style={styles.assignmentHeader}>
        <View style={styles.assignmentTitleGroup}>
          <Text style={styles.assignmentTitle}>Room assignments</Text>
        </View>

        <SummaryTileGrid>
          <SummaryTile
            value={formatRoomCount(sideOneRoomCount)}
            label={sideOneName || "Side 1"}
          />
          <SummaryTile
            value={formatRoomCount(sideTwoRoomCount)}
            label={sideTwoName || "Side 2"}
          />
        </SummaryTileGrid>
      </View>
    </View>
  );
}

function AssignmentPreviewRow({
  doctorSides,
  hasMissingDoctorSide,
  onAssignRoomToSide,
  room,
}: AssignmentPreviewRowProps) {
  const doctorSideNames = doctorSides.map(
    (doctorSide, index) => doctorSide.name || `Side ${index + 1}`,
  );
  const selectedIndex = doctorSides.findIndex(
    (doctorSide) => doctorSide.id === room.doctorSideId,
  );
  const selectedSideName =
    selectedIndex >= 0 ? doctorSideNames[selectedIndex] : undefined;

  return (
    <View
      style={[
        styles.assignmentRow,
        hasMissingDoctorSide ? styles.missingDoctorSideRow : null,
      ]}
    >
      <View>
        <Text style={styles.roomLabel}>Room {room.label}</Text>
        <Text style={styles.roomMeta}>
          {selectedSideName
            ? `${selectedSideName} assigned`
            : "Choose one doctor side"}
        </Text>
      </View>
      <SegmentedPlaceholder
        options={doctorSideNames}
        selectedIndex={selectedIndex >= 0 ? selectedIndex : null}
        onSelect={(sideIndex) => {
          const selectedDoctorSide = doctorSides[sideIndex];

          if (selectedDoctorSide) {
            onAssignRoomToSide(room.id, selectedDoctorSide.id);
          }
        }}
      />
    </View>
  );
}

function getRoomKey(room: Room) {
  return room.id;
}

function formatRoomCount(roomCount: number) {
  return roomCount === 1 ? "1 room" : `${roomCount} rooms`;
}

function getRoomIdsMissingDoctorSide(rooms: Room[], doctorSides: DoctorSide[]) {
  const doctorSideIds = doctorSides.map((doctorSide) => doctorSide.id);

  return rooms
    .filter((room) => !doctorSideIds.includes(room.doctorSideId))
    .map((room) => room.id);
}

export default function DoctorSidesScreen() {
  const { draftFloorTemplate, setDraftFloorTemplate } = useWorkflowDraft();
  const [sideNameErrors, setSideNameErrors] = useState(["", ""]);
  const [missingDoctorSideError, setMissingDoctorSideError] = useState("");
  const [missingDoctorSideRoomIds, setMissingDoctorSideRoomIds] = useState<
    string[]
  >([]);
  const screenTitle = draftFloorTemplate?.name ?? "Doctor sides";
  const doctorSides = draftFloorTemplate?.doctorSides ?? [];
  const visibleDoctorSides = createTwoDoctorSides(doctorSides);
  const sideOneName = doctorSides[0]?.name ?? "";
  const sideTwoName = doctorSides[1]?.name ?? "";
  const rooms = draftFloorTemplate?.rooms ?? [];
  const sideOneRoomCount = rooms.filter(
    (room) => room.doctorSideId === visibleDoctorSides[0]?.id,
  ).length;
  const sideTwoRoomCount = rooms.filter(
    (room) => room.doctorSideId === visibleDoctorSides[1]?.id,
  ).length;

  useEffect(() => {
    if (!draftFloorTemplate) {
      router.replace("/floor-details");
    }
  }, [draftFloorTemplate]);

  useEffect(() => {
    if (!draftFloorTemplate || doctorSides.length === 2) {
      return;
    }

    setDraftFloorTemplate((currentDraft) => {
      if (!currentDraft || currentDraft.doctorSides.length === 2) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        doctorSides: createTwoDoctorSides(currentDraft.doctorSides),
      };
    });
  }, [
    doctorSides.length,
    draftFloorTemplate,
    setDraftFloorTemplate,
  ]);

  if (!draftFloorTemplate) {
    return null;
  }

  function handleSideNameChange(sideIndex: number, name: string) {
    const nextSideOneName = sideIndex === 0 ? name : sideOneName;
    const nextSideTwoName = sideIndex === 1 ? name : sideTwoName;

    setSideNameErrors(
      validateDoctorSideNames(nextSideOneName, nextSideTwoName, false),
    );

    setDraftFloorTemplate((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextDoctorSides = createTwoDoctorSides(currentDraft.doctorSides).map(
        (doctorSide, currentIndex) =>
          currentIndex === sideIndex ? { ...doctorSide, name } : doctorSide,
      );

      return {
        ...currentDraft,
        doctorSides: nextDoctorSides,
      };
    });
  }

  function handleAssignRoomToSide(roomId: string, doctorSideId: string) {
    const roomsAfterSideSelection = rooms.map((room) =>
      room.id === roomId ? { ...room, doctorSideId } : room,
    );
    const roomIdsStillMissingDoctorSide = getRoomIdsMissingDoctorSide(
      roomsAfterSideSelection,
      doctorSides,
    );

    if (missingDoctorSideError) {
      setMissingDoctorSideRoomIds(roomIdsStillMissingDoctorSide);
      setMissingDoctorSideError(
        roomIdsStillMissingDoctorSide.length ? missingDoctorSideMessage : "",
      );
    }

    setDraftFloorTemplate((currentDraft) => {
      const doctorSideExists = currentDraft?.doctorSides.some(
        (doctorSide) => doctorSide.id === doctorSideId,
      );

      if (!currentDraft || !doctorSideExists) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        rooms: currentDraft.rooms.map((room) =>
          room.id === roomId ? { ...room, doctorSideId } : room,
        ),
      };
    });
  }

  function handleReview() {
    const trimmedSideOneName = sideOneName.trim();
    const trimmedSideTwoName = sideTwoName.trim();
    const nextSideNameErrors = validateDoctorSideNames(
      sideOneName,
      sideTwoName,
      true,
    );
    const roomIdsMissingDoctorSide = getRoomIdsMissingDoctorSide(
      rooms,
      doctorSides,
    );

    if (nextSideNameErrors.some(Boolean) || roomIdsMissingDoctorSide.length) {
      setSideNameErrors(nextSideNameErrors);
      setMissingDoctorSideRoomIds(roomIdsMissingDoctorSide);
      setMissingDoctorSideError(
        roomIdsMissingDoctorSide.length ? missingDoctorSideMessage : "",
      );
      return;
    }

    setDraftFloorTemplate((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextDoctorSides = createTwoDoctorSides(currentDraft.doctorSides).map(
        (doctorSide, sideIndex) => ({
          ...doctorSide,
          name: sideIndex === 0 ? trimmedSideOneName : trimmedSideTwoName,
        }),
      );

      return {
        ...currentDraft,
        doctorSides: nextDoctorSides,
      };
    });

    setSideNameErrors(["", ""]);
    setMissingDoctorSideError("");
    setMissingDoctorSideRoomIds([]);
    router.push("/template-review");
  }

  function renderAssignmentPreviewItem({ item }: { item: Room }) {
    return (
      <AssignmentPreviewRow
        doctorSides={visibleDoctorSides}
        hasMissingDoctorSide={missingDoctorSideRoomIds.includes(item.id)}
        onAssignRoomToSide={handleAssignRoomToSide}
        room={item}
      />
    );
  }

  return (
    <WorkflowListScreen
      activeStep="Sides"
      actionErrorText={missingDoctorSideError}
      data={rooms}
      headerActionLabel="Floors"
      keyExtractor={getRoomKey}
      listHeader={
        <DoctorSidesListHeader
          onSideNameChange={handleSideNameChange}
          sideOneRoomCount={sideOneRoomCount}
          sideOneName={sideOneName}
          sideOneNameError={sideNameErrors[0]}
          sideTwoRoomCount={sideTwoRoomCount}
          sideTwoName={sideTwoName}
          sideTwoNameError={sideNameErrors[1]}
        />
      }
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={handleReview}
      primaryLabel="Review"
      renderItem={renderAssignmentPreviewItem}
      subtitle="Step 3 of 4"
      title={screenTitle}
    />
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  assignmentHeader: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral.borderTertiary,
    marginVertical: spacing.xs,
  },
  assignmentTitleGroup: {
    gap: spacing.xs,
  },
  assignmentTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  assignmentRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  missingDoctorSideRow: {
    borderColor: colors.status.red700,
    backgroundColor: colors.status.red50,
    borderWidth: 1.5,
  },
  roomLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  roomMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
