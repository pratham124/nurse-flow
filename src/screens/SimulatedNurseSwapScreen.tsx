import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  BedChip,
  SummaryChip,
  WorkflowScreen,
  WorkflowSection,
} from "../components/workflow";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import { useWorkflowDraft } from "../store/WorkflowDraftContext";
import { colors, fontWeight, radius, shadows, spacing, textSize } from "../theme/tokens";
import type { NurseRequest } from "../types/models";
import {
  getSelectedNurseAssignmentView,
  type NurseAssignedBedView,
  type NurseAssignmentView,
} from "../utils/nurseAssignmentView";
import {
  createNurseRequestId,
  getShiftNurseRequests,
} from "../utils/nurseRequests";
import { assignmentFlow } from "../utils/workflowFlows";

const missingSourceBedMessage = "Choose the bed you want to swap.";
const blankReasonMessage = "Add a short reason for the request.";
const invalidSourceBedMessage = "Choose one of your assigned beds.";

type SwapBedOption = {
  bedId: string;
  detail: string;
  label: string;
};

type SwapFormContentProps = {
  onReasonChange: (reason: string) => void;
  onSelectSourceBed: (bedId: string) => void;
  reason: string;
  reasonError: string;
  selectedSourceBedId?: string;
  view: NurseAssignmentView;
};

type SwapBedOptionRowProps = {
  isSelected: boolean;
  onSelect: () => void;
  option: SwapBedOption;
};

function getBedOptionLabel(assignedBed: NurseAssignedBedView) {
  return `Bed ${assignedBed.bed.label}`;
}

function getBedOptionDetail(assignedBed: NurseAssignedBedView) {
  const patientInitials = assignedBed.bedState?.patient?.initials.trim();
  const patientText = patientInitials ? ` - ${patientInitials}` : "";

  return `Room ${assignedBed.room.label}${patientText}`;
}

function getSwapBedOptions(view: NurseAssignmentView): SwapBedOption[] {
  return view.assignedBeds.map((assignedBed) => ({
    bedId: assignedBed.bed.id,
    detail: getBedOptionDetail(assignedBed),
    label: getBedOptionLabel(assignedBed),
  }));
}

function SwapBedOptionRow({
  isSelected,
  onSelect,
  option,
}: SwapBedOptionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.bedOption,
        isSelected ? styles.selectedBedOption : null,
        pressed ? styles.pressedBedOption : null,
      ]}
    >
      <View style={styles.bedOptionTextGroup}>
        <Text style={styles.bedOptionLabel}>{option.label}</Text>
        <Text style={styles.bedOptionDetail}>{option.detail}</Text>
      </View>
      <BedChip label={option.label.replace("Bed ", "")} />
    </Pressable>
  );
}

