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
import type { DoctorSide } from "../types/models";

const previewAssignments = [
  { room: "101", selectedIndex: 0 },
  { room: "102", selectedIndex: 1 },
];
const requiredDoctorSideNameMessage = "Doctor side name is required.";
const duplicateDoctorSideNameMessage = "Doctor side names must be different.";

type PreviewAssignment = (typeof previewAssignments)[number];

type AssignmentPreviewRowProps = {
  assignment: PreviewAssignment;
  doctorSideNames: string[];
};

type DoctorSidesListHeaderProps = {
  sideOneName: string;
  sideOneNameError: string;
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
  sideOneName,
  sideOneNameError,
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
            Every room will eventually belong to exactly one side.
          </Text>
        </View>

        <SummaryTileGrid>
          <SummaryTile value={sideOneName || "Side 1"} label="1 room" />
          <SummaryTile value={sideTwoName || "Side 2"} label="1 room" />
        </SummaryTileGrid>
      </View>
    </View>
  );
}

function AssignmentPreviewRow({
  assignment,
  doctorSideNames,
}: AssignmentPreviewRowProps) {
  return (
    <View style={styles.assignmentRow}>
      <View>
        <Text style={styles.roomLabel}>Room {assignment.room}</Text>
        <Text style={styles.roomMeta}>Choose one doctor side</Text>
      </View>
      <SegmentedPlaceholder
        options={doctorSideNames}
        selectedIndex={assignment.selectedIndex}
      />
    </View>
  );
}

function getPreviewAssignmentKey(assignment: PreviewAssignment) {
  return assignment.room;
}

export default function DoctorSidesScreen() {
  const { localState, setLocalState } = useLocalState();
  const [sideNameErrors, setSideNameErrors] = useState(["", ""]);
  const screenTitle = localState.draftFloorTemplate?.name ?? "Doctor sides";
  const doctorSides = localState.draftFloorTemplate?.doctorSides ?? [];
  const sideOneName = doctorSides[0]?.name ?? "";
  const sideTwoName = doctorSides[1]?.name ?? "";
  const doctorSideNames = [sideOneName || "Side 1", sideTwoName || "Side 2"];

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

  function renderAssignmentPreviewItem({ item }: { item: PreviewAssignment }) {
    return (
      <AssignmentPreviewRow
        assignment={item}
        doctorSideNames={doctorSideNames}
      />
    );
  }

  return (
    <WorkflowListScreen
      activeStep="Sides"
      data={previewAssignments}
      headerActionLabel="Floors"
      helperText="Side names are saved locally. Room choices are a later task."
      keyExtractor={getPreviewAssignmentKey}
      listHeader={
        <DoctorSidesListHeader
          onSideNameChange={handleSideNameChange}
          sideOneName={sideOneName}
          sideOneNameError={sideNameErrors[0]}
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
