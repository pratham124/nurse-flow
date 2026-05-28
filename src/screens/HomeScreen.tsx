import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HospitalIcon } from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize } from "../theme/tokens";

export default function Index() {
  const { localState, setLocalState } = useLocalState();
  const floorTemplateCount = localState.floorTemplates.length;

  function handleCreateFloor() {
    setLocalState((currentState) => ({
      ...currentState,
      draftFloorTemplate: undefined,
    }));

    router.push("/floor-details");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>NurseFlow</Text>
        <Text style={styles.subtitle}>Local charge nurse prototype</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Floor templates</Text>
          <Text style={styles.sectionCount}>{floorTemplateCount}</Text>
        </View>

        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <HospitalIcon />
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
          onPress={handleCreateFloor}
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
    backgroundColor: colors.neutral.backgroundPrimary,
  },
  header: {
    backgroundColor: colors.neutral.backgroundPrimary,
    gap: spacing.xs,
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  content: {
    flex: 1,
    gap: spacing.cardGap,
    padding: spacing.xl,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.xl,
    fontWeight: "500",
  },
  subtitle: {
    color: colors.neutral.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "500",
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
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  emptyTitle: {
    color: colors.neutral.textPrimary,
    fontSize: 17,
    fontWeight: "500",
    textAlign: "center",
  },
  emptyText: {
    color: colors.neutral.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 260,
    textAlign: "center",
  },
  actionBar: {
    backgroundColor: colors.neutral.backgroundPrimary,
    padding: spacing.xl,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.lg,
    height: 52,
    justifyContent: "center",
    marginHorizontal: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: "500",
  },
});
