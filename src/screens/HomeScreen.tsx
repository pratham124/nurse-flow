import { useShallow } from "zustand/react/shallow";
import { useState } from "react";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ConfirmationDialog,
  HospitalIcon,
  LiveStatusChip,
  SwipeRevealAction,
  TrashIcon,
  ChevronRightIcon,
  BedIcon,
  BellIcon,
  RoomIcon,
} from "../components/workflow";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { NotificationPermissionDialog } from "../components/NotificationPermissionCard";
import { useAuthSession } from "../store/AuthSessionContext";
import { useNotificationPermission } from "../store/NotificationPermissionContext";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import { useWorkflowDraft } from "../store/WorkflowDraftContext";
import {
  colors,
  radius,
  spacing,
  textSize,
  fontWeight,
  shadows,
} from "../theme/tokens";
import type { FloorTemplate } from "../types/models";
import {
  isCompletedFloorTemplate,
  createShiftFromTemplate,
  copyFloorTemplate,
  createPreviousShiftSnapshot,
} from "../helpers/shiftHelpers";

const COMPACT_TEMPLATE_CARD_MAX_WIDTH = 350;

type FloorTemplateRowProps = {
  canDelete: boolean;
  floorTemplate: FloorTemplate;
  onRequestDelete: (floorTemplate: FloorTemplate) => void;
  onPress: (floorTemplate: FloorTemplate) => void;
  onStartShift: (floorTemplate: FloorTemplate) => void;
};

type JoinedNurseShiftCardProps = {
  bedCount: number;
  floorName: string;
  nurseName: string;
  onResume: () => void;
};

function JoinedNurseShiftCard({
  bedCount,
  floorName,
  nurseName,
  onResume,
}: JoinedNurseShiftCardProps) {
  return (
    <View style={styles.joinedShiftCard}>
      <View style={styles.joinedShiftHeader}>
        <View style={styles.joinedShiftBadgeContainer}>
          <View style={styles.joinedShiftDot} />
          <Text style={styles.joinedShiftBadgeText}>JOINED SHIFT</Text>
        </View>
        <Text style={styles.joinedShiftMeta}>
          {bedCount} {bedCount === 1 ? "bed" : "beds"}
        </Text>
      </View>
      <Text style={styles.joinedShiftName}>{floorName}</Text>
      <Text style={styles.joinedShiftDetail}>{nurseName}</Text>
      <Pressable
        accessibilityLabel="Open joined nurse shift"
        accessibilityRole="button"
        onPress={onResume}
        style={({ pressed }) => [
          styles.joinedShiftButton,
          pressed && styles.joinedShiftButtonPressed,
        ]}
      >
        <Text style={styles.joinedShiftButtonText}>Open shift</Text>
        <ChevronRightIcon color={colors.neutral.surface} size={14} />
      </Pressable>
    </View>
  );
}

