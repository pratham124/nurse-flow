import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  colors,
  fontWeight,
  radius,
  shadows,
  spacing,
  textSize,
} from "../theme/tokens";

export default function JoinActiveSessionScreen() {
  function handleBack() {
    router.replace("/");
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
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusPillText}>Coming soon</Text>
          </View>
        </View>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>Join active session</Text>
          <Text style={styles.subtitle}>
            Enter the nurse code from charge when this workflow is enabled.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.label}>Nurse code</Text>
            <Text style={styles.panelMeta}>6 characters</Text>
          </View>

          <View accessibilityLabel="Nurse code entry disabled" style={styles.codeRow}>
            {["", "", "", "", "", ""].map((_, index) => (
              <View key={`code-cell-${index}`} style={styles.codeCell}>
                <Text style={styles.codeCellText}>-</Text>
              </View>
            ))}
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Not active in this build</Text>
            <Text style={styles.helperText}>
              The next task will verify codes and link this account to one
              shift nurse assignment.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          disabled
          style={styles.disabledButton}
        >
          <Text style={styles.disabledButtonText}>Join shift</Text>
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
    justifyContent: "space-between",
    gap: spacing.md,
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
  statusPill: {
    alignItems: "center",
    backgroundColor: colors.status.amber50,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 30,
    paddingHorizontal: spacing.md,
  },
  statusDot: {
    backgroundColor: colors.status.amber800,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  statusPillText: {
    color: colors.status.amber800,
    fontSize: textSize.xs,
    fontWeight: fontWeight.bold,
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
    justifyContent: "space-between",
    gap: spacing.md,
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
  infoBox: {
    backgroundColor: colors.status.blue50,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.md,
  },
  infoTitle: {
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
  actionBar: {
    backgroundColor: colors.neutral.backgroundPrimary,
    borderTopColor: colors.neutral.borderTertiary,
    borderTopWidth: 0.5,
    padding: spacing.xl,
  },
  disabledButton: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: radius.lg,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  disabledButtonText: {
    color: colors.neutral.textTertiary,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
});
