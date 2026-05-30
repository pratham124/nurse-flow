import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HospitalIcon } from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize } from "../theme/tokens";
import type { FloorTemplate } from "../types/models";

type FloorTemplateRowProps = {
  floorTemplate: FloorTemplate;
};

function FloorTemplateRow({ floorTemplate }: FloorTemplateRowProps) {
  const roomCount = floorTemplate.rooms.length;
  const bedCount = floorTemplate.beds.length;

  return (
    <View style={styles.templateRow}>
      <View style={styles.templateTitleGroup}>
        <Text style={styles.templateName}>{floorTemplate.name}</Text>
        <Text style={styles.templateMeta}>
          {roomCount} {roomCount === 1 ? "room" : "rooms"} - {bedCount}{" "}
          {bedCount === 1 ? "bed" : "beds"}
        </Text>
      </View>
      <Text style={styles.templateStatus}>Saved locally</Text>
    </View>
  );
}

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
        <Text style={styles.subtitle}>Charge nurse workspace</Text>
        <Text style={styles.headerText}>
          Build floor templates and prepare shift assignments.
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Floor templates</Text>
          <Text style={styles.sectionCount}>{floorTemplateCount}</Text>
        </View>

        {floorTemplateCount ? (
          <View style={styles.templateList}>
            {localState.floorTemplates.map((floorTemplate) => (
              <FloorTemplateRow
                floorTemplate={floorTemplate}
                key={floorTemplate.id}
              />
            ))}
          </View>
        ) : (
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
        )}
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
    gap: spacing.sm,
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
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
    marginTop: 2,
  },
  headerText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
    maxWidth: 280,
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
  templateList: {
    gap: spacing.sm,
  },
  templateRow: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.lg,
  },
  templateTitleGroup: {
    gap: spacing.xs,
  },
  templateName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "600",
  },
  templateMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  templateStatus: {
    alignSelf: "flex-start",
    backgroundColor: colors.brand.burgundy10,
    borderRadius: radius.pill,
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
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
