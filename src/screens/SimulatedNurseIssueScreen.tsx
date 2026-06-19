import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  BedChip,
  SummaryChip,
  WorkflowScreen,
  WorkflowSection,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import { colors, fontWeight, radius, shadows, spacing, textSize } from "../theme/tokens";
import type { LocalId, NurseRequest } from "../types/models";
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

const blankIssueMessage = "Add a short issue description.";
const invalidBedMessage = "Choose one of your assigned beds.";

type IssueBedOption = {
  bedId?: LocalId;
  detail: string;
  label: string;
};

type IssueFormContentProps = {
  message: string;
  messageError: string;
  onMessageChange: (message: string) => void;
  onSelectBed: (bedId?: LocalId) => void;
  selectedBedId?: LocalId;
  view: NurseAssignmentView;
};

type IssueBedOptionRowProps = {
  isSelected: boolean;
  onSelect: () => void;
  option: IssueBedOption;
};

function getBedOptionLabel(assignedBed: NurseAssignedBedView) {
  return `Bed ${assignedBed.bed.label}`;
}

function getBedOptionDetail(assignedBed: NurseAssignedBedView) {
  const patientInitials = assignedBed.bedState?.patient?.initials.trim();
  const patientText = patientInitials ? ` - ${patientInitials}` : "";

  return `Room ${assignedBed.room.label}${patientText}`;
}

function getIssueBedOptions(view: NurseAssignmentView): IssueBedOption[] {
  return [
    {
      detail: "Use this when the issue is not tied to one bed.",
      label: "No bed context",
    },
    ...view.assignedBeds.map((assignedBed) => ({
      bedId: assignedBed.bed.id,
      detail: getBedOptionDetail(assignedBed),
      label: getBedOptionLabel(assignedBed),
    })),
  ];
}

function IssueBedOptionRow({
  isSelected,
  onSelect,
  option,
}: IssueBedOptionRowProps) {
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
      {option.bedId ? <BedChip label={option.label.replace("Bed ", "")} /> : null}
    </Pressable>
  );
}

function IssueFormContent({
  message,
  messageError,
  onMessageChange,
  onSelectBed,
  selectedBedId,
  view,
}: IssueFormContentProps) {
  const bedOptions = getIssueBedOptions(view);

  return (
    <View style={styles.content}>
      <WorkflowSection title="Local issue">
        <View style={styles.summaryCard}>
          <View style={styles.chipRow}>
            <SummaryChip label={view.nurse.name} />
            <SummaryChip label="Mock issue" />
            <SummaryChip label="Local only" />
          </View>
          <Text style={styles.summaryText}>
            This saves a local note for the charge nurse review later. It does
            not send a notification or contact another device.
          </Text>
        </View>
      </WorkflowSection>

      <WorkflowSection title="Issue message">
        <View style={styles.field}>
          <Text style={styles.label}>What should charge know?</Text>
          <TextInput
            multiline
            onChangeText={onMessageChange}
            placeholder="Patient needs reassessment before next round."
            placeholderTextColor={colors.neutral.textTertiary}
            style={[
              styles.messageInput,
              messageError ? styles.messageInputError : null,
            ]}
            textAlignVertical="top"
            value={message}
          />
          {messageError ? (
            <Text accessibilityRole="alert" style={styles.fieldError}>
              {messageError}
            </Text>
          ) : (
            <Text style={styles.fieldHelper}>
              Keep it short. This is stored only on the active shift.
            </Text>
          )}
        </View>
      </WorkflowSection>

      <WorkflowSection title="Bed context">
        <View style={styles.bedOptions}>
          {bedOptions.map((option) => (
            <IssueBedOptionRow
              key={option.bedId ?? "no-bed-context"}
              isSelected={option.bedId === selectedBedId}
              onSelect={() => onSelectBed(option.bedId)}
              option={option}
            />
          ))}
        </View>
      </WorkflowSection>
    </View>
  );
}

export default function SimulatedNurseIssueScreen() {
  const { localState, simulatedSessionState } = useLocalState();
  const { saveActiveShift, saveStatus } = useServerWorkspace();
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState("");
  const [formError, setFormError] = useState("");
  const [selectedBedId, setSelectedBedId] = useState<LocalId | undefined>();
  const assignmentResult = getSelectedNurseAssignmentView(
    localState.activeShift,
    simulatedSessionState.selectedNurseId,
  );
  const readyView =
    assignmentResult.status === "ready" ? assignmentResult.view : undefined;
  const recoveryResult =
    assignmentResult.status === "ready" ? undefined : assignmentResult;

  function handleMessageChange(nextMessage: string) {
    setMessage(nextMessage);
    setMessageError("");
    setFormError("");
  }

  function handleSelectBed(bedId?: LocalId) {
    setSelectedBedId(bedId);
    setFormError("");
  }

  async function handleSubmitIssue() {
    if (!readyView) {
      setFormError(recoveryResult?.message ?? "Choose a nurse before submitting.");
      return;
    }

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setMessageError(blankIssueMessage);
      return;
    }

    const assignedBedIds = readyView.assignedBeds.map(
      (assignedBed) => assignedBed.bed.id,
    );

    if (selectedBedId && !assignedBedIds.includes(selectedBedId)) {
      setFormError(invalidBedMessage);
      return;
    }

    if (!localState.activeShift) {
      setFormError("Start a shift before submitting an issue.");
      return;
    }

    const issueRequest: NurseRequest = {
      id: createNurseRequestId(localState.activeShift),
      createdAt: new Date().toISOString(),
      message: trimmedMessage,
      requestingNurseId: readyView.nurse.id,
      requestingNurseName: readyView.nurse.name,
      sourceBedId: selectedBedId,
      status: "pending",
      type: "issue",
    };
    const nextShift = {
      ...localState.activeShift,
      nurseRequests: [
        ...getShiftNurseRequests(localState.activeShift),
        issueRequest,
      ],
    };

    try {
      setFormError("");
      await saveActiveShift(nextShift);
    } catch (error) {
      const saveMessage =
        error instanceof Error
          ? error.message
          : "Issue could not be saved. Try again.";

      setFormError(saveMessage);
      return;
    }

    router.push("/simulated-nurse-assignment");
  }

  return (
    <WorkflowScreen
      activeStep="Board"
      actionErrorText={formError}
      actionStatusText={saveStatus === "saved" ? "Saved to account." : ""}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={handleSubmitIssue}
      primaryDisabled={saveStatus === "saving"}
      primaryLabel={saveStatus === "saving" ? "Saving..." : "Submit issue"}
      subtitle=""
      title={readyView ? `Issue for ${readyView.nurse.name}` : "Flag issue"}
    >
      {readyView ? (
        <IssueFormContent
          message={message}
          messageError={messageError}
          onMessageChange={handleMessageChange}
          onSelectBed={handleSelectBed}
          selectedBedId={selectedBedId}
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
  messageInput: {
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
  messageInputError: {
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
