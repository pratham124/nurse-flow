import { useShallow } from "zustand/react/shallow";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { RequestThread } from "../components/requests/RequestThread";
import { AssignmentMoveDialog } from "../components/assignment/AssignmentMoveDialog";
import {
  SummaryChip,
  WorkflowScreen,
  WorkflowSection,
} from "../components/workflow";
import { useRequestThread } from "../hooks/useRequestThread";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { useAuthSession } from "../store/AuthSessionContext";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import {
  colors,
  fontWeight,
  radius,
  shadows,
  spacing,
  textSize,
} from "../theme/tokens";
import type { NurseIssueReviewStatus } from "../types/models";
import { getNurseRequestDisplayById } from "../utils/nurseRequestDisplay";
import { NURSE_REQUEST_LIFECYCLE_STATE } from "../utils/nurseRequestLifecycle";
import { assignmentFlow } from "../utils/workflowFlows";

type DetailRowProps = {
  label: string;
  value: string;
};

function getParamValue(param: string | string[] | undefined) {
  return Array.isArray(param) ? param[0] : param;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function ChargeNurseRequestDetailScreen() {
  const { isExpanded } = useResponsiveLayout();
  const { authState } = useAuthSession();
  const {
    activeAssignmentOverridesByBedId,
    activeShift,
    effectiveAssignmentResult,
    realtimeConnectionState,
    resolveNurseSwapRequest,
    saveStatus,
    updateNurseIssueStatus,
  } = useServerWorkspace(
    useShallow((state) => ({
      activeAssignmentOverridesByBedId: state.activeAssignmentOverridesByBedId,
      activeShift: state.activeShift,
      effectiveAssignmentResult: state.effectiveAssignmentResult,
      realtimeConnectionState: state.realtimeConnectionState,
      resolveNurseSwapRequest: state.resolveNurseSwapRequest,
      saveStatus: state.saveStatus,
      updateNurseIssueStatus: state.updateNurseIssueStatus,
    })),
  );
  const [serverSaveError, setServerSaveError] = useState("");
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const { requestId } = useLocalSearchParams<{
    requestId?: string | string[];
  }>();
  const selectedRequestId = getParamValue(requestId);
  const request = getNurseRequestDisplayById(
    activeShift,
    selectedRequestId,
    activeAssignmentOverridesByBedId,
  );
  const currentProfileId =
    authState.status === "signed_in" ? authState.profile.id : "";
  const thread = useRequestThread({
    enabled: Boolean(
      currentProfileId && activeShift && request && selectedRequestId,
    ),
    requestId: selectedRequestId,
    shiftId: activeShift?.id,
  });
  const showSwapActions =
    Boolean(request) &&
    request?.requestType === "swap" &&
    request.requestStatus === "pending";
  const showIssueActions = Boolean(request) && request?.requestType === "issue";
  const showSwapCompletionAction =
    request?.lifecycleState ===
    NURSE_REQUEST_LIFECYCLE_STATE.SWAP_ACCEPTED_PENDING_CHANGE;
  const wasSwapAssignmentChangedLater =
    request?.lifecycleState ===
    NURSE_REQUEST_LIFECYCLE_STATE.SWAP_COMPLETED_ASSIGNMENT_CHANGED;
  const showSwapCompletionSummary =
    request?.lifecycleState === NURSE_REQUEST_LIFECYCLE_STATE.SWAP_COMPLETED ||
    wasSwapAssignmentChangedLater;
  const canCompleteSwap = Boolean(
    activeShift && effectiveAssignmentResult && request?.sourceBedId,
  );
  const lifecycleWriteDisabled =
    isResolving ||
    saveStatus === "saving" ||
    realtimeConnectionState !== "live";
  const swapCompletionDisabled = lifecycleWriteDisabled || !canCompleteSwap;

  async function handleResolveSwap(nextStatus: "accepted" | "declined") {
    if (!selectedRequestId || !activeShift) {
      return;
    }

    try {
      setIsResolving(true);
      setServerSaveError("");
      await resolveNurseSwapRequest(selectedRequestId, nextStatus);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Request update could not be saved. Try again.";

      setServerSaveError(message);
    } finally {
      setIsResolving(false);
    }
  }

  async function handleUpdateIssue(nextStatus: NurseIssueReviewStatus) {
    if (!selectedRequestId || !activeShift) {
      return;
    }

    try {
      setIsResolving(true);
      setServerSaveError("");
      await updateNurseIssueStatus(selectedRequestId, nextStatus);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Issue status could not be saved. Try again.";

      setServerSaveError(message);
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboardAvoidingView}
    >
      <WorkflowScreen
        activeStep="Board"
        actionErrorText={serverSaveError}
        flow={assignmentFlow}
        headerActionLabel="Floors"
        onHeaderActionPress={() => router.push("/")}
        onPrimaryPress={() => router.push("/flags")}
        primaryAppearance="compactSecondary"
        primaryLabel="Back to flags"
        subtitle=""
        title={request ? request.typeLabel : "Request"}
      >
        {request ? (
          <View
            style={[styles.content, isExpanded ? styles.expandedContent : null]}
          >
            <View style={styles.metadataColumn}>
            <WorkflowSection title="Request summary">
              <View style={styles.summaryCard}>
                <View style={styles.chipRow}>
                  <SummaryChip label={request.typeLabel} />
                  <SummaryChip label={request.statusLabel} />
                  <SummaryChip label="Live request" />
                </View>

                <DetailRow label="Requester" value={request.requesterName} />
                <DetailRow label="Bed context" value={request.bedContext} />
                <DetailRow label="Created" value={request.createdAtText} />
                {request.resolvedAtText ? (
                  <DetailRow label="Resolved" value={request.resolvedAtText} />
                ) : null}
                {request.swapCompletedAtText ? (
                  <DetailRow
                    label="Assignment completed"
                    value={request.swapCompletedAtText}
                  />
                ) : null}
              </View>
            </WorkflowSection>

            <WorkflowSection title="Original message">
              <View style={styles.messageCard}>
                <Text style={styles.messageText}>{request.message}</Text>
              </View>
            </WorkflowSection>

            {showSwapActions ? (
              <WorkflowSection title="Swap decision">
                <View style={styles.decisionCard}>
                  <Text style={styles.decisionText}>
                    Update this request status. Bed assignments stay unchanged.
                  </Text>
                  <View style={styles.decisionButtonRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: lifecycleWriteDisabled }}
                      disabled={lifecycleWriteDisabled}
                      onPress={() => handleResolveSwap("declined")}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        lifecycleWriteDisabled ? styles.disabledButton : null,
                        pressed ? styles.buttonPressed : null,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>Decline</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: lifecycleWriteDisabled }}
                      disabled={lifecycleWriteDisabled}
                      onPress={() => handleResolveSwap("accepted")}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        lifecycleWriteDisabled ? styles.disabledButton : null,
                        pressed ? styles.buttonPressed : null,
                      ]}
                    >
                      <Text style={styles.primaryButtonText}>Accept</Text>
                    </Pressable>
                  </View>
                </View>
              </WorkflowSection>
            ) : null}

            {showIssueActions ? (
              <WorkflowSection title="Issue status">
                <View style={styles.decisionCard}>
                  {realtimeConnectionState !== "live" ? (
                    <Text
                      accessibilityRole="alert"
                      style={styles.disconnectedText}
                    >
                      Reconnect before changing this issue status.
                    </Text>
                  ) : null}
                  <View style={styles.decisionButtonRow}>
                    {request?.issueReviewStatus === "open" ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled: lifecycleWriteDisabled,
                        }}
                        disabled={lifecycleWriteDisabled}
                        onPress={() => handleUpdateIssue("reviewed")}
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          lifecycleWriteDisabled ? styles.disabledButton : null,
                          pressed ? styles.buttonPressed : null,
                        ]}
                      >
                        <Text style={styles.secondaryButtonText}>
                          Mark reviewed
                        </Text>
                      </Pressable>
                    ) : null}
                    {request?.issueReviewStatus !== "resolved" ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled: lifecycleWriteDisabled,
                        }}
                        disabled={lifecycleWriteDisabled}
                        onPress={() => handleUpdateIssue("resolved")}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          lifecycleWriteDisabled ? styles.disabledButton : null,
                          pressed ? styles.buttonPressed : null,
                        ]}
                      >
                        <Text style={styles.primaryButtonText}>
                          Resolve issue
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled: lifecycleWriteDisabled,
                        }}
                        disabled={lifecycleWriteDisabled}
                        onPress={() => handleUpdateIssue("open")}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          lifecycleWriteDisabled ? styles.disabledButton : null,
                          pressed ? styles.buttonPressed : null,
                        ]}
                      >
                        <Text style={styles.primaryButtonText}>
                          Reopen issue
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </WorkflowSection>
            ) : null}

            {showSwapCompletionAction ? (
              <WorkflowSection title="Assignment change">
                <View style={styles.decisionCard}>
                  <Text style={styles.decisionText}>
                    Acceptance records the decision only. Complete the request
                    by confirming the assignment move for its linked bed.
                  </Text>
                  {!canCompleteSwap ? (
                    <Text
                      accessibilityRole="alert"
                      style={styles.disconnectedText}
                    >
                      The linked bed is unavailable, so this swap cannot be
                      completed from the current shift.
                    </Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: swapCompletionDisabled }}
                    disabled={swapCompletionDisabled}
                    onPress={() => setIsMoveDialogOpen(true)}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      swapCompletionDisabled ? styles.disabledButton : null,
                      pressed ? styles.buttonPressed : null,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>
                      Complete with assignment move
                    </Text>
                  </Pressable>
                </View>
              </WorkflowSection>
            ) : null}

            {showSwapCompletionSummary ? (
              <WorkflowSection title="Assignment change">
                <View style={styles.decisionCard}>
                  <Text style={styles.decisionText}>
                    {wasSwapAssignmentChangedLater
                      ? "This swap was completed, but a later move changed that bed assignment again."
                      : "The accepted swap was completed through a confirmed assignment move."}
                  </Text>
                </View>
              </WorkflowSection>
            ) : null}
            </View>

            <View style={styles.threadColumn}>
              <RequestThread
                canSend={thread.canSend}
                connectionState={thread.connectionState}
                currentProfileId={currentProfileId}
                draft={thread.draft}
                isLoading={thread.isLoading}
                isSending={thread.isSending}
                loadError={thread.loadError}
                messages={thread.messages}
                onDraftChange={thread.changeDraft}
                onRetryThread={thread.retryThread}
                onSend={thread.sendMessage}
                sendError={thread.sendError}
              />
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Request unavailable</Text>
            <Text style={styles.emptyMessage}>
              Return to Flags and choose a request from the active shift.
            </Text>
          </View>
        )}
      </WorkflowScreen>
      {activeShift && effectiveAssignmentResult && request?.sourceBedId ? (
        <AssignmentMoveDialog
          activeShift={activeShift}
          bedId={request.sourceBedId}
          effectiveAssignmentResult={effectiveAssignmentResult}
          onClose={() => setIsMoveDialogOpen(false)}
          relatedSwapRequestId={
            showSwapCompletionAction ? selectedRequestId : undefined
          }
          visible={isMoveDialogOpen && showSwapCompletionAction}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    gap: spacing.cardGap,
  },
  expandedContent: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  metadataColumn: {
    flex: 1,
    gap: spacing.cardGap,
    minWidth: 0,
  },
  threadColumn: {
    flex: 1.15,
    minWidth: 0,
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
  detailRow: {
    gap: spacing.xs,
  },
  detailLabel: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  detailValue: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
    lineHeight: 20,
  },
  messageCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    padding: spacing.md,
    ...shadows.sm,
  },
  messageText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.medium,
    lineHeight: 20,
  },
  decisionCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  decisionText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  decisionButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderColor: colors.brand.burgundy,
    borderRadius: radius.md,
    borderWidth: 0.5,
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  disconnectedText: {
    color: colors.status.red800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  disabledButton: {
    opacity: 0.48,
  },
  secondaryButtonText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
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
