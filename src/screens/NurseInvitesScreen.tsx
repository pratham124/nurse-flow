import { useCallback, useEffect, useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import {
  BoardSubTabBar,
  ConfirmationDialog,
  CopyIcon,
  PlaceholderButton,
  ShareIcon,
  SummaryChip,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import {
  generateShiftNurseInviteCode,
  getShiftNurseInviteCodeHash,
  loadShiftNurseAccessForActiveShift,
  loadShiftNurseInvitesForActiveShift,
  regenerateShiftNurseInviteCode,
  type GeneratedShiftNurseInviteCode,
} from "../services/shiftInviteRepository";
import { getSupabaseClient } from "../services/supabaseClient";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import { colors, fontWeight, radius, shadows, spacing, textSize } from "../theme/tokens";
import type {
  ActiveShiftRecord,
  Nurse,
  ShiftNurseAccess,
  ShiftNurseInviteRecord,
  UserProfile,
} from "../types/models";
import { getNurseAssignedPatientCount } from "../utils/nurseInviteEligibility";
import { assignmentFlow } from "../utils/workflowFlows";

type InviteScreenWorkspace = {
  activeShift?: ActiveShiftRecord;
  profile?: UserProfile;
};

type LoadStatus = "idle" | "loading" | "ready" | "error";

type GeneratedInviteCodeState = {
  code: string;
  inviteId: string;
};

type NurseInviteRowProps = {
  access?: ShiftNurseAccess;
  actionMessage?: string;
  assignedPatientCount: number;
  busy: boolean;
  generatedCode?: GeneratedInviteCodeState;
  invite?: ShiftNurseInviteRecord;
  nurse: Nurse;
  onCopy: (nurseId: string) => void;
  onGenerate: (nurseId: string) => void;
  onRegenerate: (nurseId: string) => void;
  onShare: (nurseId: string) => void;
};

type InviteActionIconButtonProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: "copy" | "share";
  onPress?: () => void;
  variant?: "primary" | "secondary";
};

type NurseInvitesHeaderProps = {
  activeShift: ActiveShiftRecord;
  errorMessage: string;
  loadStatus: LoadStatus;
  onRefresh: () => void;
};

const activeInviteExpirationText =
  "Invite codes expire after 24 hours or when this active shift ends.";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getInviteWorkspace(
  workspaceState: ReturnType<typeof useServerWorkspace>["workspaceState"],
): InviteScreenWorkspace {
  if (workspaceState.status !== "ready" && workspaceState.status !== "empty") {
    return {};
  }

  return {
    activeShift: workspaceState.workspace.activeShift,
    profile: workspaceState.workspace.profile,
  };
}

function getActiveInviteForNurse(
  invites: ShiftNurseInviteRecord[],
  nurseId: string,
) {
  return invites.find(
    (invite) => invite.nurseId === nurseId && invite.status === "active",
  );
}

function getAccessForNurse(accessRecords: ShiftNurseAccess[], nurseId: string) {
  return accessRecords.find((access) => access.nurseId === nurseId);
}

function formatExpiration(expiresAt?: string) {
  if (!expiresAt) {
    return "No active invite";
  }

  const expiresAtMs = Date.parse(expiresAt);

  if (Number.isNaN(expiresAtMs)) {
    return "Expiration unavailable";
  }

  return `Expires ${new Date(expiresAtMs).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

function getInviteStatusLabel(invite?: ShiftNurseInviteRecord) {
  if (!invite) {
    return "No invite";
  }

  if (invite.status === "active" && Date.parse(invite.expiresAt) <= Date.now()) {
    return "Expired";
  }

  if (invite.status === "active") {
    return "Active invite";
  }

  if (invite.status === "used") {
    return "Used";
  }

  if (invite.status === "revoked") {
    return "Revoked";
  }

  return "Expired";
}

function getJoinedStatusLabel(access?: ShiftNurseAccess) {
  if (!access) {
    return "Not joined";
  }

  if (access.status === "linked") {
    return "Joined";
  }

  if (access.status === "pending_link") {
    return "Pending";
  }

  return "Removed";
}

function getExperienceLabel(nurse: Nurse) {
  if (nurse.experienceLevel === "new_grad") {
    return "New grad";
  }

  if (nurse.experienceLevel === "mid") {
    return "Mid";
  }

  return "Experienced";
}

function getNurseInviteKey(nurse: Nurse) {
  return nurse.id;
}

function NurseInvitesHeader({
  activeShift,
  errorMessage,
  loadStatus,
  onRefresh,
}: NurseInvitesHeaderProps) {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection title="Invite summary">
        <View style={styles.summaryTopRow}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryEyebrow}>Active shift</Text>
            <Text style={styles.summaryTitle}>
              {activeShift.shiftSnapshot.floorName}
            </Text>
          </View>
          <SummaryChip label={`${activeShift.shiftSnapshot.nurses.length} nurses`} />
        </View>
        <Text style={styles.summaryText}>{activeInviteExpirationText}</Text>
        {loadStatus === "loading" ? (
          <LoadingState message="Loading invite status" />
        ) : null}
        {errorMessage ? (
          <ErrorState
            message={errorMessage}
            onRetry={onRefresh}
            retryLabel="Refresh"
            title="Invite status could not load"
          />
        ) : null}
      </WorkflowSection>
    </View>
  );
}

function NurseInviteRow({
  access,
  actionMessage,
  assignedPatientCount,
  busy,
  generatedCode,
  invite,
  nurse,
  onCopy,
  onGenerate,
  onRegenerate,
  onShare,
}: NurseInviteRowProps) {
  const canCopyOrShare = Boolean(generatedCode?.code);
  const canGenerateCode = assignedPatientCount > 0;
  const hasActiveInvite = invite?.status === "active";
  const shouldShowStoredCodeNotice = hasActiveInvite && !generatedCode;

  return (
    <View style={styles.nurseRow}>
      <View style={styles.nurseTopRow}>
        <View style={styles.nurseIdentity}>
          <Text style={styles.nurseName}>{nurse.name}</Text>
          <Text style={styles.nurseMeta}>
            {nurse.licenseType} - {getExperienceLabel(nurse)}
          </Text>
        </View>
        <View style={styles.statusStack}>
          <SummaryChip
            label={`${assignedPatientCount} ${
              assignedPatientCount === 1 ? "patient" : "patients"
            }`}
          />
          <SummaryChip label={getJoinedStatusLabel(access)} />
          <SummaryChip label={getInviteStatusLabel(invite)} />
        </View>
      </View>

      <Text style={styles.expirationText}>{formatExpiration(invite?.expiresAt)}</Text>

      {generatedCode ? (
        <InviteCodeCells code={generatedCode.code} />
      ) : shouldShowStoredCodeNotice ? (
        <HiddenCodeNotice />
      ) : (
        <Text style={styles.helperText}>
          {canGenerateCode
            ? "Generate a code when this nurse is ready to join the active shift."
            : "Assign at least one patient before generating a join code."}
        </Text>
      )}

      {actionMessage ? (
        <Text style={styles.actionMessage}>{actionMessage}</Text>
      ) : null}

      <View style={styles.actionRow}>
        {generatedCode ? (
          <>
            <InviteActionIconButton
              accessibilityLabel="Copy invite code"
              disabled={!canCopyOrShare}
              icon="copy"
              onPress={() => onCopy(nurse.id)}
            />
            <InviteActionIconButton
              accessibilityLabel="Share invite code"
              disabled={!canCopyOrShare}
              icon="share"
              onPress={() => onShare(nurse.id)}
            />
            <PlaceholderButton
              label={
                canGenerateCode
                  ? busy
                    ? "Regenerating"
                    : "Regenerate"
                  : "No patients assigned"
              }
              onPress={
                busy || !canGenerateCode
                  ? undefined
                  : () => onRegenerate(nurse.id)
              }
            />
          </>
        ) : hasActiveInvite ? (
          <PlaceholderButton
            label={
              canGenerateCode
                ? busy
                  ? "Regenerating"
                  : "Regenerate code"
                : "No patients assigned"
            }
            onPress={
              busy || !canGenerateCode
                ? undefined
                : () => onRegenerate(nurse.id)
            }
            variant="primary"
          />
        ) : (
          <PlaceholderButton
            label={
              canGenerateCode
                ? busy
                  ? "Generating"
                  : "Generate code"
                : "No patients assigned"
            }
            onPress={
              busy || !canGenerateCode
                ? undefined
                : () => onGenerate(nurse.id)
            }
            variant="primary"
          />
        )}
      </View>
    </View>
  );
}

function InviteActionIconButton({
  accessibilityLabel,
  disabled = false,
  icon,
  onPress,
  variant = "secondary",
}: InviteActionIconButtonProps) {
  const isPrimary = variant === "primary";
  const iconColor = disabled
    ? colors.neutral.textTertiary
    : isPrimary
      ? colors.neutral.surface
      : colors.brand.burgundy;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        isPrimary ? styles.primaryIconButton : styles.secondaryIconButton,
        disabled ? styles.disabledIconButton : null,
        pressed && !disabled ? styles.pressedIconButton : null,
      ]}
    >
      {icon === "copy" ? (
        <CopyIcon color={iconColor} size={18} />
      ) : (
        <ShareIcon color={iconColor} size={18} />
      )}
    </Pressable>
  );
}

function HiddenCodeNotice() {
  return (
    <View style={styles.hiddenCodeBox}>
      <View style={styles.hiddenCodeCells}>
        {Array.from({ length: 6 }).map((_, index) => (
          <View key={`hidden-code-${index}`} style={styles.hiddenCodeCell}>
            <Text style={styles.hiddenCodeCellText}>-</Text>
          </View>
        ))}
      </View>
      <Text style={styles.hiddenCodeTitle}>Code already generated</Text>
      <Text style={styles.hiddenCodeText}>
        Existing codes are not shown again. Regenerate when you need a fresh
        copyable code.
      </Text>
    </View>
  );
}

function InviteCodeCells({ code }: { code: string }) {
  return (
    <View accessibilityLabel={`Nurse code ${code}`} style={styles.codeRow}>
      {code.split("").map((character, index) => (
        <View key={`${character}-${index}`} style={styles.codeCell}>
          <Text selectable style={styles.codeCellText}>
            {character}
          </Text>
        </View>
      ))}
    </View>
  );
}

function EmptyNurseList() {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>No nurses yet</Text>
      <Text style={styles.emptyText}>
        Add nurses to the active shift before creating invite codes.
      </Text>
    </View>
  );
}

export default function NurseInvitesScreen() {
  const {
    effectiveAssignmentResult,
    retryLoadWorkspace,
    workspaceState,
  } = useServerWorkspace();
  const { activeShift, profile } = getInviteWorkspace(workspaceState);
  const [inviteRecords, setInviteRecords] = useState<ShiftNurseInviteRecord[]>(
    [],
  );
  const [accessRecords, setAccessRecords] = useState<ShiftNurseAccess[]>([]);
  const [generatedCodes, setGeneratedCodes] = useState<
    Record<string, GeneratedInviteCodeState>
  >({});
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [loadErrorMessage, setLoadErrorMessage] = useState("");
  const [actionMessageByNurseId, setActionMessageByNurseId] = useState<
    Record<string, string>
  >({});
  const [actionErrorMessage, setActionErrorMessage] = useState("");
  const [busyNurseId, setBusyNurseId] = useState<string>();
  const [confirmRegenerateNurseId, setConfirmRegenerateNurseId] =
    useState<string>();
  const nurses = useMemo(
    () => activeShift?.shiftSnapshot.nurses ?? [],
    [activeShift],
  );

  const inviteRows = useMemo(
    () =>
      nurses.map((nurse) => ({
        access: getAccessForNurse(accessRecords, nurse.id),
        assignedPatientCount: getNurseAssignedPatientCount(
          activeShift?.shiftSnapshot,
          effectiveAssignmentResult,
          nurse.id,
        ),
        invite: getActiveInviteForNurse(inviteRecords, nurse.id),
        nurse,
      })),
    [
      accessRecords,
      activeShift?.shiftSnapshot,
      effectiveAssignmentResult,
      inviteRecords,
      nurses,
    ],
  );

  const refreshInviteData = useCallback(async () => {
    if (!activeShift || !profile) {
      setInviteRecords([]);
      setAccessRecords([]);
      setLoadStatus("ready");
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setLoadErrorMessage("Supabase is not configured yet.");
      setLoadStatus("error");
      return;
    }

    setLoadErrorMessage("");
    setLoadStatus("loading");

    try {
      const [loadedInvites, loadedAccess] = await Promise.all([
        loadShiftNurseInvitesForActiveShift(supabase, profile, activeShift),
        loadShiftNurseAccessForActiveShift(supabase, profile, activeShift),
      ]);

      setInviteRecords(loadedInvites);
      setAccessRecords(loadedAccess);
      setLoadStatus("ready");
    } catch (error) {
      setLoadErrorMessage(
        getErrorMessage(error, "Invite status could not be loaded."),
      );
      setLoadStatus("error");
    }
  }, [activeShift, profile]);

  useEffect(() => {
    void refreshInviteData();
  }, [refreshInviteData]);

  function getGeneratedCode(nurseId: string) {
    return generatedCodes[nurseId]?.code;
  }

  function applyGeneratedCode(result: GeneratedShiftNurseInviteCode) {
    setGeneratedCodes((currentCodes) => ({
      ...currentCodes,
      [result.invite.nurseId]: {
        code: result.code,
        inviteId: result.invite.id,
      },
    }));
    setActionMessageByNurseId((currentMessages) => ({
      ...currentMessages,
      [result.invite.nurseId]: "Invite code is ready.",
    }));
  }

  async function runInviteAction(
    nurseId: string,
    action: () => Promise<GeneratedShiftNurseInviteCode>,
  ) {
    setActionErrorMessage("");
    setBusyNurseId(nurseId);

    try {
      const result = await action();

      applyGeneratedCode(result);
      await refreshInviteData();
    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error, "Invite code could not be generated."),
      );
    } finally {
      setBusyNurseId(undefined);
    }
  }

  function handleGenerate(nurseId: string) {
    if (!activeShift || !profile) {
      setActionErrorMessage("Start an active shift before generating invites.");
      return;
    }

    if (
      getNurseAssignedPatientCount(
        activeShift.shiftSnapshot,
        effectiveAssignmentResult,
        nurseId,
      ) === 0
    ) {
      setActionErrorMessage(
        "Assign at least one patient to this nurse before generating a code.",
      );
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setActionErrorMessage("Supabase is not configured yet.");
      return;
    }

    void runInviteAction(nurseId, () =>
      generateShiftNurseInviteCode(supabase, profile, {
        activeShift,
        getTokenHash: getShiftNurseInviteCodeHash,
        nurseId,
      }),
    );
  }

  function handleRegenerate(nurseId: string) {
    if (
      !activeShift ||
      getNurseAssignedPatientCount(
        activeShift.shiftSnapshot,
        effectiveAssignmentResult,
        nurseId,
      ) === 0
    ) {
      setActionErrorMessage(
        "Assign at least one patient to this nurse before generating a code.",
      );
      return;
    }

    setConfirmRegenerateNurseId(nurseId);
  }

  function handleConfirmRegenerate() {
    const nurseId = confirmRegenerateNurseId;

    setConfirmRegenerateNurseId(undefined);

    if (!nurseId) {
      return;
    }

    if (!activeShift || !profile) {
      setActionErrorMessage("Start an active shift before regenerating invites.");
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setActionErrorMessage("Supabase is not configured yet.");
      return;
    }

    void runInviteAction(nurseId, () =>
      regenerateShiftNurseInviteCode(supabase, profile, {
        activeShift,
        getTokenHash: getShiftNurseInviteCodeHash,
        nurseId,
      }),
    );
  }

  async function handleCopy(nurseId: string) {
    const code = getGeneratedCode(nurseId);

    if (!code) {
      return;
    }

    await Clipboard.setStringAsync(code);
    setActionMessageByNurseId((currentMessages) => ({
      ...currentMessages,
      [nurseId]: "Invite code copied.",
    }));
  }

  async function handleShare(nurseId: string) {
    const code = getGeneratedCode(nurseId);

    if (!code) {
      return;
    }

    await Share.share({
      message: `NurseFlow code: ${code}`,
      title: "NurseFlow nurse code",
    });
    setActionMessageByNurseId((currentMessages) => ({
      ...currentMessages,
      [nurseId]: "Share sheet opened.",
    }));
  }

  if (workspaceState.status === "idle" || workspaceState.status === "loading") {
    return (
      <WorkflowListScreen
        activeStep="Board"
        data={[]}
        flow={assignmentFlow}
        bottomAccessory={<BoardSubTabBar activeTab="invites" />}
        headerActionLabel="Floor board"
        keyExtractor={() => "loading"}
        listHeader={<LoadingState message="Loading workspace" />}
        onHeaderActionPress={() => router.push("/floor-board")}
        renderItem={() => null}
        subtitle=""
        title="Nurse invites"
      />
    );
  }

  if (workspaceState.status === "error") {
    return (
      <WorkflowListScreen
        activeStep="Board"
        data={[]}
        flow={assignmentFlow}
        bottomAccessory={<BoardSubTabBar activeTab="invites" />}
        headerActionLabel="Floor board"
        keyExtractor={() => "error"}
        listHeader={
          <ErrorState
            message={workspaceState.errorMessage}
            onRetry={retryLoadWorkspace}
            title="Workspace could not load"
          />
        }
        onHeaderActionPress={() => router.push("/floor-board")}
        renderItem={() => null}
        subtitle=""
        title="Nurse invites"
      />
    );
  }

  if (!activeShift) {
    return (
      <WorkflowListScreen
        activeStep="Board"
        data={[]}
        flow={assignmentFlow}
        bottomAccessory={<BoardSubTabBar activeTab="invites" />}
        headerActionLabel="Floors"
        keyExtractor={() => "empty"}
        listHeader={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No active shift</Text>
            <Text style={styles.emptyText}>
              Start a server-backed active shift before creating nurse invite
              codes.
            </Text>
          </View>
        }
        onHeaderActionPress={() => router.push("/")}
        renderItem={() => null}
        subtitle=""
        title="Nurse invites"
      />
    );
  }

  return (
    <>
      <WorkflowListScreen
        activeStep="Board"
        data={inviteRows}
        flow={assignmentFlow}
        bottomAccessory={<BoardSubTabBar activeTab="invites" />}
        headerActionLabel="Floor board"
        keyExtractor={({ nurse }) => getNurseInviteKey(nurse)}
        listHeader={
          <NurseInvitesHeader
            activeShift={activeShift}
            errorMessage={loadErrorMessage || actionErrorMessage}
            loadStatus={loadStatus}
            onRefresh={refreshInviteData}
          />
        }
        ListEmptyComponent={<EmptyNurseList />}
        onHeaderActionPress={() => router.push("/floor-board")}
        renderItem={({ item }) => (
          <NurseInviteRow
            access={item.access}
            actionMessage={actionMessageByNurseId[item.nurse.id]}
            assignedPatientCount={item.assignedPatientCount}
            busy={busyNurseId === item.nurse.id}
            generatedCode={generatedCodes[item.nurse.id]}
            invite={item.invite}
            nurse={item.nurse}
            onCopy={handleCopy}
            onGenerate={handleGenerate}
            onRegenerate={handleRegenerate}
            onShare={handleShare}
          />
        )}
        subtitle=""
        title="Nurse invites"
      />

      <ConfirmationDialog
        confirmLabel="Regenerate"
        message="This will revoke the current active invite code for this nurse and create a new one. Already linked nurse access stays in place."
        onCancel={() => setConfirmRegenerateNurseId(undefined)}
        onConfirm={handleConfirmRegenerate}
        title="Regenerate invite code?"
        visible={Boolean(confirmRegenerateNurseId)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  summaryTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  summaryCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  summaryEyebrow: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  summaryTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  summaryText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  nurseRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  nurseTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  nurseIdentity: {
    flex: 1,
    gap: spacing.xs,
  },
  nurseName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  nurseMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  statusStack: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  expirationText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  helperText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  hiddenCodeBox: {
    backgroundColor: colors.status.blue50,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.sm,
    padding: spacing.md,
  },
  hiddenCodeCells: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  hiddenCodeCell: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  hiddenCodeCellText: {
    color: colors.neutral.textTertiary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  hiddenCodeTitle: {
    color: colors.status.blue800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  hiddenCodeText: {
    color: colors.status.blue800,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  codeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  codeCell: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.brand.burgundy,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flex: 1,
    height: 54,
    justifyContent: "center",
    minWidth: 0,
    ...shadows.sm,
  },
  codeCellText: {
    color: colors.brand.burgundy,
    fontSize: textSize.lg,
    fontWeight: fontWeight.heavy,
  },
  actionMessage: {
    color: colors.status.green800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "flex-start",
  },
  iconButton: {
    alignItems: "center",
    borderRadius: radius.lg,
    height: 48,
    justifyContent: "center",
    width: 48,
    ...shadows.sm,
  },
  primaryIconButton: {
    backgroundColor: colors.brand.burgundy,
    borderColor: colors.brand.burgundy,
    borderWidth: 0.5,
  },
  secondaryIconButton: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderWidth: 0.5,
  },
  disabledIconButton: {
    opacity: 0.48,
  },
  pressedIconButton: {
    opacity: 0.78,
  },
  emptyCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.sm,
    padding: spacing.lg,
    ...shadows.sm,
  },
  emptyTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
    textAlign: "center",
  },
  emptyText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
    textAlign: "center",
  },
});
