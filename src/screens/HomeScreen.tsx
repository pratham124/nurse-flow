import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, spacing, textSize } from "../theme/tokens";

export default function Index() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>NurseFlow</Text>
        <Text style={styles.subtitle}>Local charge nurse prototype</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Floor templates</Text>
          <Text style={styles.sectionCount}>0</Text>
        </View>

        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>NF</Text>
          </View>
          <Text style={styles.emptyTitle}>No local floor yet.</Text>
          <Text style={styles.emptyText}>
            Create a floor template on this device to start the local charge
            nurse workflow.
          </Text>
        </View>
      </View>

      <View style={styles.actionBar}>
        <Pressable
          accessibilityHint="Opens the static floor template setup path."
          accessibilityRole="button"
          onPress={() => router.push("/floor-details")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Create floor</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  header: {
    backgroundColor: colors.neutral.surface,
    borderBottomColor: colors.neutral.border,
    borderBottomWidth: 1,
    gap: spacing.xs,
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  content: {
    flex: 1,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: colors.brand.burgundy,
    fontSize: textSize.xl,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.neutral.mutedText,
    fontSize: textSize.md,
  },
  sectionTitle: {
    color: colors.neutral.text,
    fontSize: textSize.lg,
    fontWeight: "700",
  },
  sectionCount: {
    backgroundColor: colors.brand.lightBlue,
    borderRadius: radius.md,
    color: colors.neutral.text,
    fontSize: textSize.sm,
    fontWeight: "700",
    minWidth: 32,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.brand.lightBlue,
    borderRadius: radius.md,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  emptyIconText: {
    color: colors.brand.burgundy,
    fontSize: textSize.md,
    fontWeight: "700",
  },
  emptyTitle: {
    color: colors.neutral.text,
    fontSize: textSize.lg,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    color: colors.neutral.mutedText,
    fontSize: textSize.md,
    lineHeight: 22,
    textAlign: "center",
  },
  actionBar: {
    backgroundColor: colors.neutral.surface,
    borderTopColor: colors.neutral.border,
    borderTopWidth: 1,
    padding: spacing.xl,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.md,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.md,
    fontWeight: "700",
  },
});
