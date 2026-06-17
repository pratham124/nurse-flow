import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthSession } from "../store/AuthSessionContext";
import {
  colors,
  fontWeight,
  radius,
  shadows,
  spacing,
  textSize,
} from "../theme/tokens";

type SessionLoadingScreenProps = {
  message?: string;
};

type SessionRecoveryScreenProps = {
  message: string;
  title: string;
};

export function SessionLoadingScreen({
  message = "Checking session",
}: SessionLoadingScreenProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.centerCard}>
        <ActivityIndicator color={colors.brand.burgundy} />
        <Text style={styles.title}>NurseFlow</Text>
      </View>
    </SafeAreaView>
  );
}

export function SessionRecoveryScreen({
  message,
  title,
}: SessionRecoveryScreenProps) {
  const { refreshSession } = useAuthSession();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.centerCard}>
        <Text style={styles.title}>{title}</Text>
        <Text accessibilityRole="alert" style={styles.message}>
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={refreshSession}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Check again</Text>
        </Pressable>
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
  centerCard: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    maxWidth: 360,
    padding: spacing.xl,
    width: "100%",
    ...shadows.sm,
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
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    width: "100%",
  },
  primaryButtonPressed: {
    opacity: 0.86,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
});
