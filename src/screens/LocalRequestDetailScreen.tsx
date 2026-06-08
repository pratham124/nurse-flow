import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  SummaryChip,
  WorkflowScreen,
  WorkflowSection,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
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

export default function LocalRequestDetailScreen() {
  const { localState } = useLocalState();
  const { requestId } = useLocalSearchParams<{
    requestId?: string | string[];
  }>();
  const request = getNurseRequestDisplayById(
    localState.activeShift,
    getParamValue(requestId),
  );

  return (
    <WorkflowScreen
      activeStep="Flags"
      flow={assignmentFlow}
      headerActionLabel="Floors"
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/flags")}
      primaryLabel="Back to flags"
      subtitle=""
      title={request ? request.typeLabel : "Local request"}
    >
      {request ? (
        <View style={styles.content}>
          <WorkflowSection title="Request summary">
            <View style={styles.summaryCard}>
              <View style={styles.chipRow}>
                <SummaryChip label={request.typeLabel} />
                <SummaryChip label={request.statusLabel} />
                <SummaryChip label="Local only" />
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
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Request unavailable</Text>
          <Text style={styles.emptyMessage}>
            Return to Flags and choose a local request from the active shift.
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
