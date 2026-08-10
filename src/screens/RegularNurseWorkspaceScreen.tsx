import { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { LiveStatusChip, ResponsiveContent } from "../components/workflow";
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
import type { JoinedNurseAssignmentView } from "../types/models";
import { getNurseRequestLifecycleLabel } from "../utils/nurseRequestLifecycle";

type AssignmentSummaryProps = {
  assignmentView: JoinedNurseAssignmentView;
  onOpenRequest: (requestId: string) => void;
};

type RequestActionsProps = {
  assignmentView: JoinedNurseAssignmentView;
  formError: string;
  formSuccess: string;
  issueMessage: string;
  isSubmittingIssue: boolean;
  isSubmittingSwap: boolean;
  onIssueMessageChange: (message: string) => void;
  onSelectSwapBed: (bedId: string) => void;
  onSubmitIssue: () => void;
  onSubmitSwap: () => void;
  onSwapMessageChange: (message: string) => void;
  selectedSwapBedId?: string;
  swapMessage: string;
};

type RequestTextAreaProps = {
  label: string;
  onChangeText: (message: string) => void;
  placeholder: string;
  value: string;
};

type RequestActionButtonProps = {
  disabled: boolean;
  label: string;
  onPress: () => void;
};

type AssignedRoomGroup = {
  beds: {
    doctorSideName: string;
    id: string;
    label: string;
  }[];
  id: string;
  roomLabel: string;
};

function getShortBedLabel(
  assignedBed: JoinedNurseAssignmentView["assignedBeds"][number],
) {
  return assignedBed.bed.label.startsWith(`${assignedBed.room.label}-`)
    ? assignedBed.bed.label.slice(assignedBed.room.label.length + 1)
    : assignedBed.bed.label;
}

function getAssignedBedLabel(
  assignedBed: JoinedNurseAssignmentView["assignedBeds"][number],
) {
  const bedLabel = getShortBedLabel(assignedBed);
  return `Room ${assignedBed.room.label}, Bed ${bedLabel}`;
}

function getAssignedRoomGroups(
  assignmentView: JoinedNurseAssignmentView,
): AssignedRoomGroup[] {
  const groups = new Map<string, AssignedRoomGroup>();

  assignmentView.assignedBeds.forEach((assignedBed) => {
    const existingGroup = groups.get(assignedBed.room.id);
    const group = existingGroup ?? {
      beds: [],
      id: assignedBed.room.id,
      roomLabel: assignedBed.room.label,
    };

    group.beds.push({
      doctorSideName: assignedBed.doctorSide.name,
      id: assignedBed.bed.id,
      label: getShortBedLabel(assignedBed),
    });
    groups.set(assignedBed.room.id, group);
  });

  return Array.from(groups.values());
}

function getRequestUpdateTitle(
  request: JoinedNurseAssignmentView["requestHistory"][number],
) {
  const requestTypeLabel = request.type === "swap" ? "Swap request" : "Issue";

  return `${requestTypeLabel}: ${getNurseRequestLifecycleLabel(request)}`;
}

function hasDuplicatePendingRequest(
  assignmentView: JoinedNurseAssignmentView,
  message: string,
  sourceBedId?: string,
) {
  const normalizedMessage = message.trim().toLowerCase();

  if (!normalizedMessage) {
    return false;
  }

  return assignmentView.requestHistory.some((request) => {
    const sameMessage =
      request.message.trim().toLowerCase() === normalizedMessage;
    const sameSourceBed = (request.sourceBedId ?? "") === (sourceBedId ?? "");

    return request.status === "pending" && sameMessage && sameSourceBed;
  });
}

function AssignmentSummary({
  assignmentView,
  onOpenRequest,
}: AssignmentSummaryProps) {
  const roomGroups = getAssignedRoomGroups(assignmentView);
  const hasManyRooms = roomGroups.length > 3;
  const hasManyRequests = assignmentView.requestHistory.length > 3;

  return (
    <View style={styles.assignmentPanel}>
      <Text style={styles.sectionLabel}>Current assignment</Text>
      <Text style={styles.floorName}>{assignmentView.floorName}</Text>

      <View style={styles.statRow}>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>
            {assignmentView.assignedBeds.length}
          </Text>
          <Text style={styles.statLabel}>Beds</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{roomGroups.length}</Text>
          <Text style={styles.statLabel}>Rooms</Text>
        </View>
      </View>

      <View style={styles.bedList}>
        <View style={styles.requestHeaderRow}>
          <Text style={styles.sectionLabel}>Assigned rooms</Text>
          {hasManyRooms ? (
            <Text style={styles.requestCountText}>
              {roomGroups.length} total
            </Text>
          ) : null}
        </View>
        {roomGroups.length ? (
          <ScrollView
            nestedScrollEnabled
            persistentScrollbar={hasManyRooms}
            scrollEnabled={hasManyRooms}
            showsVerticalScrollIndicator={hasManyRooms}
            style={styles.roomScrollArea}
            contentContainerStyle={styles.roomScrollContent}
          >
            {roomGroups.map((roomGroup) => (
              <View key={roomGroup.id} style={styles.bedRow}>
                <Text style={styles.bedTitle}>Room {roomGroup.roomLabel}</Text>
                {roomGroup.beds.map((bed) => (
                  <Text key={bed.id} style={styles.bedDetail}>
                    Bed {bed.label} - {bed.doctorSideName}
                  </Text>
                ))}
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.emptyDetail}>No beds assigned yet.</Text>
        )}
      </View>

      <View style={styles.requestList}>
        <View style={styles.requestHeaderRow}>
          <Text style={styles.sectionLabel}>Request updates</Text>
          {hasManyRequests ? (
            <Text style={styles.requestCountText}>
              {assignmentView.requestHistory.length} total
            </Text>
          ) : null}
        </View>
        {assignmentView.requestHistory.length ? (
          <ScrollView
            nestedScrollEnabled
            persistentScrollbar={hasManyRequests}
            scrollEnabled={hasManyRequests}
            showsVerticalScrollIndicator={hasManyRequests}
            style={styles.requestScrollArea}
            contentContainerStyle={styles.requestScrollContent}
          >
            {assignmentView.requestHistory.map((request) => (
              <Pressable
                accessibilityLabel={`Open ${getRequestUpdateTitle(request)}: ${request.message}`}
                accessibilityRole="button"
                key={request.id}
                onPress={() => onOpenRequest(request.id)}
                style={({ pressed }) => [
                  styles.requestRow,
                  pressed ? styles.requestRowPressed : null,
                ]}
              >
                <Text style={styles.requestTitle}>
                  {getRequestUpdateTitle(request)}
                </Text>
                <Text style={styles.bedDetail}>{request.message}</Text>
                <Text style={styles.openRequestText}>Open conversation</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.emptyDetail}>No updates yet.</Text>
        )}
      </View>
    </View>
  );
}

function RequestTextArea({
  label,
  onChangeText,
  placeholder,
  value,
}: RequestTextAreaProps) {
  return (
    <View style={styles.requestField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.neutral.textTertiary}
        style={styles.requestTextArea}
        textAlignVertical="top"
        value={value}
      />
    </View>
  );
}

function RequestActionButton({
  disabled,
  label,
  onPress,
}: RequestActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.requestActionButton,
        disabled ? styles.disabledRequestActionButton : null,
        pressed && !disabled ? styles.requestActionButtonPressed : null,
      ]}
    >
      <Text style={styles.requestActionButtonText}>{label}</Text>
    </Pressable>
  );
}

function RequestActions({
  assignmentView,
  formError,
  formSuccess,
  issueMessage,
  isSubmittingIssue,
  isSubmittingSwap,
  onIssueMessageChange,
  onSelectSwapBed,
  onSubmitIssue,
  onSubmitSwap,
  onSwapMessageChange,
  selectedSwapBedId,
  swapMessage,
}: RequestActionsProps) {
  const hasAssignedBeds = assignmentView.assignedBeds.length > 0;
  const issueDuplicate = hasDuplicatePendingRequest(
    assignmentView,
    issueMessage,
  );
  const swapDuplicate = hasDuplicatePendingRequest(
    assignmentView,
    swapMessage,
    selectedSwapBedId,
  );
  const canSubmitIssue =
    Boolean(issueMessage.trim()) && !issueDuplicate && !isSubmittingIssue;
  const canSubmitSwap =
    Boolean(selectedSwapBedId) &&
    Boolean(swapMessage.trim()) &&
    !swapDuplicate &&
    !isSubmittingSwap;

  return (
    <View style={styles.requestPanel}>
      <View style={styles.requestPanelHeader}>
        <Text style={styles.requestPanelTitle}>Need charge nurse help?</Text>
      </View>

      <View style={styles.requestCard}>
        <Text style={styles.requestCardTitle}>Flag an issue</Text>
        <RequestTextArea
          label="What's going on?"
          onChangeText={onIssueMessageChange}
          placeholder="Example: Patient asking to speak with charge"
          value={issueMessage}
        />
        {issueDuplicate ? (
          <Text style={styles.formWarning}>
            You already sent this issue. Charge can see it.
          </Text>
        ) : null}
        <RequestActionButton
          disabled={!canSubmitIssue}
          label={isSubmittingIssue ? "Sending..." : "Send issue"}
          onPress={onSubmitIssue}
        />
      </View>

      <View style={styles.requestCard}>
        <Text style={styles.requestCardTitle}>Ask for a swap</Text>
        <Text style={styles.fieldLabel}>Which bed is this about?</Text>
        {hasAssignedBeds ? (
          <View style={styles.bedChoiceList}>
            {assignmentView.assignedBeds.map((assignedBed) => {
              const isSelected = assignedBed.bed.id === selectedSwapBedId;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={assignedBed.bed.id}
                  onPress={() => onSelectSwapBed(assignedBed.bed.id)}
                  style={({ pressed }) => [
                    styles.bedChoice,
                    isSelected ? styles.selectedBedChoice : null,
                    pressed ? styles.bedChoicePressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.bedChoiceText,
                      isSelected ? styles.selectedBedChoiceText : null,
                    ]}
                  >
                    {getAssignedBedLabel(assignedBed)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.emptyDetail}>
            No assigned beds are available for swap requests.
          </Text>
        )}

        <RequestTextArea
          label="Why are you asking?"
          onChangeText={onSwapMessageChange}
          placeholder="Example: This pairing feels too heavy right now"
          value={swapMessage}
        />
        {swapDuplicate ? (
          <Text style={styles.formWarning}>
            You already asked about this bed. Charge can see it.
          </Text>
        ) : null}
        <RequestActionButton
          disabled={!canSubmitSwap}
          label={isSubmittingSwap ? "Sending..." : "Ask to swap"}
          onPress={onSubmitSwap}
        />
      </View>

      {formError ? (
        <Text accessibilityRole="alert" style={styles.formError}>
          {formError}
        </Text>
      ) : null}
      {formSuccess ? (
        <Text style={styles.formSuccess}>{formSuccess}</Text>
      ) : null}
    </View>
  );
}

export default function RegularNurseWorkspaceScreen() {
  const { isExpanded } = useResponsiveLayout();
  const { authState } = useAuthSession();
  const {
    joinedNurseAccessState,
    joinedNurseRealtimeConnectionState,
    retryLoadJoinedNurseAccess,
    submitJoinedNurseIssueRequest,
    submitJoinedNurseSwapRequest,
  } = useServerWorkspace();
  const [issueMessage, setIssueMessage] = useState("");
  const [swapMessage, setSwapMessage] = useState("");
  const [selectedSwapBedId, setSelectedSwapBedId] = useState<
    string | undefined
  >();
  const [requestFormError, setRequestFormError] = useState("");
  const [requestFormSuccess, setRequestFormSuccess] = useState("");
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [isSubmittingSwap, setIsSubmittingSwap] = useState(false);
  const displayName =
    authState.status === "signed_in" ? authState.profile.displayName : "Nurse";
  const assignmentView =
    joinedNurseAccessState.status === "ready"
      ? joinedNurseAccessState.assignmentView
      : undefined;

  useEffect(() => {
    if (!assignmentView) {
      setSelectedSwapBedId(undefined);
      return;
    }

    const selectedBedStillAssigned = assignmentView.assignedBeds.some(
      (assignedBed) => assignedBed.bed.id === selectedSwapBedId,
    );

    if (!selectedBedStillAssigned) {
      setSelectedSwapBedId(assignmentView.assignedBeds[0]?.bed.id);
    }
  }, [assignmentView, selectedSwapBedId]);

  function handleBackHome() {
    router.replace("/");
  }

  function handleOpenRequest(requestId: string) {
    router.push({
      params: { requestId },
      pathname: "/joined-request-detail",
    });
  }

  async function handleSubmitIssue() {
    if (!assignmentView) {
      return;
    }

    if (hasDuplicatePendingRequest(assignmentView, issueMessage)) {
      setRequestFormError("That issue is already pending.");
      setRequestFormSuccess("");
      return;
    }

    try {
      setIsSubmittingIssue(true);
      setRequestFormError("");
      setRequestFormSuccess("");
      await submitJoinedNurseIssueRequest(issueMessage);
      setIssueMessage("");
      setRequestFormSuccess("Issue sent to charge.");
    } catch (error) {
      setRequestFormError(
        error instanceof Error
          ? error.message
          : "Issue request could not be submitted.",
      );
    } finally {
      setIsSubmittingIssue(false);
    }
  }

  async function handleSubmitSwap() {
    if (!assignmentView || !selectedSwapBedId) {
      setRequestFormError("Choose one of your assigned beds for the swap.");
      setRequestFormSuccess("");
      return;
    }

    if (
      hasDuplicatePendingRequest(assignmentView, swapMessage, selectedSwapBedId)
    ) {
      setRequestFormError("That swap request is already pending.");
      setRequestFormSuccess("");
      return;
    }

    try {
      setIsSubmittingSwap(true);
      setRequestFormError("");
      setRequestFormSuccess("");
      await submitJoinedNurseSwapRequest(selectedSwapBedId, swapMessage);
      setSwapMessage("");
      setRequestFormSuccess("Swap request sent to charge.");
    } catch (error) {
      setRequestFormError(
        error instanceof Error
          ? error.message
          : "Swap request could not be submitted.",
      );
    } finally {
      setIsSubmittingSwap(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ResponsiveContent expanded>
          <View style={styles.card}>
          <Text style={styles.eyebrow}>My shift</Text>
          <Text style={styles.title}>{displayName}</Text>

          {joinedNurseAccessState.status === "ready" ? (
            <LiveStatusChip
              connectionState={joinedNurseRealtimeConnectionState}
              onRefresh={retryLoadJoinedNurseAccess}
            />
          ) : null}

          {joinedNurseAccessState.status === "loading" ||
          joinedNurseAccessState.status === "idle" ? (
            <LoadingState message="Checking shift access" />
          ) : null}

          {joinedNurseAccessState.status === "empty" ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>No shift access yet</Text>
              <Text style={styles.message}>
                Enter a nurse code from charge to connect this account to an
                active shift.
              </Text>
            </View>
          ) : null}

          {joinedNurseAccessState.status === "shift_ended" ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>Shift ended</Text>
              <Text style={styles.message}>
                This live assignment is no longer active. Return home for a safe
                place to continue.
              </Text>
            </View>
          ) : null}

          {joinedNurseAccessState.status === "access_removed" ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>Access removed</Text>
              <Text style={styles.message}>
                This account is no longer linked to that nurse assignment. Ask
                charge for a new code if you still need access.
              </Text>
            </View>
          ) : null}

          {joinedNurseAccessState.status === "ready" ? (
            <View
              style={[
                styles.readyContent,
                isExpanded ? styles.expandedReadyContent : null,
              ]}
            >
              <View
                style={[
                  styles.readyColumn,
                  isExpanded ? styles.expandedReadyColumn : null,
                ]}
              >
                <AssignmentSummary
                  assignmentView={joinedNurseAccessState.assignmentView}
                  onOpenRequest={handleOpenRequest}
                />
              </View>
              <View
                style={[
                  styles.readyColumn,
                  isExpanded ? styles.expandedReadyColumn : null,
                ]}
              >
                <RequestActions
                  assignmentView={joinedNurseAccessState.assignmentView}
                  formError={requestFormError}
                  formSuccess={requestFormSuccess}
                  issueMessage={issueMessage}
                  isSubmittingIssue={isSubmittingIssue}
                  isSubmittingSwap={isSubmittingSwap}
                  onIssueMessageChange={setIssueMessage}
                  onSelectSwapBed={setSelectedSwapBedId}
                  onSubmitIssue={handleSubmitIssue}
                  onSubmitSwap={handleSubmitSwap}
                  onSwapMessageChange={setSwapMessage}
                  selectedSwapBedId={selectedSwapBedId}
                  swapMessage={swapMessage}
                />
              </View>
            </View>
          ) : null}

          {joinedNurseAccessState.status === "error" ? (
            <ErrorState
              message={joinedNurseAccessState.errorMessage}
              onRetry={retryLoadJoinedNurseAccess}
              title="Shift access could not load"
            />
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={handleBackHome}
            style={({ pressed }) => [
              styles.homeButton,
              pressed && styles.homeButtonPressed,
            ]}
          >
            <Text style={styles.homeButtonText}>Back to home</Text>
          </Pressable>
          </View>
        </ResponsiveContent>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.neutral.backgroundPrimary,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.xl,
    ...shadows.sm,
  },
  readyContent: {
    gap: spacing.cardGap,
  },
  expandedReadyContent: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  readyColumn: {
    width: "100%",
  },
  expandedReadyColumn: {
    flex: 1,
    minWidth: 0,
    width: "auto",
  },
  assignmentPanel: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.lg,
  },
  bedDetail: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  bedList: {
    gap: spacing.sm,
  },
  bedRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.md,
  },
  bedTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  emptyDetail: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  emptyPanel: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  eyebrow: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.xl,
    fontWeight: fontWeight.heavy,
  },
  message: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.md,
    fontWeight: fontWeight.medium,
    lineHeight: 20,
  },
  floorName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.heavy,
  },
  sectionLabel: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  requestList: {
    gap: spacing.sm,
  },
  requestHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  requestCountText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.semibold,
  },
  requestScrollArea: {
    maxHeight: 210,
  },
  requestScrollContent: {
    gap: spacing.sm,
  },
  roomScrollArea: {
    maxHeight: 210,
  },
  roomScrollContent: {
    gap: spacing.sm,
  },
  requestRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.md,
  },
  requestRowPressed: {
    opacity: 0.8,
  },
  openRequestText: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  requestPanel: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  requestPanelHeader: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  requestPanelTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  requestPanelSubtitle: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  requestCard: {
    backgroundColor: colors.neutral.backgroundTertiary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
  },
  requestCardTitle: {
    color: colors.brand.burgundy,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  requestTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  fieldLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  requestField: {
    gap: spacing.sm,
  },
  requestTextArea: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    lineHeight: 20,
    minHeight: 84,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  bedChoiceList: {
    gap: spacing.sm,
  },
  bedChoice: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedBedChoice: {
    backgroundColor: colors.brand.burgundy10,
    borderColor: colors.brand.burgundy,
  },
  bedChoicePressed: {
    opacity: 0.82,
  },
  bedChoiceText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  selectedBedChoiceText: {
    color: colors.brand.burgundy,
  },
  formWarning: {
    color: colors.status.amber800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  formError: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  formSuccess: {
    color: colors.status.green800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  requestActionButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  disabledRequestActionButton: {
    opacity: 0.48,
  },
  requestActionButtonPressed: {
    opacity: 0.82,
  },
  requestActionButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  statLabel: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.semibold,
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statTile: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    flex: 1,
    gap: spacing.xs,
    minWidth: 86,
    padding: spacing.md,
  },
  statValue: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  homeButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.lg,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  homeButtonPressed: {
    opacity: 0.82,
  },
  homeButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
});
