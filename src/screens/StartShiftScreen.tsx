import { useState } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  NumberStepperPlaceholder,
  SegmentedPlaceholder,
  SummaryTile,
  SummaryTileGrid,
  WorkflowSection,
  WorkflowScreen,
} from "../components/workflow";
import { AssignedShiftEditGuard } from "../components/assignment/AssignedShiftEditGuard";
import { useActiveShiftDraft } from "../hooks/useActiveShiftDraft";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import { shiftSetupFlow } from "../utils/workflowFlows";
import { colors, radius, spacing, textSize, fontWeight, shadows } from "../theme/tokens";
import type { LoadLimitRange } from "../types/models";

type LoadLimitKind = "admitting" | "nonAdmitting";

type LoadLimitField = "min" | "max";

const phaseOneMaxLoadLimit = 12;
const minimumLoadLimitMessage = "Load limit must be at least 1.";
const maximumLoadLimitMessage = `Load limit cannot be higher than ${phaseOneMaxLoadLimit}.`;
const invalidLoadLimitRangeMessage =
  "Minimum load cannot be higher than maximum load.";

function getCountLabel(count: number, singularLabel: string, pluralLabel: string) {
  return count === 1 ? singularLabel : pluralLabel;
}

type LoadLimitRangeControlProps = {
  loadLimitRange?: LoadLimitRange;
  onChange?: (field: LoadLimitField, value: number) => void;
};

function LoadLimitRangeControl({
  loadLimitRange,
  onChange,
}: LoadLimitRangeControlProps) {
  return (
    <View style={styles.rangeControls}>
      <View style={styles.rangeControlGroup}>
        <Text style={styles.rangeLabel}>Min</Text>
        <NumberStepperPlaceholder
          decrementLabel="Decrease minimum load"
          incrementLabel="Increase minimum load"
          onDecrement={
            loadLimitRange && onChange
              ? () => onChange("min", loadLimitRange.min - 1)
              : undefined
          }
          onIncrement={
            loadLimitRange && onChange
              ? () => onChange("min", loadLimitRange.min + 1)
              : undefined
          }
          value={loadLimitRange ? loadLimitRange.min.toString() : "--"}
        />
      </View>
      <View style={styles.rangeControlGroup}>
        <Text style={styles.rangeLabel}>Max</Text>
        <NumberStepperPlaceholder
          decrementLabel="Decrease maximum load"
          incrementLabel="Increase maximum load"
          onDecrement={
            loadLimitRange && onChange
              ? () => onChange("max", loadLimitRange.max - 1)
              : undefined
          }
          onIncrement={
            loadLimitRange && onChange
              ? () => onChange("max", loadLimitRange.max + 1)
              : undefined
          }
          value={loadLimitRange ? loadLimitRange.max.toString() : "--"}
        />
      </View>
    </View>
  );
}

