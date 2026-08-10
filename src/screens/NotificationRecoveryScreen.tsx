import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LoadingState } from "../components/LoadingState";
import {
  useNotificationTap,
  type NotificationTapRecoveryReason,
} from "../store/NotificationTapContext";
import {
  colors,
  fontWeight,
  radius,
  shadows,
  spacing,
  textSize,
} from "../theme/tokens";

type RecoveryCopy = {
  message: string;
  title: string;
};

const recoveryCopy: Record<
  Exclude<NotificationTapRecoveryReason, "idle" | "loading">,
  RecoveryCopy
> = {
  access_removed: {
    message:
      "This account is no longer linked to that nurse assignment. Ask charge for new access if you still need it.",
    title: "Access removed",
  },
  malformed: {
    message:
      "This notification did not include a safe NurseFlow destination. Return home and open your current workspace instead.",
    title: "Notification unavailable",
  },
  refresh_failed: {
    message:
      "NurseFlow could not confirm the current server state. Check your connection and try again.",
    title: "Update could not open",
  },
  request_missing: {
    message:
      "That request is no longer available in the current shift. Return to your current workspace to review the latest requests.",
    title: "Request unavailable",
  },
  shift_ended: {
    message:
      "The shift linked to this notification has ended. No protected shift details were opened.",
    title: "Shift ended",
  },
  signed_out: {
    message:
      "Sign in first so NurseFlow can confirm that you still have access to this update.",
    title: "Sign in to continue",
  },
};

export default function NotificationRecoveryScreen() {
  const { recoveryReason, retryNotificationTap } = useNotificationTap();
  const isLoading = recoveryReason === "loading";
  const copy = isLoading
    ? undefined
    : recoveryReason === "idle"
      ? recoveryCopy.malformed
      : recoveryCopy[recoveryReason];
  const canRetry =
    recoveryReason === "shift_ended" ||
    recoveryReason === "access_removed" ||
    recoveryReason === "request_missing" ||
    recoveryReason === "refresh_failed";

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        {isLoading ? (
          <LoadingState message="Checking current server state" />
        ) : (
          <>
            <Text style={styles.eyebrow}>Notification recovery</Text>
            <Text style={styles.title}>{copy?.title}</Text>
            <Text accessibilityRole="alert" style={styles.message}>
              {copy?.message}
            </Text>

            {recoveryReason === "signed_out" ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/login")}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>Sign in</Text>
              </Pressable>
            ) : null}

            {canRetry ? (
              <Pressable
                accessibilityRole="button"
                onPress={retryNotificationTap}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>Check again</Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/")}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Return home</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundPrimary,
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    maxWidth: 380,
    padding: spacing.xl,
    width: "100%",
    ...shadows.sm,
  },
  eyebrow: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
    textAlign: "center",
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.xl,
    fontWeight: fontWeight.heavy,
    textAlign: "center",
  },
  message: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.md,
    fontWeight: fontWeight.medium,
    lineHeight: 20,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.lg,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  secondaryButtonText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
});
