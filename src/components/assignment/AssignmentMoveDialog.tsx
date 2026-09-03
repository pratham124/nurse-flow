import { useShallow } from "zustand/react/shallow";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { createLocalId } from "../../helpers/localId";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useServerWorkspace } from "../../store/ServerWorkspaceContext";
import { colors, fontWeight, radius, shadows, spacing, textSize } from "../../theme/tokens";
import type {
  AssignmentResult,
  Flag,
  Nurse,
  Shift,
} from "../../types/models";
import {
  getAssignmentMovePreview,
  type AssignmentMovePreview,
} from "../../utils/assignmentMovePreview";
import {
  accessibilityFocusProps,
  focusAccessibilityElement,
} from "../../utils/accessibilityFocus";

export type AssignmentMoveDialogProps = {
  activeShift: Shift;
  bedId?: string;
  effectiveAssignmentResult: AssignmentResult;
  onClose: () => void;
  relatedSwapRequestId?: string;
  visible: boolean;
};

type NurseChoiceProps = {
  activeShift: Shift;
  bedId: string;
  currentNurseName: string;
  effectiveAssignmentResult: AssignmentResult;
  nurse: Nurse;
  onSelect: (nurseId: string) => void;
  selected: boolean;
};

type WarningAcknowledgementProps = {
  acknowledged: boolean;
  onToggle: () => void;
  warning: Flag;
};

function getNurseName(activeShift: Shift, nurseId?: string) {
  return activeShift.nurses.find((nurse) => nurse.id === nurseId)?.name ?? "Unknown nurse";
}

function WarningAcknowledgement({
  acknowledged,
  onToggle,
  warning,
}: WarningAcknowledgementProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: acknowledged }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.warningRow,
        acknowledged ? styles.warningRowSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.checkbox, acknowledged ? styles.checkboxSelected : null]}>
        <Text style={styles.checkboxMark}>{acknowledged ? "✓" : ""}</Text>
      </View>
      <Text style={styles.warningText}>{warning.message}</Text>
    </Pressable>
  );
}

function NurseChoice({
  activeShift,
  bedId,
  currentNurseName,
  effectiveAssignmentResult,
  nurse,
  onSelect,
  selected,
}: NurseChoiceProps) {
  const preview = getAssignmentMovePreview(
    activeShift,
    effectiveAssignmentResult,
    bedId,
    nurse.id,
  );
  const disabledReason = preview.blockingReasons.map((reason) => reason.message).join(" ");
  const disabled = preview.blockingReasons.length > 0;
  const accessibilityLabel = disabled
    ? `${nurse.name}, unavailable. ${disabledReason}`
    : `${nurse.name}, eligible target. Current nurse is ${currentNurseName}.`;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={() => onSelect(nurse.id)}
      style={({ pressed }) => [
        styles.nurseChoice,
        disabled ? styles.nurseChoiceDisabled : null,
        selected ? styles.nurseChoiceSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.nurseChoiceTopRow}>
        <Text style={styles.nurseChoiceName}>{nurse.name}</Text>
        <Text style={styles.nurseChoiceMeta}>
          {nurse.licenseType} · max {nurse.maxPatientLoad}
        </Text>
      </View>
      <Text style={disabled ? styles.disabledReason : styles.eligibleReason}>
        {disabled ? disabledReason : "Eligible for this room and acuity"}
      </Text>
    </Pressable>
  );
}

