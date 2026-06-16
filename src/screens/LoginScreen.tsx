import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, fontWeight, radius, shadows, spacing, textSize } from "../theme/tokens";

export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Account required</Text>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.message}>
          NurseFlow is ready to show the account login screen. Email/password
          fields are added in the next Phase 5 task.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
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
    padding: spacing.xl,
    ...shadows.sm,
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
});