function SwapFormContent({
  onReasonChange,
  onSelectSourceBed,
  reason,
  reasonError,
  selectedSourceBedId,
  view,
}: SwapFormContentProps) {
  const bedOptions = getSwapBedOptions(view);

  return (
    <View style={styles.content}>
      <WorkflowSection title="Local swap request">
        <View style={styles.summaryCard}>
          <View style={styles.chipRow}>
            <SummaryChip label={view.nurse.name} />
            <SummaryChip label="Mock swap" />
            <SummaryChip label="Local only" />
          </View>
          <Text style={styles.summaryText}>
            This saves a pending local request for charge nurse review later. It
            does not move assignments or contact another device.
          </Text>
        </View>
      </WorkflowSection>

      <WorkflowSection title="Source bed">
        {bedOptions.length ? (
          <View style={styles.bedOptions}>
            {bedOptions.map((option) => (
              <SwapBedOptionRow
                key={option.bedId}
                isSelected={option.bedId === selectedSourceBedId}
                onSelect={() => onSelectSourceBed(option.bedId)}
                option={option}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No assigned beds</Text>
            <Text style={styles.emptyMessage}>
              No assigned beds available for swap requests.
            </Text>
          </View>
        )}
      </WorkflowSection>

      <WorkflowSection title="Reason">
        <View style={styles.field}>
          <Text style={styles.label}>Why are you requesting a swap?</Text>
          <TextInput
            multiline
            onChangeText={onReasonChange}
            placeholder="Acuity balance feels uneven after admission."
            placeholderTextColor={colors.neutral.textTertiary}
            style={[
              styles.reasonInput,
              reasonError ? styles.reasonInputError : null,
            ]}
            textAlignVertical="top"
            value={reason}
          />
          {reasonError ? (
            <Text accessibilityRole="alert" style={styles.fieldError}>
              {reasonError}
            </Text>
          ) : (
            <Text style={styles.fieldHelper}>
              Keep it short. This request stays on the active shift.
            </Text>
          )}
        </View>
      </WorkflowSection>
    </View>
  );
}

export default function SimulatedNurseSwapScreen() {
  const { activeShift, saveActiveShift, saveStatus } = useServerWorkspace();
  const { simulatedSessionState } = useWorkflowDraft();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [formError, setFormError] = useState("");
  const [selectedSourceBedId, setSelectedSourceBedId] = useState<
    string | undefined
  >();
  const assignmentResult = getSelectedNurseAssignmentView(
    activeShift,
    simulatedSessionState.selectedNurseId,
  );
  const readyView =
    assignmentResult.status === "ready" ? assignmentResult.view : undefined;
  const recoveryResult =
    assignmentResult.status === "ready" ? undefined : assignmentResult;

  function handleReasonChange(nextReason: string) {
    setReason(nextReason);
    setReasonError("");
    setFormError("");
  }

  function handleSelectSourceBed(bedId: string) {
    setSelectedSourceBedId(bedId);
    setFormError("");
  }

  async function handleSubmitSwap() {
    if (!readyView) {
      setFormError(recoveryResult?.message ?? "Choose a nurse before submitting.");
      return;
    }

    const assignedBedIds = readyView.assignedBeds.map(
      (assignedBed) => assignedBed.bed.id,
    );

    if (!selectedSourceBedId) {
      setFormError(missingSourceBedMessage);
      return;
    }

    if (!assignedBedIds.includes(selectedSourceBedId)) {
      setFormError(invalidSourceBedMessage);
      return;
    }

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setReasonError(blankReasonMessage);
      return;
    }

    if (!activeShift) {
      setFormError("Start a shift before submitting a swap request.");
      return;
    }

    const swapRequest: NurseRequest = {
      id: createNurseRequestId(activeShift),
      createdAt: new Date().toISOString(),
      message: trimmedReason,
      requestingNurseId: readyView.nurse.id,
      requestingNurseName: readyView.nurse.name,
      sourceBedId: selectedSourceBedId,
      status: "pending",
      type: "swap",
    };
    const nextShift = {
      ...activeShift,
      nurseRequests: [
        ...getShiftNurseRequests(activeShift),
        swapRequest,
      ],
    };

    try {
      setFormError("");
      await saveActiveShift(nextShift);
    } catch (error) {
      const saveMessage =
        error instanceof Error
          ? error.message
          : "Swap request could not be saved. Try again.";

      setFormError(saveMessage);
      return;
    }

    router.push("/floor-board");
  }

  return (
    <WorkflowScreen
      activeStep="Board"
      actionErrorText={formError}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={handleSubmitSwap}
      primaryDisabled={saveStatus === "saving"}
      primaryLabel={saveStatus === "saving" ? "Saving..." : "Submit swap"}
      subtitle=""
      title={readyView ? `Swap for ${readyView.nurse.name}` : "Request swap"}
    >
      {readyView ? (
        <SwapFormContent
          onReasonChange={handleReasonChange}
          onSelectSourceBed={handleSelectSourceBed}
          reason={reason}
          reasonError={reasonError}
          selectedSourceBedId={selectedSourceBedId}
          view={readyView}
        />
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{recoveryResult?.title}</Text>
          <Text style={styles.emptyMessage}>{recoveryResult?.message}</Text>
        </View>
      )}
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.cardGap,
  },
  summaryCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  chipRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.medium,
  },
  reasonInput: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    minHeight: 112,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reasonInputError: {
    borderColor: colors.status.red700,
  },
  fieldHelper: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  fieldError: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  bedOptions: {
    gap: spacing.sm,
  },
  bedOption: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.md,
    ...shadows.sm,
  },
  selectedBedOption: {
    backgroundColor: colors.brand.burgundy10,
    borderColor: colors.brand.burgundy,
    borderWidth: 1,
  },
  pressedBedOption: {
    opacity: 0.82,
  },
  bedOptionTextGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  bedOptionLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  bedOptionDetail: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.lg,
    ...shadows.sm,
  },
  emptyTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  emptyMessage: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
});