function FloorTemplateRow({
  canDelete,
  floorTemplate,
  onRequestDelete,
  onPress,
  onStartShift,
}: FloorTemplateRowProps) {
  const { width } = useWindowDimensions();
  const isCompactLayout = width < COMPACT_TEMPLATE_CARD_MAX_WIDTH;
  const roomCount = floorTemplate.rooms.length;
  const bedCount = floorTemplate.beds.length;
  const floorInitial = floorTemplate.name.trim().charAt(0).toUpperCase() || "F";

  const startShiftButton = (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onStartShift(floorTemplate);
      }}
      style={({ pressed }) => [
        styles.startShiftButton,
        isCompactLayout && styles.startShiftButtonCompact,
        pressed && styles.startShiftButtonPressed,
      ]}
    >
      <Text style={styles.startShiftButtonText}>Start Shift</Text>
    </Pressable>
  );

  const rowContent = (
    <Pressable
      onPress={() => onPress(floorTemplate)}
      style={({ pressed }) => [
        styles.templateRow,
        isCompactLayout && styles.templateRowCompact,
        pressed && styles.templateRowPressed,
      ]}
    >
      <View style={styles.templateAccent} />
      <View style={styles.templateMainRow}>
        <View style={styles.templateLeft}>
          <View style={styles.templateBadge}>
            <Text style={styles.templateBadgeText}>{floorInitial}</Text>
          </View>
          <View style={styles.templateTitleGroup}>
            <Text numberOfLines={1} style={styles.templateName}>
              {floorTemplate.name}
            </Text>
            <View style={styles.templateMetaRow}>
              <View style={styles.templateMetaChip}>
                <RoomIcon size={11} color={colors.neutral.textSecondary} />
                <Text numberOfLines={1} style={styles.templateMetaChipText}>
                  {roomCount} {roomCount === 1 ? "room" : "rooms"}
                </Text>
              </View>
              <View style={styles.templateMetaChip}>
                <BedIcon size={11} color={colors.neutral.textSecondary} />
                <Text numberOfLines={1} style={styles.templateMetaChipText}>
                  {bedCount} {bedCount === 1 ? "bed" : "beds"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.templateRight}>
          {isCompactLayout ? null : startShiftButton}
          <ChevronRightIcon color={colors.neutral.textTertiary} size={14} />
        </View>
      </View>

      {isCompactLayout ? startShiftButton : null}
    </Pressable>
  );

  if (!canDelete) {
    return rowContent;
  }

  return (
    <SwipeRevealAction
      accessibilityLabel={`Delete ${floorTemplate.name}`}
      actionIcon={<TrashIcon color={colors.neutral.surface} size={18} />}
      actionLabel="Delete"
      onActionPress={() => onRequestDelete(floorTemplate)}
    >
      {rowContent}
    </SwipeRevealAction>
  );
}