export function AssignmentMoveDialog({
  activeShift,
  bedId,
  effectiveAssignmentResult,
  onClose,
  relatedSwapRequestId,
  visible,
}: AssignmentMoveDialogProps) {
  const isReducedMotionEnabled = useReducedMotion();
  const {
    confirmManualAssignmentOverride,
    realtimeConnectionState,
  } = useServerWorkspace(
    useShallow((state) => ({
      confirmManualAssignmentOverride: state.confirmManualAssignmentOverride,
      realtimeConnectionState: state.realtimeConnectionState,
    })),
  );
  const [selectedNurseId, setSelectedNurseId] = useState<string>();
  const [acknowledgedWarningIds, setAcknowledgedWarningIds] = useState<Set<string>>(
    new Set(),
  );
  const [feedback, setFeedback] = useState("");
  const [openedBaselineAssignmentResultId, setOpenedBaselineAssignmentResultId] =
    useState<string>();
  const [resultState, setResultState] = useState<
    "editing" | "saving" | "saved" | "stale" | "error"
  >("editing");
  const titleRef = useRef<Text>(null);

  const currentAssignment = effectiveAssignmentResult.bedAssignments.find(
    (assignment) => assignment.bedId === bedId,
  );
  const currentNurseName = getNurseName(activeShift, currentAssignment?.nurseId);
  const bedLabel = activeShift.beds.find((bed) => bed.id === bedId)?.label ?? "bed";
  const preview = useMemo<AssignmentMovePreview | undefined>(() => {
    if (!bedId || !selectedNurseId) {
      return undefined;
    }

    return getAssignmentMovePreview(
      activeShift,
      effectiveAssignmentResult,
      bedId,
      selectedNurseId,
    );
  }, [activeShift, bedId, effectiveAssignmentResult, selectedNurseId]);
  const allWarningsAcknowledged =
    preview?.warnings.every((warning) => acknowledgedWarningIds.has(warning.id)) ?? false;
  const isSavingMove = resultState === "saving";
  const canConfirm =
    Boolean(preview) &&
    preview?.blockingReasons.length === 0 &&
    allWarningsAcknowledged &&
    openedBaselineAssignmentResultId === effectiveAssignmentResult.id &&
    realtimeConnectionState === "live" &&
    !isSavingMove;

  useEffect(() => {
    if (!visible) {
      setOpenedBaselineAssignmentResultId(undefined);
      setSelectedNurseId(undefined);
      setAcknowledgedWarningIds(new Set());
      setFeedback("");
      setResultState("editing");
      return;
    }

    if (!openedBaselineAssignmentResultId) {
      setOpenedBaselineAssignmentResultId(effectiveAssignmentResult.id);
      return;
    }

    if (openedBaselineAssignmentResultId !== effectiveAssignmentResult.id) {
      setSelectedNurseId(undefined);
      setAcknowledgedWarningIds(new Set());
      setFeedback(
        "The assignment was rerun while this move was open. Close this dialog and review the new board before starting another move.",
      );
      setResultState("stale");
    }
  }, [
    effectiveAssignmentResult.id,
    openedBaselineAssignmentResultId,
    visible,
  ]);

  function handleSelectNurse(nurseId: string) {
    setSelectedNurseId(nurseId);
    setAcknowledgedWarningIds(new Set());
    setFeedback("");
    setResultState("editing");
  }

  function toggleWarning(warningId: string) {
    setAcknowledgedWarningIds((current) => {
      const next = new Set(current);

      if (next.has(warningId)) {
        next.delete(warningId);
      } else {
        next.add(warningId);
      }

      return next;
    });
  }

  async function handleConfirm() {
    if (
      !bedId ||
      !preview?.fromNurseId ||
      !openedBaselineAssignmentResultId ||
      !canConfirm
    ) {
      return;
    }

    try {
      setFeedback("");
      setResultState("saving");
      const result = await confirmManualAssignmentOverride({
        baselineAssignmentResultId: openedBaselineAssignmentResultId,
        bedId,
        clientMutationId: createLocalId("assignment-move"),
        fromNurseId: preview.fromNurseId,
        relatedSwapRequestId,
        shiftId: activeShift.id,
        toNurseId: preview.toNurseId,
        warningAcknowledgements: preview.warnings.map((warning) => ({
          bedId: warning.bedId ?? bedId,
          id: createLocalId("warning-ack"),
          message: warning.message,
          nurseId: warning.nurseId,
          warningType: warning.type as "over_side_load_limit" | "over_max_load" | "team_imbalance",
        })),
      });

      if (result.status === "stale") {
        setResultState("stale");
        setFeedback(result.message ?? "The board changed. Review the refreshed assignment and try again.");
        return;
      }

      setResultState("saved");
      setFeedback(`Bed ${bedLabel} is now assigned to ${getNurseName(activeShift, preview.toNurseId)}.`);
    } catch (error) {
      setResultState("error");
      setFeedback(error instanceof Error ? error.message : "Assignment move could not be saved. Try again.");
    }
  }

  function focusDialogTitle() {
    focusAccessibilityElement(titleRef.current);
  }

  return (
    <Modal
      animationType={isReducedMotionEnabled ? "none" : "slide"}
      onShow={focusDialogTitle}
      onRequestClose={isSavingMove ? undefined : onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <View accessibilityViewIsModal style={styles.screen}>
        <View style={styles.dialogHeader}>
          <View style={styles.headerCopy}>
            <Text
              {...accessibilityFocusProps}
              accessibilityRole="header"
              ref={titleRef}
              style={styles.title}
            >
              Move bed {bedLabel}
            </Text>
            <Text style={styles.subtitle}>Currently assigned to {currentNurseName}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isSavingMove }}
            disabled={isSavingMove}
            onPress={resultState === "saved" ? onClose : onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>{resultState === "saved" ? "Done" : "Cancel"}</Text>
          </Pressable>
        </View>

        {resultState === "saved" ? (
          <View accessibilityLiveRegion="polite" style={styles.successCard}>
            <Text style={styles.successTitle}>Move saved</Text>
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.instructions}>
              {relatedSwapRequestId
                ? "Choose an eligible nurse, review the result, then confirm the move to complete this accepted swap."
                : "Choose an eligible nurse, review the resulting loads and warnings, then confirm the move."}
            </Text>

            <View style={styles.targetList}>
              {bedId
                ? activeShift.nurses.map((nurse) => (
                    <NurseChoice
                      activeShift={activeShift}
                      bedId={bedId}
                      currentNurseName={currentNurseName}
                      effectiveAssignmentResult={effectiveAssignmentResult}
                      key={nurse.id}
                      nurse={nurse}
                      onSelect={handleSelectNurse}
                      selected={selectedNurseId === nurse.id}
                    />
                  ))
                : null}
            </View>

            {preview ? (
              <View style={styles.previewCard}>
                <Text style={styles.sectionTitle}>Review move</Text>
                {preview.resultingLoadSummary.map((load) => (
                  <Text key={load.nurseId} style={styles.loadText}>
                    {getNurseName(activeShift, load.nurseId)}: {load.before} → {load.after} patients
                  </Text>
                ))}

                {preview.blockingReasons.map((reason) => (
                  <Text key={reason.code} style={styles.blockingText}>{reason.message}</Text>
                ))}

                {preview.warnings.length ? (
                  <View style={styles.warningList}>
                    <Text style={styles.warningHeading}>Acknowledge each warning to continue</Text>
                    {preview.warnings.map((warning) => (
                      <WarningAcknowledgement
                        acknowledged={acknowledgedWarningIds.has(warning.id)}
                        key={warning.id}
                        onToggle={() => toggleWarning(warning.id)}
                        warning={warning}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.eligibleReason}>No new assignment warnings.</Text>
                )}

              </View>
            ) : null}

            {realtimeConnectionState !== "live" ? (
              <Text accessibilityLiveRegion="polite" style={styles.blockingText}>
                Reconnect to NurseFlow before saving an assignment move.
              </Text>
            ) : null}

            {feedback ? (
              <Text
                accessibilityLiveRegion={resultState === "error" || resultState === "stale" ? "assertive" : "polite"}
                style={resultState === "error" || resultState === "stale" ? styles.blockingText : styles.feedbackText}
              >
                {feedback}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canConfirm }}
              disabled={!canConfirm}
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                !canConfirm ? styles.confirmButtonDisabled : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.confirmButtonText}>
                {isSavingMove
                  ? "Saving move..."
                  : resultState === "error"
                    ? "Retry move"
                    : resultState === "stale"
                      ? "Review refreshed board"
                      : "Confirm move"}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.neutral.backgroundPrimary, flex: 1 },
  dialogHeader: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderBottomColor: colors.neutral.borderTertiary,
    borderBottomWidth: 0.5,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  headerCopy: { flex: 1, gap: spacing.xs },
  title: { color: colors.neutral.textPrimary, fontSize: textSize.lg, fontWeight: fontWeight.bold },
  subtitle: { color: colors.neutral.textSecondary, fontSize: textSize.sm },
  closeButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  closeButtonText: { color: colors.brand.burgundy, fontSize: textSize.action, fontWeight: fontWeight.bold },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  instructions: { color: colors.neutral.textSecondary, fontSize: textSize.sm, lineHeight: 19 },
  targetList: { gap: spacing.sm },
  nurseChoice: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 64,
    padding: spacing.md,
  },
  nurseChoiceDisabled: { backgroundColor: colors.neutral.backgroundSecondary, opacity: 0.68 },
  nurseChoiceSelected: { borderColor: colors.brand.burgundy, borderWidth: 2 },
  nurseChoiceTopRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  nurseChoiceName: { color: colors.neutral.textPrimary, flex: 1, fontSize: textSize.md, fontWeight: fontWeight.bold },
  nurseChoiceMeta: { color: colors.neutral.textSecondary, fontSize: textSize.sm },
  eligibleReason: { color: colors.status.green800, fontSize: textSize.sm, lineHeight: 18 },
  disabledReason: { color: colors.status.red800, fontSize: textSize.sm, lineHeight: 18 },
  previewCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: { color: colors.neutral.textPrimary, fontSize: textSize.md, fontWeight: fontWeight.bold },
  loadText: { color: colors.neutral.textPrimary, fontSize: textSize.sm, lineHeight: 18 },
  blockingText: { color: colors.status.red800, fontSize: textSize.sm, lineHeight: 19 },
  warningList: { gap: spacing.sm },
  warningHeading: { color: colors.status.amber800, fontSize: textSize.sm, fontWeight: fontWeight.bold },
  warningRow: {
    alignItems: "flex-start",
    backgroundColor: colors.status.amber50,
    borderColor: colors.status.amber800,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44,
    padding: spacing.sm,
  },
  warningRowSelected: { borderWidth: 1.5 },
  checkbox: { alignItems: "center", borderColor: colors.status.amber800, borderRadius: radius.micro, borderWidth: 1, height: 22, justifyContent: "center", width: 22 },
  checkboxSelected: { backgroundColor: colors.status.amber800 },
  checkboxMark: { color: colors.neutral.surface, fontSize: textSize.sm, fontWeight: fontWeight.bold },
  warningText: { color: colors.status.amber800, flex: 1, fontSize: textSize.sm, lineHeight: 18 },
  feedbackText: { color: colors.neutral.textSecondary, fontSize: textSize.sm, lineHeight: 19 },
  confirmButton: { alignItems: "center", backgroundColor: colors.brand.burgundy, borderRadius: radius.md, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.lg },
  confirmButtonDisabled: { opacity: 0.42 },
  confirmButtonText: { color: colors.neutral.surface, fontSize: textSize.action, fontWeight: fontWeight.bold },
  successCard: { backgroundColor: colors.status.green50, borderColor: colors.status.greenBorder, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, margin: spacing.lg, padding: spacing.xl },
  successTitle: { color: colors.status.green800, fontSize: textSize.lg, fontWeight: fontWeight.bold },
  pressed: { opacity: 0.78 },
});
