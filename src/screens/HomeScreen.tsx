import { useState } from "react";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ConfirmationDialog,
  HospitalIcon,
  SwipeRevealAction,
  TrashIcon,
  ChevronRightIcon,
  BedIcon,
  RoomIcon,
} from "../components/workflow";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { useAuthSession } from "../store/AuthSessionContext";
import { useLocalState } from "../store/LocalStateContext";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import { colors, radius, spacing, textSize, fontWeight, shadows } from "../theme/tokens";
import type { FloorTemplate } from "../types/models";
import {
  isCompletedFloorTemplate,
  createShiftFromTemplate,
  copyFloorTemplate,
  createPreviousShiftSnapshot,
} from "../helpers/shiftHelpers";

type FloorTemplateRowProps = {
  canDelete: boolean;
  floorTemplate: FloorTemplate;
  onRequestDelete: (floorTemplate: FloorTemplate) => void;
  onPress: (floorTemplate: FloorTemplate) => void;
  onStartShift: (floorTemplate: FloorTemplate) => void;
};

function FloorTemplateRow({
  canDelete,
  floorTemplate,
  onRequestDelete,
  onPress,
  onStartShift,
}: FloorTemplateRowProps) {
  const roomCount = floorTemplate.rooms.length;
  const bedCount = floorTemplate.beds.length;
  const floorInitial = floorTemplate.name.trim().charAt(0).toUpperCase() || "F";

  const rowContent = (
    <Pressable
      onPress={() => onPress(floorTemplate)}
      style={({ pressed }) => [
        styles.templateRow,
        pressed && styles.templateRowPressed,
      ]}
    >
      <View style={styles.templateAccent} />
      <View style={styles.templateLeft}>
        <View style={styles.templateBadge}>
          <Text style={styles.templateBadgeText}>{floorInitial}</Text>
        </View>
        <View style={styles.templateTitleGroup}>
          <Text style={styles.templateName}>{floorTemplate.name}</Text>
          <View style={styles.templateMetaRow}>
            <View style={styles.templateMetaChip}>
              <RoomIcon size={11} color={colors.neutral.textSecondary} />
              <Text style={styles.templateMetaChipText}>
                {roomCount} {roomCount === 1 ? "room" : "rooms"}
              </Text>
            </View>
            <View style={styles.templateMetaChip}>
              <BedIcon size={11} color={colors.neutral.textSecondary} />
              <Text style={styles.templateMetaChipText}>
                {bedCount} {bedCount === 1 ? "bed" : "beds"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.templateRight}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onStartShift(floorTemplate);
          }}
          style={({ pressed }) => [
            styles.startShiftButton,
            pressed && styles.startShiftButtonPressed,
          ]}
        >
          <Text style={styles.startShiftButtonText}>Start Shift</Text>
        </Pressable>
        <ChevronRightIcon color={colors.neutral.textTertiary} size={14} />
      </View>
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
  const { localState, savePreviousShiftSnapshot, setLocalState } =
    useLocalState();
  const { retryLoadWorkspace, workspaceState } = useServerWorkspace();
  const [floorTemplateToDelete, setFloorTemplateToDelete] =
    useState<FloorTemplate>();
  const [endShiftConfirmationVisible, setEndShiftConfirmationVisible] =
    useState(false);
  const [templateEditMessage, setTemplateEditMessage] = useState("");
  const isChargeNurseSignedIn =
    authState.status === "signed_in" && authState.profile.role === "charge_nurse";
  const isServerWorkspaceLoading =
    isChargeNurseSignedIn &&
    (workspaceState.status === "idle" || workspaceState.status === "loading");
  const serverWorkspaceError =
    workspaceState.status === "error" ? workspaceState.errorMessage : "";
  const visibleFloorTemplates = isServerWorkspaceLoading
    ? []
    : localState.floorTemplates;
  const floorTemplateCount = visibleFloorTemplates.length;

  const activeShift = isServerWorkspaceLoading
    ? undefined
    : localState.activeShift;
  const activeShiftTemplate = activeShift
    ? localState.floorTemplates.find(
        (t) => t.id === activeShift.floorTemplateId,
      )
    : null;
  const activeShiftMissingTemplate = Boolean(activeShift && !activeShiftTemplate);
  const activeShiftFloorName =
    activeShift?.floorName ?? activeShiftTemplate?.name ?? "Active Floor";
  const activeShiftNursesCount = activeShift?.nurses?.length ?? 0;
  const activeShiftPatientsCount =
    activeShift?.bedStates?.filter((bedState) =>
      bedState.patient?.initials.trim(),
    ).length ?? 0;
  const profile = authState.status === "signed_in" ? authState.profile : undefined;

  function handleCreateFloor() {
    setLocalState((currentState) => ({
      ...currentState,
      draftFloorTemplate: undefined,
    }));
    setTemplateEditMessage("");

    router.push("/floor-details");
  }

  function handleConfirmDeleteFloor() {
    if (!floorTemplateToDelete) {
      return;
    }

    setLocalState((currentState) => {
      const shouldClearActiveShift =
        currentState.activeShift?.floorTemplateId === floorTemplateToDelete.id;

      return {
        ...currentState,
        activeShift: shouldClearActiveShift
          ? undefined
          : currentState.activeShift,
        floorTemplates: currentState.floorTemplates.filter(
          (floorTemplate) => floorTemplate.id !== floorTemplateToDelete.id,
        ),
      };
    });
    setFloorTemplateToDelete(undefined);
  }

  function handleSelectTemplate(floorTemplate: FloorTemplate) {
    if (activeShift) {
      setTemplateEditMessage("End the active shift before editing templates.");
      return;
    }

    setLocalState((currentState) => ({
      ...currentState,
      draftFloorTemplate: copyFloorTemplate(floorTemplate),
    }));
    setTemplateEditMessage("");
    router.push("/template-review");
  }

  function handleStartShift(floorTemplate: FloorTemplate) {
    if (activeShift) {
      setTemplateEditMessage("End the active shift before starting another shift.");
      return;
    }

    if (!isCompletedFloorTemplate(floorTemplate)) {
      setLocalState((currentState) => ({
        ...currentState,
        draftFloorTemplate: copyFloorTemplate(floorTemplate),
      }));
      setTemplateEditMessage(
        "This saved floor needs review before it can start a shift.",
      );
      router.push("/template-review");
      return;
    }

    const hasPreviousShiftSnapshot = localState.previousShiftSnapshots.some(
      (snapshot) => snapshot.floorTemplateId === floorTemplate.id,
    );

    setLocalState((currentState) => ({
      ...currentState,
      draftFloorTemplate: undefined,
      activeShift: createShiftFromTemplate(floorTemplate),
    }));
    setTemplateEditMessage("");
    router.push(
      hasPreviousShiftSnapshot ? "/carry-over-review" : "/start-shift",
    );
  }

  async function handleConfirmEndActiveShift() {
    if (activeShift) {
      try {
        await savePreviousShiftSnapshot(createPreviousShiftSnapshot(activeShift));
      } catch {
        // Ending the shift should still work if local snapshot saving fails.
      }
    }

    setLocalState((currentState) => ({
      ...currentState,
      activeShift: undefined,
      draftFloorTemplate: undefined,
    }));
    setTemplateEditMessage("");
    setEndShiftConfirmationVisible(false);
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace("/");
  }

  function handleResumeActiveShift() {
    if (!activeShift) return;
    if (activeShift.status === "assigned") {
      router.push("/floor-board");
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
        <View style={styles.headerTitleRow}>
          <View style={styles.brandCluster}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>NF</Text>
            </View>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.title}>NurseFlow</Text>
              <Text style={styles.subtitle}>Charge nurse</Text>
            </View>
          </View>
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
        {profile ? (
          <View style={styles.accountPill}>
            <View style={styles.accountDot} />
            <Text style={styles.accountText}>{profile.displayName}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Shift Card */}
        {activeShift && (
          <View style={styles.activeShiftCard}>
            <View style={styles.activeShiftHeader}>
              <View style={styles.activeShiftBadgeContainer}>
                <View style={styles.activeShiftPulse} />
                <Text style={styles.activeShiftBadgeText}>
                  ACTIVE SHIFT IN PROGRESS
                </Text>
              </View>
              <Text style={styles.activeShiftTime}>
                {activeShift.status === "assigned" ? "Assigned" : "In Setup"}
              </Text>
            </View>
            <Text style={styles.activeShiftName}>{activeShiftFloorName}</Text>
            <Text style={styles.activeShiftStats}>
              {activeShiftNursesCount}{" "}
              {activeShiftNursesCount === 1 ? "nurse" : "nurses"} •{" "}
              {activeShiftPatientsCount}{" "}
              {activeShiftPatientsCount === 1 ? "patient" : "patients"}
            </Text>
            {activeShiftMissingTemplate ? (
              <Text accessibilityRole="alert" style={styles.activeShiftWarning}>
                Saved floor template is missing. Resume this local shift or end
                it to clear the recovered shift.
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
                accessibilityHint="Clears the current local shift but keeps saved floor templates."
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
                canDelete={false}
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
            ? `${floorTemplateToDelete.name} will be removed from this device.`
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
        message={`${activeShiftFloorName} shift data will be cleared from this local session. Saved floor templates will stay available.`}
        onCancel={() => setEndShiftConfirmationVisible(false)}
        onConfirm={handleConfirmEndActiveShift}
        title="End active shift?"
        visible={endShiftConfirmationVisible}
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
    backgroundColor: colors.neutral.surface,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.neutral.borderTertiary,
  },
  headerTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  brandCluster: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.md,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  brandMarkText: {
    color: colors.neutral.surface,
    fontSize: textSize.sm,
    fontWeight: fontWeight.heavy,
  },
  headerTitleGroup: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: 21,
    fontWeight: fontWeight.heavy,
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  accountPill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  accountDot: {
    backgroundColor: colors.status.greenIcon,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  accountText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
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
    boxShadow: [{
      offsetX: 0,
      offsetY: 4,
      blurRadius: 8,
      color: "rgba(59, 109, 17, 0.1)",
    }],
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
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: 76,
    padding: spacing.lg,
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
  templateLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  templateRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
  },
  templateName: {
    color: colors.neutral.textPrimary,
    fontSize: 16,
    fontWeight: fontWeight.bold,
  },
  templateMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  templateMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
});
