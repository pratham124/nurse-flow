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
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize } from "../theme/tokens";
import type { DoctorSide, Room } from "../types/models";

const requiredDoctorSideNameMessage = "Doctor side name is required.";
const duplicateDoctorSideNameMessage = "Doctor side names must be different.";

type AssignmentPreviewRowProps = {
  doctorSides: DoctorSide[];
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
      <WorkflowSection
        note="Phase 1 uses exactly two doctor sides."
        title="Side names"
      >
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

      <View style={styles.assignmentHeader}>
        <View style={styles.assignmentTitleGroup}>
          <Text style={styles.assignmentTitle}>Room assignments</Text>
          <Text style={styles.assignmentNote}>
            Pick one doctor side for each room. Counts update from the room list.
          </Text>
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
    <View style={styles.assignmentRow}>
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

export default function DoctorSidesScreen() {
  const { localState, setLocalState } = useLocalState();
  const [sideNameErrors, setSideNameErrors] = useState(["", ""]);
  const screenTitle = localState.draftFloorTemplate?.name ?? "Doctor sides";
  const doctorSides = localState.draftFloorTemplate?.doctorSides ?? [];
  const visibleDoctorSides = createTwoDoctorSides(doctorSides);
  const sideOneName = doctorSides[0]?.name ?? "";
  const sideTwoName = doctorSides[1]?.name ?? "";
  const rooms = localState.draftFloorTemplate?.rooms ?? [];
  const sideOneRoomCount = rooms.filter(
    (room) => room.doctorSideId === visibleDoctorSides[0]?.id,
  ).length;
  const sideTwoRoomCount = rooms.filter(
    (room) => room.doctorSideId === visibleDoctorSides[1]?.id,
  ).length;

  useEffect(() => {
    if (!localState.draftFloorTemplate || doctorSides.length === 2) {
      return;
    }

    setLocalState((currentState) => {
      const currentDraft = currentState.draftFloorTemplate;

      if (!currentDraft || currentDraft.doctorSides.length === 2) {
        return currentState;
      }

      return {
        ...currentState,
        draftFloorTemplate: {
          ...currentDraft,
          doctorSides: createTwoDoctorSides(currentDraft.doctorSides),
        },
      };
    });
  }, [
    doctorSides.length,
    localState.draftFloorTemplate,
    setLocalState,
  ]);

  function handleSideNameChange(sideIndex: number, name: string) {
    const nextSideOneName = sideIndex === 0 ? name : sideOneName;
    const nextSideTwoName = sideIndex === 1 ? name : sideTwoName;

    setSideNameErrors(
      validateDoctorSideNames(nextSideOneName, nextSideTwoName, false),
    );

    setLocalState((currentState) => {
      const currentDraft = currentState.draftFloorTemplate;

      if (!currentDraft) {
        return currentState;
      }

      const nextDoctorSides = createTwoDoctorSides(currentDraft.doctorSides).map(
        (doctorSide, currentIndex) =>
          currentIndex === sideIndex ? { ...doctorSide, name } : doctorSide,
      );

      return {
        ...currentState,
        draftFloorTemplate: {
          ...currentDraft,
          doctorSides: nextDoctorSides,
        },
      };
    });
  }

  function handleAssignRoomToSide(roomId: string, doctorSideId: string) {
    setLocalState((currentState) => {
      const currentDraft = currentState.draftFloorTemplate;
      const doctorSideExists = currentDraft?.doctorSides.some(
        (doctorSide) => doctorSide.id === doctorSideId,
      );

      if (!currentDraft || !doctorSideExists) {
        return currentState;
      }

      return {
        ...currentState,
        draftFloorTemplate: {
          ...currentDraft,
          rooms: currentDraft.rooms.map((room) =>
            room.id === roomId ? { ...room, doctorSideId } : room,
          ),
        },
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

    if (nextSideNameErrors.some(Boolean)) {
      setSideNameErrors(nextSideNameErrors);
      return;
    }

    setLocalState((currentState) => {
      const currentDraft = currentState.draftFloorTemplate;

      if (!currentDraft) {
        return currentState;
      }

      const nextDoctorSides = createTwoDoctorSides(currentDraft.doctorSides).map(
        (doctorSide, sideIndex) => ({
          ...doctorSide,
          name: sideIndex === 0 ? trimmedSideOneName : trimmedSideTwoName,
        }),
      );

      return {
        ...currentState,
        draftFloorTemplate: {
          ...currentDraft,
          doctorSides: nextDoctorSides,
        },
      };
    });

    setSideNameErrors(["", ""]);
    router.push("/template-review");
  }

  function renderAssignmentPreviewItem({ item }: { item: Room }) {
    return (
      <AssignmentPreviewRow
        doctorSides={visibleDoctorSides}
        onAssignRoomToSide={handleAssignRoomToSide}
        room={item}
      />
    );
  }

  return (
    <WorkflowListScreen
      activeStep="Sides"
      data={rooms}
      headerActionLabel="Floors"
      helperText="Side names and room assignments are saved locally in the draft template."
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
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  assignmentTitleGroup: {
    gap: spacing.xs,
  },
  assignmentTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "500",
  },
  assignmentNote: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  assignmentRow: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
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