export default function StartShiftScreen() {
  const {
    activeShift: serverActiveShift,
    saveActiveShift,
    saveStatus,
  } = useServerWorkspace();
  const { draftShift: activeShift, setDraftShift } =
    useActiveShiftDraft(serverActiveShift);
  const doctorSideOptions =
    activeShift?.doctorSides.map((doctorSide) => doctorSide.name) ?? [];
  const selectedAdmittingSideIndex = activeShift
    ? activeShift.doctorSides.findIndex(
        (doctorSide) => doctorSide.id === activeShift.admittingDoctorSideId,
      )
    : -1;
  const hasAdmittingSide = selectedAdmittingSideIndex >= 0;
  const [admittingSideError, setAdmittingSideError] = useState("");
  const [loadLimitError, setLoadLimitError] = useState("");
  const [serverSaveError, setServerSaveError] = useState("");
  const canContinue = Boolean(activeShift);
  const isSavingShift = saveStatus === "saving";

  function handleSelectAdmittingSide(index: number) {
    const selectedDoctorSide = activeShift?.doctorSides[index];

    if (!activeShift || !selectedDoctorSide) {
      return;
    }

    setAdmittingSideError("");
    setServerSaveError("");
    setDraftShift({
      ...activeShift,
      admittingDoctorSideId: selectedDoctorSide.id,
    });
  }

  function handleLoadLimitChange(
    loadLimitKind: LoadLimitKind,
    field: LoadLimitField,
    value: number,
  ) {
    const currentRange = activeShift?.sideLoadLimits[loadLimitKind];

    if (!activeShift || !currentRange) {
      return;
    }

    if (value < 1) {
      setLoadLimitError(minimumLoadLimitMessage);
      return;
    }

    if (value > phaseOneMaxLoadLimit) {
      setLoadLimitError(maximumLoadLimitMessage);
      return;
    }

    const nextRange = {
      ...currentRange,
      [field]: value,
    };

    if (nextRange.min > nextRange.max) {
      setLoadLimitError(invalidLoadLimitRangeMessage);
      return;
    }

    setLoadLimitError("");
    setServerSaveError("");

    setDraftShift({
      ...activeShift,
      sideLoadLimits: {
        ...activeShift.sideLoadLimits,
        [loadLimitKind]: nextRange,
      },
    });
  }

  async function handleContinue() {
    if (!activeShift) {
      router.push("/");
      return;
    }

    if (!hasAdmittingSide) {
      setAdmittingSideError("Choose the admitting side for this shift.");
      return;
    }

    if (loadLimitError) {
      return;
    }

    try {
      setServerSaveError("");
      await saveActiveShift(activeShift);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Shift setup could not be saved. Try again.";

      setServerSaveError(message);
      return;
    }

    router.push("/nurses");
  }

  return (
    <>
      <WorkflowScreen
        activeStep="Shift"
        actionErrorText={
          serverSaveError ||
          admittingSideError ||
          loadLimitError ||
          (canContinue
            ? ""
            : "Create a floor template before starting a shift.")
        }
        flow={shiftSetupFlow}
        headerActionLabel="Floors"
        onHeaderActionPress={() => router.push("/")}
        onPrimaryPress={handleContinue}
        primaryDisabled={isSavingShift}
        primaryLabel={
          isSavingShift
            ? "Saving..."
            : serverSaveError
              ? "Retry save"
              : canContinue
                ? "Continue"
                : "Back to floors"
        }
        subtitle="Step 1 of 3"
        title={activeShift?.floorName ?? "Start shift"}
      >
        <WorkflowSection title="Template summary">
          <SummaryTileGrid>
            <SummaryTile
              value={(activeShift?.doctorSides.length ?? 0).toString()}
              label={getCountLabel(
                activeShift?.doctorSides.length ?? 0,
                "Doctor side",
                "Doctor sides",
              )}
            />
            <SummaryTile
              value={(activeShift?.rooms.length ?? 0).toString()}
              label={getCountLabel(
                activeShift?.rooms.length ?? 0,
                "Room",
                "Rooms",
              )}
            />
            <SummaryTile
              value={(activeShift?.bedStates.length ?? 0).toString()}
              label={getCountLabel(
                activeShift?.bedStates.length ?? 0,
                "Bed",
                "Beds",
              )}
            />
          </SummaryTileGrid>
        </WorkflowSection>

        <WorkflowSection title="Admitting side">
          <SegmentedPlaceholder
            onSelect={activeShift ? handleSelectAdmittingSide : undefined}
            options={
              doctorSideOptions.length
                ? doctorSideOptions
                : ["Side 1", "Side 2"]
            }
            selectedIndex={hasAdmittingSide ? selectedAdmittingSideIndex : null}
          />
        </WorkflowSection>

        <WorkflowSection title="Side-based load limits">
          <View style={styles.limitRow}>
            <View style={styles.limitText}>
              <Text style={styles.limitTitle}>Admitting-side coverage</Text>
              <Text style={styles.limitMeta}>
                Default target around 4-5 patients
              </Text>
            </View>
            <LoadLimitRangeControl
              loadLimitRange={activeShift?.sideLoadLimits.admitting}
              onChange={(field, value) =>
                handleLoadLimitChange("admitting", field, value)
              }
            />
          </View>

          <View style={styles.limitRow}>
            <View style={styles.limitText}>
              <Text style={styles.limitTitle}>Non-admitting only</Text>
              <Text style={styles.limitMeta}>
                Default target around 6-7 patients
              </Text>
            </View>
            <LoadLimitRangeControl
              loadLimitRange={activeShift?.sideLoadLimits.nonAdmitting}
              onChange={(field, value) =>
                handleLoadLimitChange("nonAdmitting", field, value)
              }
            />
          </View>
        </WorkflowSection>
      </WorkflowScreen>
      <AssignedShiftEditGuard activeShift={serverActiveShift} />
    </>
  );
}

const styles = StyleSheet.create({
  limitRow: {
    alignItems: "stretch",
    flexDirection: "column",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.neutral.borderTertiary,
  },
  limitText: {
    gap: spacing.xs,
  },
  limitTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  limitMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  rangeControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  rangeControlGroup: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    flex: 1,
    gap: spacing.xs,
    minWidth: 132,
    padding: spacing.sm,
    ...shadows.sm,
  },
  rangeLabel: {
    color: colors.neutral.textSecondary,
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
});
