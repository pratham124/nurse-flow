import { useShallow } from "zustand/react/shallow";
import { router, useLocalSearchParams } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { RequestThread } from "../components/requests/RequestThread";
import { ResponsiveContent, SummaryChip } from "../components/workflow";
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
import type { JoinedNurseAssignmentView, NurseRequest } from "../types/models";
import {
  getNurseRequestLifecycleLabel,
  getNurseRequestLifecycleState,
  NURSE_REQUEST_LIFECYCLE_STATE,
} from "../utils/nurseRequestLifecycle";

type DetailRowProps = {
  label: string;
  value: string;
};

type SafeStateProps = {
  message: string;
  title: string;
};

function getParamValue(param: string | string[] | undefined) {
  return Array.isArray(param) ? param[0] : param;
}

function getRequestTitle(request?: NurseRequest) {
  if (!request) {
    return "Request conversation";
  }

  return request.type === "swap" ? "Swap request" : "Issue request";
}

function getCreatedAtLabel(createdAt: string) {
  const createdDate = new Date(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return "Server time unavailable";
  }

  return createdDate.toLocaleString([], {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

function getBedContext(
  assignmentView: JoinedNurseAssignmentView,
  request: NurseRequest,
) {
  if (!request.sourceBedId) {
    return "No bed linked";
  }

  const assignedBed = assignmentView.assignedBeds.find(
    (bedView) => bedView.bed.id === request.sourceBedId,
  );

  return assignedBed
    ? `Room ${assignedBed.room.label}, ${assignedBed.bed.label}`
    : "Bed linked to the original request";
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function SafeState({ message, title }: SafeStateProps) {
  return (
    <View style={styles.safeStateCard}>
      <Text style={styles.safeStateTitle}>{title}</Text>
      <Text style={styles.safeStateMessage}>{message}</Text>
    </View>
  );
}

export default function JoinedNurseRequestDetailScreen() {
  const { isExpanded } = useResponsiveLayout();
  const { authState } = useAuthSession();
  const {
    joinedNurseAccessState,
    retryLoadJoinedNurseAccess,
  } = useServerWorkspace(
    useShallow((state) => ({
      joinedNurseAccessState: state.joinedNurseAccessState,
      retryLoadJoinedNurseAccess: state.retryLoadJoinedNurseAccess,
    })),
  );
  const { requestId } = useLocalSearchParams<{
    requestId?: string | string[];
  }>();
  const selectedRequestId = getParamValue(requestId);
  const assignmentView =
    joinedNurseAccessState.status === "ready"
      ? joinedNurseAccessState.assignmentView
      : undefined;
  const request = assignmentView?.requestHistory.find(
    (requestItem) => requestItem.id === selectedRequestId,
  );
  const lifecycleState = request
    ? getNurseRequestLifecycleState(request)
    : undefined;
  const wasSwapAssignmentChangedLater =
    lifecycleState ===
    NURSE_REQUEST_LIFECYCLE_STATE.SWAP_COMPLETED_ASSIGNMENT_CHANGED;
  const currentProfileId =
    authState.status === "signed_in" ? authState.profile.id : "";
  const thread = useRequestThread({
    enabled: Boolean(
      currentProfileId && assignmentView && request && selectedRequestId,
    ),
    requestId: selectedRequestId,
    shiftId: assignmentView?.shiftId,
  });

  function handleBackToAssignment() {
    router.replace("/regular-nurse-workspace");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{getRequestTitle(request)}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleBackToAssignment}
            style={({ pressed }) => [
              styles.backButton,
              pressed ? styles.backButtonPressed : null,
            ]}
          >
            <Text style={styles.backButtonText}>Back to assignment</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <ResponsiveContent expanded>
            <View style={styles.contentColumn}>
          {joinedNurseAccessState.status === "idle" ||
          joinedNurseAccessState.status === "loading" ? (
            <LoadingState message="Loading request" />
          ) : null}

          {joinedNurseAccessState.status === "shift_ended" ? (
            <SafeState
              message="This request thread is no longer available because the shift ended."
              title="Shift ended"
            />
          ) : null}

          {joinedNurseAccessState.status === "access_removed" ? (
            <SafeState
              message="This account is no longer linked to the nurse who created this request."
              title="Access removed"
            />
          ) : null}

          {joinedNurseAccessState.status === "empty" ? (
            <SafeState
              message="Join an active shift before opening a request conversation."
              title="No shift access"
            />
          ) : null}

          {joinedNurseAccessState.status === "error" ? (
            <ErrorState
              message={joinedNurseAccessState.errorMessage}
              onRetry={retryLoadJoinedNurseAccess}
              title="Request access could not load"
            />
          ) : null}

          {assignmentView && !request ? (
            <SafeState
              message="Return to your assignment and choose one of your own requests."
              title="Request unavailable"
            />
          ) : null}

          {assignmentView && request ? (
            <View
              style={[
                styles.requestContent,
                isExpanded ? styles.expandedRequestContent : null,
              ]}
            >
              <View style={styles.metadataColumn}>
                <View style={styles.summaryCard}>
                  <View style={styles.chipRow}>
                    <SummaryChip label={getRequestTitle(request)} />
                    <SummaryChip
                      label={getNurseRequestLifecycleLabel(request)}
                    />
                  </View>
                  <DetailRow
                    label="Created"
                    value={getCreatedAtLabel(request.createdAt)}
                  />
                  <DetailRow
                    label="Bed context"
                    value={getBedContext(assignmentView, request)}
                  />
                  {request.swapCompletedAt ? (
                    <DetailRow
                      label="Assignment completed"
                      value={getCreatedAtLabel(request.swapCompletedAt)}
                    />
                  ) : null}
                  <Text style={styles.readOnlyNote}>
                    Request status is managed by charge. Messages do not change
                    assignments or request status.
                  </Text>
                  {wasSwapAssignmentChangedLater ? (
                    <Text style={styles.lifecycleNote}>
                      The swap was completed, but a later move changed that bed
                      assignment again.
                    </Text>
                  ) : null}
                </View>

                <View style={styles.originalMessageCard}>
                  <Text style={styles.sectionTitle}>Original message</Text>
                  <Text style={styles.originalMessage}>{request.message}</Text>
                </View>
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
          ) : null}
            </View>
          </ResponsiveContent>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.neutral.backgroundPrimary,
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderBottomColor: colors.neutral.borderTertiary,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    ...shadows.sm,
  },
  title: {
    color: colors.neutral.textPrimary,
    flex: 1,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  backButton: {
    alignItems: "center",
    borderColor: colors.neutral.borderSecondary,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  backButtonPressed: {
    opacity: 0.75,
  },
  backButtonText: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  contentColumn: {
    gap: spacing.cardGap,
  },
  requestContent: {
    gap: spacing.cardGap,
  },
  expandedRequestContent: {
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
  },
  detailValue: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  readOnlyNote: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  lifecycleNote: {
    color: colors.status.amber800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  originalMessageCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  originalMessage: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    lineHeight: 20,
  },
  safeStateCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.sm,
    padding: spacing.lg,
    ...shadows.sm,
  },
  safeStateTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  safeStateMessage: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.md,
    lineHeight: 20,
  },
});
