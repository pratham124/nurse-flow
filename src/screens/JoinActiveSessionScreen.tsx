import { useEffect, useMemo, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LoadingState } from "../components/LoadingState";
import {
  acceptShiftNurseInviteCode,
  getNurseInviteCodeFormatMessage,
  validateShiftNurseInviteCode,
  type ShiftNurseInviteValidationResult,
} from "../services/shiftInviteRepository";
import { getSupabaseClient } from "../services/supabaseClient";
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

type ValidationState =
  | { status: "idle" }
  | { status: "auth_required" }
  | { message: string; status: "blocked" }
  | { message: string; status: "error"; title?: string }
  | {
      result: Extract<ShiftNurseInviteValidationResult, { status: "valid" }>;
      status: "valid";
    };

type CodeCellsProps = {
  code: string;
  onChangeText: (value: string) => void;
};

type MessageBoxProps = {
  message: string;
  title: string;
  variant: "info" | "error" | "success";
};

type JoinConfirmationProps = {
  result: Extract<ShiftNurseInviteValidationResult, { status: "valid" }>;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getActiveParticipationMessage(
  activeParticipation: ReturnType<typeof useServerWorkspace>["activeParticipation"],
  result: Extract<ShiftNurseInviteValidationResult, { status: "valid" }>,
) {
  if (activeParticipation.type === "none") {
    return "";
  }

  if (activeParticipation.type === "charge_shift") {
    return "End your active charge shift before joining as a nurse.";
  }

  if (activeParticipation.shiftId !== result.shiftId) {
    return "This account is already linked to another active shift.";
  }

  if (activeParticipation.nurseId !== result.nurseId) {
    return "This account is already linked to a different nurse in this shift.";
  }

  return "This account already has nurse access for this shift.";
}

function CodeCells({ code, onChangeText }: CodeCellsProps) {
  const inputRef = useRef<TextInput>(null);
  const paddedCode = code.padEnd(6, "-").slice(0, 6);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Nurse code"
      onPress={() => inputRef.current?.focus()}
      style={styles.codeInputWrapper}
    >
      <View style={styles.codeRow}>
        {paddedCode.split("").map((character, index) => (
          <View key={`code-cell-${index}`} style={styles.codeCell}>
            <Text style={styles.codeCellText}>{character}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        accessibilityLabel="Nurse code entry"
        autoCapitalize="characters"
        autoCorrect={false}
        caretHidden
        maxLength={6}
        onChangeText={onChangeText}
        style={styles.hiddenCodeInput}
        value={code}
      />
    </Pressable>
  );
}

function MessageBox({ message, title, variant }: MessageBoxProps) {
  return (
    <View
      style={[
        styles.messageBox,
        variant === "error" ? styles.errorBox : null,
        variant === "success" ? styles.successBox : null,
      ]}
    >
      <Text
        style={[
          styles.messageTitle,
          variant === "error" ? styles.errorText : null,
          variant === "success" ? styles.successText : null,
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.helperText,
          variant === "error" ? styles.errorText : null,
          variant === "success" ? styles.successText : null,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

function JoinConfirmation({ result }: JoinConfirmationProps) {
  return (
    <View style={styles.confirmationBox}>
      <Text style={styles.confirmationEyebrow}>Code validated</Text>
      <Text style={styles.confirmationTitle}>{result.nurseName}</Text>
      <Text style={styles.confirmationText}>{result.floorName}</Text>
      <Text style={styles.helperText}>
        Joining opens only the invited nurse assignment for this active shift.
      </Text>
    </View>
  );
}

export default function JoinActiveSessionScreen() {
  const params = useLocalSearchParams();
  const initialCode = getSingleParam(params.code);
  const { authState } = useAuthSession();
  const { activeParticipation, retryLoadJoinedNurseAccess } =
    useServerWorkspace();
  const [nurseCode, setNurseCode] = useState(() => (initialCode ?? "").slice(0, 6));
  const [validationState, setValidationState] = useState<ValidationState>({
    status: "idle",
  });
  const [showFormatMessage, setShowFormatMessage] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const formatMessage = useMemo(
    () => getNurseInviteCodeFormatMessage(nurseCode),
    [nurseCode],
  );
  const shouldShowFormatMessage =
    showFormatMessage && validationState.status !== "valid" && Boolean(formatMessage);
  const isCodeReady = !formatMessage;
  const isSignedOut = authState.status === "signed_out";

  useEffect(() => {
    if (initialCode) {
      setNurseCode(initialCode.slice(0, 6));
    }
  }, [initialCode]);

  function handleBack() {
    router.replace("/");
  }

  function handleCodeChange(value: string) {
    setNurseCode(value.slice(0, 6));
    setValidationState({ status: "idle" });
  }

  function handleAuthRoute(pathname: "/login" | "/signup") {
    router.push({
      pathname,
      params: {
        code: nurseCode,
        returnTo: "/join-active-session",
      },
    });
  }

  async function handleValidateCode() {
    setShowFormatMessage(true);

    if (formatMessage) {
      setValidationState({ status: "idle" });
      return;
    }

    if (authState.status === "checking") {
      setValidationState({
        message: "Checking your account session. Try again in a moment.",
        status: "error",
      });
      return;
    }

    if (isSignedOut) {
      setValidationState({ status: "auth_required" });
      return;
    }

    if (authState.status !== "signed_in") {
      setValidationState({
        message: authState.errorMessage ?? "Finish account setup before joining.",
        status: "error",
      });
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setValidationState({
        message: "Supabase is not configured yet.",
        status: "error",
      });
      return;
    }

    setIsValidating(true);
    setValidationState({ status: "idle" });

    try {
      const result = await validateShiftNurseInviteCode(
        supabase,
        nurseCode,
      );

      if (result.status === "blocked") {
        setValidationState({
          message: result.message,
          status: "blocked",
        });
        return;
      }

      const participationMessage = getActiveParticipationMessage(
        activeParticipation,
        result,
      );

      if (participationMessage) {
        setValidationState({
          message: participationMessage,
          status: "blocked",
        });
        return;
      }

      setValidationState({
        result,
        status: "valid",
      });
    } catch (error) {
      setValidationState({
        message: getErrorMessage(error, "The nurse code could not be checked."),
        status: "error",
      });
    } finally {
      setIsValidating(false);
    }
  }

  async function handleJoinShift() {
    if (validationState.status !== "valid") {
      return;
    }

    if (authState.status !== "signed_in") {
      setValidationState({
        message: "Sign in before joining this shift.",
        status: "error",
        title: "Join failed",
      });
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setValidationState({
        message: "Supabase is not configured yet.",
        status: "error",
        title: "Join failed",
      });
      return;
    }

    setIsJoining(true);

    try {
      const result = await acceptShiftNurseInviteCode(supabase, nurseCode);

      if (result.status === "blocked") {
        setValidationState({
          message: result.message,
          status: "blocked",
        });
        return;
      }

      await retryLoadJoinedNurseAccess();
      router.replace("/regular-nurse-workspace");
    } catch (error) {
      setValidationState({
        message: getErrorMessage(error, "This nurse code could not be joined."),
        status: "error",
        title: "Join failed",
      });
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable
            accessibilityRole="button"
            onPress={handleBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>Join active session</Text>
          <Text style={styles.subtitle}>
            Enter the nurse code from charge. The app validates the code before
            showing any shift details.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.label}>Nurse code</Text>
            <Text style={styles.panelMeta}>6 characters</Text>
          </View>

          <CodeCells code={nurseCode} onChangeText={handleCodeChange} />

          {shouldShowFormatMessage ? (
            <MessageBox
              message={formatMessage}
              title="Check the code"
              variant="error"
            />
          ) : null}

          {isValidating || isJoining ? (
            <View style={styles.loadingBox}>
              <LoadingState
                message={isJoining ? "Joining shift" : "Checking nurse code"}
              />
            </View>
          ) : null}

          {validationState.status === "auth_required" ? (
            <View style={styles.authBox}>
              <MessageBox
                message="Sign in or create an account, then return here with this code."
                title="Account needed"
                variant="info"
              />
              <View style={styles.authActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleAuthRoute("/login")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Sign in</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleAuthRoute("/signup")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Create account</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {validationState.status === "blocked" ? (
            <MessageBox
              message={validationState.message}
              title="Cannot join with this code"
              variant="error"
            />
          ) : null}

          {validationState.status === "error" ? (
            <MessageBox
              message={validationState.message}
              title={validationState.title ?? "Code check failed"}
              variant="error"
            />
          ) : null}

          {validationState.status === "valid" ? (
            <JoinConfirmation result={validationState.result} />
          ) : null}

          {validationState.status === "idle" && !shouldShowFormatMessage ? (
            <MessageBox
              message="Only the nurse name and floor name appear after validation. Patient data waits until the join step."
              title="Safe preview"
              variant="info"
            />
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled: isValidating || isJoining,
          }}
          disabled={isValidating || isJoining}
          onPress={
            validationState.status === "valid"
              ? handleJoinShift
              : handleValidateCode
          }
          style={({ pressed }) => [
            styles.primaryButton,
            (!isCodeReady || isValidating || isJoining) &&
              styles.primaryButtonMuted,
            pressed && !isValidating && !isJoining
              ? styles.primaryButtonPressed
              : null,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {validationState.status === "valid"
              ? isJoining
                ? "Joining"
                : "Join shift"
              : isValidating
                ? "Checking"
                : isSignedOut && isCodeReady
                  ? "Continue"
                  : "Validate code"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.neutral.backgroundPrimary,
    flex: 1,
  },
  header: {
    backgroundColor: colors.neutral.surface,
    borderBottomColor: colors.neutral.borderTertiary,
    borderBottomWidth: 0.5,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  headerTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing.lg,
  },
  backButtonPressed: {
    opacity: 0.82,
  },
  backButtonText: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  titleGroup: {
    gap: spacing.sm,
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.xl,
    fontWeight: fontWeight.heavy,
    lineHeight: 32,
  },
  subtitle: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.md,
    fontWeight: fontWeight.medium,
    lineHeight: 20,
  },
  content: {
    padding: spacing.xl,
  },
  panel: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.lg,
    padding: spacing.xl,
    ...shadows.sm,
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  label: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  panelMeta: {
    color: colors.neutral.textTertiary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.semibold,
  },
  codeInputWrapper: {
    minHeight: 52,
  },
  codeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  codeCell: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundTertiary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    height: 52,
    justifyContent: "center",
    minWidth: 0,
  },
  codeCellText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  hiddenCodeInput: {
    height: 1,
    opacity: 0,
    position: "absolute",
    width: 1,
  },
  messageBox: {
    backgroundColor: colors.status.blue50,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.md,
  },
  errorBox: {
    backgroundColor: colors.status.red50,
  },
  successBox: {
    backgroundColor: colors.status.green50,
  },
  messageTitle: {
    color: colors.status.blue800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  helperText: {
    color: colors.status.blue800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  errorText: {
    color: colors.status.red700,
  },
  successText: {
    color: colors.status.green800,
  },
  loadingBox: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  authBox: {
    gap: spacing.md,
  },
  authActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  confirmationBox: {
    backgroundColor: colors.status.green50,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.md,
  },
  confirmationEyebrow: {
    color: colors.status.green800,
    fontSize: textSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
  },
  confirmationTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  confirmationText: {
    color: colors.status.green800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  actionBar: {
    backgroundColor: colors.neutral.backgroundPrimary,
    borderTopColor: colors.neutral.borderTertiary,
    borderTopWidth: 0.5,
    padding: spacing.xl,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.lg,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryButtonMuted: {
    opacity: 0.72,
  },
  primaryButtonPressed: {
    opacity: 0.82,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
});
