import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  SummaryChip,
  WorkflowScreen,
  WorkflowSection,
} from "../components/workflow";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import { colors, fontWeight, radius, shadows, spacing, textSize } from "../theme/tokens";
import { getNurseRequestDisplayById } from "../utils/nurseRequestDisplay";
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

export default function RequestDetailScreen() {
  const { activeShift, resolveNurseSwapRequest } = useServerWorkspace();
  const [serverSaveError, setServerSaveError] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const { requestId } = useLocalSearchParams<{
    requestId?: string | string[];
  }>();
  const selectedRequestId = getParamValue(requestId);
  const request = getNurseRequestDisplayById(
    activeShift,
    selectedRequestId,
  );
  const showSwapActions =
    Boolean(request) &&
    request?.requestType === "swap" &&
    request.requestStatus === "pending";
  const showIssueActionNote =
    Boolean(request) &&
    request?.requestType === "issue" &&
    request.requestStatus === "pending";

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

  return (
    <WorkflowScreen
      activeStep="Board"
      actionErrorText={serverSaveError}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/flags")}
      primaryLabel="Back to flags"
      subtitle=""
      title={request ? request.typeLabel : "Request"}
    >
      {request ? (
        <View style={styles.content}>
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
            </View>
          </WorkflowSection>

          <WorkflowSection title="Message">
            <View style={styles.messageCard}>
              <Text style={styles.messageText}>{request.message}</Text>
            </View>
          </WorkflowSection>

          {showSwapActions ? (
            <WorkflowSection title="Swap decision">
              <View style={styles.decisionCard}>
                <Text style={styles.decisionText}>
                  Update this request status. Bed assignments stay
                  unchanged.
                </Text>
                <View style={styles.decisionButtonRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isResolving }}
                    disabled={isResolving}
                    onPress={() => handleResolveSwap("declined")}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      isResolving ? styles.disabledButton : null,
                      pressed ? styles.buttonPressed : null,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Decline</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isResolving }}
                    disabled={isResolving}
                    onPress={() => handleResolveSwap("accepted")}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      isResolving ? styles.disabledButton : null,
                      pressed ? styles.buttonPressed : null,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>Accept</Text>
                  </Pressable>
                </View>
              </View>
            </WorkflowSection>
          ) : null}

          {showIssueActionNote ? (
            <WorkflowSection title="Charge action">
              <View style={styles.decisionCard}>
                <Text style={styles.decisionText}>
                  Review this issue with the nurse. Issue requests are
                  tracked here, but they do not need an accept or decline
                  decision in the app.
                </Text>
              </View>
            </WorkflowSection>
          ) : null}
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