export default function Index() {
  const { authState, signOut } = useAuthSession();
  const { permissionStatus, registrationState, retryRegistration } =
    useNotificationPermission();
  const { resetWorkflowDraft, setDraftFloorTemplate } = useWorkflowDraft();
  const {
    activeShift,
    activeParticipation,
    deleteFloorTemplate,
    endActiveShift,
    floorTemplates,
    joinedNurseAccessState,
    previousShiftSnapshots,
    realtimeConnectionState,
    retryLoadWorkspace,
    savePreviousShiftSnapshot: saveServerPreviousShiftSnapshot,
    startActiveShift,
    workspaceState,
  } = useServerWorkspace(
    useShallow((state) => ({
      activeShift: state.activeShift,
      activeParticipation: state.activeParticipation,
      deleteFloorTemplate: state.deleteFloorTemplate,
      endActiveShift: state.endActiveShift,
      floorTemplates: state.floorTemplates,
      joinedNurseAccessState: state.joinedNurseAccessState,
      previousShiftSnapshots: state.previousShiftSnapshots,
      realtimeConnectionState: state.realtimeConnectionState,
      retryLoadWorkspace: state.retryLoadWorkspace,
      savePreviousShiftSnapshot: state.savePreviousShiftSnapshot,
      startActiveShift: state.startActiveShift,
      workspaceState: state.workspaceState,
    })),
  );
  const [floorTemplateToDelete, setFloorTemplateToDelete] =
    useState<FloorTemplate>();
  const [endShiftConfirmationVisible, setEndShiftConfirmationVisible] =
    useState(false);
  const [notificationDialogVisible, setNotificationDialogVisible] =
    useState(false);
  const [templateEditMessage, setTemplateEditMessage] = useState("");
  const isChargeNurseSignedIn =
    authState.status === "signed_in" &&
    authState.profile.role === "charge_nurse";
  const isServerWorkspaceLoading =
    isChargeNurseSignedIn &&
    (workspaceState.status === "idle" || workspaceState.status === "loading");
  const serverWorkspaceError =
    workspaceState.status === "error" ? workspaceState.errorMessage : "";
  const visibleFloorTemplates = isServerWorkspaceLoading ? [] : floorTemplates;
  const floorTemplateCount = visibleFloorTemplates.length;

  const visibleActiveShift = isServerWorkspaceLoading ? undefined : activeShift;
  const activeShiftTemplate = visibleActiveShift
    ? floorTemplates.find((t) => t.id === visibleActiveShift?.floorTemplateId)
    : null;
  const activeShiftMissingTemplate = Boolean(
    visibleActiveShift && !activeShiftTemplate,
  );
  const activeShiftFloorName =
    visibleActiveShift?.floorName ??
    activeShiftTemplate?.name ??
    "Active Floor";
  const activeShiftNursesCount = visibleActiveShift?.nurses?.length ?? 0;
  const activeShiftPatientsCount =
    visibleActiveShift?.bedStates?.filter((bedState) =>
      bedState.patient?.initials.trim(),
    ).length ?? 0;
  const profile =
    authState.status === "signed_in" ? authState.profile : undefined;
  const joinedNurseAssignmentView =
    joinedNurseAccessState.status === "ready"
      ? joinedNurseAccessState.assignmentView
      : undefined;

  function handleCreateFloor() {
    resetWorkflowDraft();
    setTemplateEditMessage("");

    router.push("/floor-details");
  }

  function handleJoinActiveSession() {
    if (activeParticipation.type === "charge_shift") {
      setTemplateEditMessage(
        "End your active charge shift before joining another shift as a nurse.",
      );
      return;
    }

    if (activeParticipation.type === "joined_nurse") {
      setTemplateEditMessage("");
      router.push("/regular-nurse-workspace");
      return;
    }

    setTemplateEditMessage("");
    router.push("/join-active-session");
  }

  async function handleConfirmDeleteFloor() {
    if (!floorTemplateToDelete) return;

    try {
      setTemplateEditMessage("");
      await deleteFloorTemplate(floorTemplateToDelete.id);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Floor template could not be deleted.";
      setTemplateEditMessage(message);
    } finally {
      setFloorTemplateToDelete(undefined);
    }
  }

  function handleSelectTemplate(floorTemplate: FloorTemplate) {
    if (visibleActiveShift) {
      setTemplateEditMessage("End the active shift before editing templates.");
      return;
    }

    setDraftFloorTemplate(copyFloorTemplate(floorTemplate));
    setTemplateEditMessage("");
    router.push("/template-review");
  }

  async function handleStartShift(floorTemplate: FloorTemplate) {
    if (visibleActiveShift) {
      setTemplateEditMessage(
        "End the active shift before starting another shift.",
      );
      return;
    }

    if (!isCompletedFloorTemplate(floorTemplate)) {
      setDraftFloorTemplate(copyFloorTemplate(floorTemplate));
      setTemplateEditMessage(
        "This saved floor needs review before it can start a shift.",
      );
      router.push("/template-review");
      return;
    }

    const hasPreviousShiftSnapshot = previousShiftSnapshots.some(
      (snapshot) => snapshot.floorTemplateId === floorTemplate.id,
    );
    const nextShift = createShiftFromTemplate(floorTemplate);

    try {
      await startActiveShift(nextShift);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Shift could not be started. Try again.";

      setTemplateEditMessage(message);
      return;
    }

    resetWorkflowDraft();
    setTemplateEditMessage("");
    router.push(
      hasPreviousShiftSnapshot ? "/carry-over-review" : "/start-shift",
    );
  }

  async function handleConfirmEndActiveShift() {
    if (visibleActiveShift) {
      const previousShiftSnapshot =
        createPreviousShiftSnapshot(visibleActiveShift);

      try {
        await saveServerPreviousShiftSnapshot(previousShiftSnapshot);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Carry-over could not be saved. Try again.";

        setTemplateEditMessage(message);
        setEndShiftConfirmationVisible(false);
        return;
      }

      try {
        await endActiveShift(visibleActiveShift);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Shift could not be ended. Try again.";

        setTemplateEditMessage(message);
        setEndShiftConfirmationVisible(false);
        return;
      }
    }

    resetWorkflowDraft();
    setTemplateEditMessage("");
    setEndShiftConfirmationVisible(false);
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace("/");
  }

  function handleResumeActiveShift() {
    if (!visibleActiveShift) return;
    if (visibleActiveShift.status === "assigned") {
      router.push("/floor-board");
      return;
    }

    const hasPendingCarryOverReview =
      previousShiftSnapshots.some(
        (snapshot) =>
          snapshot.floorTemplateId === visibleActiveShift.floorTemplateId,
      ) && !visibleActiveShift.carryOverReviewedAt;

    if (hasPendingCarryOverReview) {
      router.push("/carry-over-review");
    } else {
      router.push("/start-shift");
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      setTemplateEditMessage("");
      router.replace("/login");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sign out failed. Try again.";

      setTemplateEditMessage(message);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.brandPanel}>
          <Text style={styles.brandTitle}>Nurse Flow</Text>
        </View>

        <View style={styles.accountPanel}>
          {profile ? (
            <Text style={styles.accountName}>{profile.displayName}</Text>
          ) : null}
          <Pressable
            accessibilityLabel="Open notification status"
            accessibilityRole="button"
            onPress={() => setNotificationDialogVisible(true)}
            style={({ pressed }) => [
              styles.notificationButton,
              pressed && styles.notificationButtonPressed,
            ]}
          >
            <BellIcon color={colors.brand.burgundy} size={19} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutButtonPressed,
            ]}
          >
            <Text style={styles.signOutButtonText}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {joinedNurseAssignmentView ? (
          <JoinedNurseShiftCard
            bedCount={joinedNurseAssignmentView.assignedBeds.length}
            floorName={joinedNurseAssignmentView.floorName}
            nurseName={joinedNurseAssignmentView.nurseName}
            onResume={() => router.push("/regular-nurse-workspace")}
          />
        ) : null}

        {/* Active Shift Card */}
        {visibleActiveShift && (
          <View style={styles.activeShiftCard}>
            <View style={styles.activeShiftHeader}>
              <View style={styles.activeShiftBadgeContainer}>
                <View style={styles.activeShiftPulse} />
                <Text style={styles.activeShiftBadgeText}>
                  ACTIVE SHIFT IN PROGRESS
                </Text>
              </View>
              <Text style={styles.activeShiftTime}>
                {visibleActiveShift.status === "assigned"
                  ? "Assigned"
                  : "In Setup"}
              </Text>
            </View>
            <Text style={styles.activeShiftName}>{activeShiftFloorName}</Text>
            <Text style={styles.activeShiftStats}>
              {activeShiftNursesCount}{" "}
              {activeShiftNursesCount === 1 ? "nurse" : "nurses"} •{" "}
              {activeShiftPatientsCount}{" "}
              {activeShiftPatientsCount === 1 ? "patient" : "patients"}
            </Text>
            <LiveStatusChip
              connectionState={realtimeConnectionState}
              onRefresh={retryLoadWorkspace}
            />
            {activeShiftMissingTemplate ? (
              <Text accessibilityRole="alert" style={styles.activeShiftWarning}>
                Saved floor template is missing. Resume this shift or end it to
                clear the recovered shift.
              </Text>
            ) : null}
            <View style={styles.activeShiftActions}>
              <Pressable
                accessibilityLabel="Resume active shift"
                accessibilityRole="button"
                onPress={handleResumeActiveShift}
                style={({ pressed }) => [
                  styles.resumeButton,
                  pressed && styles.resumeButtonPressed,
                ]}
              >
                <Text style={styles.resumeButtonText}>Resume</Text>
                <ChevronRightIcon color={colors.neutral.surface} size={14} />
              </Pressable>
              <Pressable
                accessibilityHint="Ends the current server-backed shift while keeping saved floor templates."
                accessibilityRole="button"
                onPress={() => setEndShiftConfirmationVisible(true)}
                style={({ pressed }) => [
                  styles.endShiftButton,
                  pressed && styles.endShiftButtonPressed,
                ]}
              >
                <Text style={styles.endShiftButtonText}>End shift</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Floor Templates Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Floor Templates</Text>
          <Text style={styles.sectionCount}>{floorTemplateCount}</Text>
        </View>
        {templateEditMessage ? (
          <Text accessibilityRole="alert" style={styles.templateEditMessage}>
            {templateEditMessage}
          </Text>
        ) : null}

        {isServerWorkspaceLoading ? (
          <View style={styles.emptyState}>
            <LoadingState />
          </View>
        ) : serverWorkspaceError ? (
          <ErrorState
            message={serverWorkspaceError}
            onRetry={retryLoadWorkspace}
            title="Workspace could not load"
          />
        ) : floorTemplateCount ? (
          <View style={styles.templateList}>
            {visibleFloorTemplates.map((floorTemplate) => (
              <FloorTemplateRow
                canDelete={!visibleActiveShift}
                floorTemplate={floorTemplate}
                key={floorTemplate.id}
                onRequestDelete={setFloorTemplateToDelete}
                onPress={handleSelectTemplate}
                onStartShift={handleStartShift}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <HospitalIcon color={colors.brand.burgundy} size={28} />
            </View>
            <Text style={styles.emptyTitle}>No templates created yet</Text>
            <Text style={styles.emptyText}>
              Create a custom floor layout template to save it to this account.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable
          accessibilityHint="Opens the future nurse code entry screen."
          accessibilityRole="button"
          onPress={handleJoinActiveSession}
          style={({ pressed }) => [
            styles.secondaryActionButton,
            pressed && styles.secondaryActionButtonPressed,
          ]}
        >
          <Text style={styles.secondaryActionButtonText}>
            {activeParticipation.type === "joined_nurse"
              ? "View joined shift"
              : "Join active session"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityHint="Opens the static floor template setup path."
          accessibilityRole="button"
          onPress={handleCreateFloor}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Create floor template</Text>
        </Pressable>
      </View>

      <ConfirmationDialog
        confirmLabel="Delete"
        confirmTone="danger"
        message={
          floorTemplateToDelete
            ? `${floorTemplateToDelete.name} will be removed from this account.`
            : ""
        }
        onCancel={() => setFloorTemplateToDelete(undefined)}
        onConfirm={handleConfirmDeleteFloor}
        title="Delete floor?"
        visible={Boolean(floorTemplateToDelete)}
      />
      <ConfirmationDialog
        confirmLabel="End shift"
        confirmTone="danger"
        message={`${activeShiftFloorName} shift data will be cleared.`}
        onCancel={() => setEndShiftConfirmationVisible(false)}
        onConfirm={handleConfirmEndActiveShift}
        title="End active shift?"
        visible={endShiftConfirmationVisible}
      />
      <NotificationPermissionDialog
        onClose={() => setNotificationDialogVisible(false)}
        onRetryRegistration={retryRegistration}
        permissionStatus={permissionStatus}
        registrationState={registrationState}
        visible={notificationDialogVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.neutral.backgroundPrimary,
  },
  header: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.neutral.borderTertiary,
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    flexDirection: "row",
    minHeight: 82,
    overflow: "hidden",
  },
  brandPanel: {
    backgroundColor: colors.brand.burgundy,
    alignSelf: "stretch",
    justifyContent: "center",
    minWidth: 142,
    paddingLeft: spacing.xl,
    paddingRight: spacing.lg,
    width: 156,
  },
  brandTitle: {
    color: colors.neutral.surface,
    fontSize: textSize.md,
    fontWeight: fontWeight.heavy,
    lineHeight: 20,
  },
  accountPanel: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
    minWidth: 0,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xl,
    paddingVertical: spacing.md,
  },
  accountName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    flexShrink: 1,
    fontWeight: fontWeight.semibold,
    textAlign: "right",
  },
  notificationButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy10,
    borderRadius: radius.pill,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  notificationButtonPressed: {
    backgroundColor: colors.brand.burgundy15,
  },
  signOutButton: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  signOutButtonPressed: {
    backgroundColor: colors.neutral.backgroundSecondary,
  },
  signOutButtonText: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.xl,
    gap: spacing.cardGap,
    paddingBottom: spacing.xl * 2,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  sectionCount: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: radius.pill,
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    minWidth: 32,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: "center",
    fontWeight: fontWeight.semibold,
  },
  activeShiftCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.status.greenBorder || "#c0dd97",
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 4,
        blurRadius: 8,
        color: "rgba(59, 109, 17, 0.1)",
      },
    ],
  },
  activeShiftHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activeShiftBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeShiftPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.greenIcon || "#3b6d11",
  },
  activeShiftBadgeText: {
    color: colors.status.greenIcon || "#3b6d11",
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  activeShiftTime: {
    color: colors.neutral.textSecondary,
    fontSize: 11,
    fontWeight: fontWeight.medium,
  },
  activeShiftName: {
    color: colors.neutral.textPrimary,
    fontSize: 18,
    fontWeight: fontWeight.bold,
    marginTop: 2,
  },
  activeShiftStats: {
    color: colors.neutral.textSecondary,
    fontSize: 13,
    marginBottom: spacing.xs,
    fontWeight: fontWeight.medium,
  },
  activeShiftWarning: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  activeShiftActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  joinedShiftBadgeContainer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  joinedShiftBadgeText: {
    color: colors.brand.burgundy,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  joinedShiftButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  joinedShiftButtonPressed: {
    opacity: 0.85,
  },
  joinedShiftButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  joinedShiftCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.brand.burgundy15,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
    ...shadows.sm,
  },
  joinedShiftDetail: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  joinedShiftDot: {
    backgroundColor: colors.brand.burgundy,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  joinedShiftHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  joinedShiftMeta: {
    color: colors.neutral.textSecondary,
    fontSize: 11,
    fontWeight: fontWeight.medium,
  },
  joinedShiftName: {
    color: colors.neutral.textPrimary,
    fontSize: 18,
    fontWeight: fontWeight.bold,
    marginTop: 2,
  },
  resumeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.status.greenIcon || "#3b6d11",
    borderRadius: radius.lg,
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  resumeButtonPressed: {
    opacity: 0.85,
  },
  resumeButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  endShiftButton: {
    alignItems: "center",
    borderColor: colors.status.red700,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  endShiftButtonPressed: {
    backgroundColor: colors.status.red50,
  },
  endShiftButtonText: {
    color: colors.status.red700,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.xl,
    ...shadows.sm,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy10,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  emptyTitle: {
    color: colors.neutral.textPrimary,
    fontSize: 16,
    fontWeight: fontWeight.bold,
    textAlign: "center",
  },
  emptyText: {
    color: colors.neutral.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 260,
    textAlign: "center",
  },
  templateList: {
    gap: spacing.cardGap,
  },
  templateEditMessage: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    lineHeight: 18,
    textAlign: "center",
  },
  templateRow: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    gap: spacing.md,
    minHeight: 76,
    padding: spacing.lg,
  },
  templateRowCompact: {
    alignItems: "stretch",
    gap: spacing.sm,
  },
  templateRowPressed: {
    opacity: 0.92,
    backgroundColor: colors.neutral.backgroundTertiary,
  },
  templateAccent: {
    backgroundColor: colors.brand.burgundy,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 4,
  },
  templateMainRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    width: "100%",
  },
  templateLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  templateRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 0,
  },
  templateBadge: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy10,
    borderColor: colors.brand.burgundy15,
    borderRadius: radius.md,
    borderWidth: 0.5,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  templateBadgeText: {
    color: colors.brand.burgundy,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  templateTitleGroup: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  templateName: {
    color: colors.neutral.textPrimary,
    fontSize: 16,
    fontWeight: fontWeight.bold,
  },
  templateMetaRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  templateMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    backgroundColor: colors.neutral.backgroundTertiary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  templateMetaChipText: {
    color: colors.neutral.textSecondary,
    fontSize: 11,
    fontWeight: fontWeight.medium,
  },
  startShiftButton: {
    backgroundColor: colors.brand.burgundy10,
    borderColor: colors.brand.burgundy15,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  startShiftButtonCompact: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 52,
    minHeight: 44,
  },
  startShiftButtonPressed: {
    backgroundColor: colors.brand.burgundy15,
  },
  startShiftButtonText: {
    color: colors.brand.burgundy,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  actionBar: {
    backgroundColor: colors.neutral.backgroundPrimary,
    gap: spacing.sm,
    padding: spacing.xl,
    borderTopWidth: 0.5,
    borderTopColor: colors.neutral.borderTertiary,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.lg,
    height: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  secondaryActionButton: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  secondaryActionButtonPressed: {
    backgroundColor: colors.neutral.backgroundSecondary,
  },
  secondaryActionButtonText: {
    color: colors.brand.burgundy,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
});
