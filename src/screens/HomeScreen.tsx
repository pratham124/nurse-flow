import { useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ConfirmationDialog,
  HospitalIcon,
  SwipeRevealAction,
  TrashIcon,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize } from "../theme/tokens";
import type { FloorTemplate } from "../types/models";

type FloorTemplateRowProps = {
  floorTemplate: FloorTemplate;
  onRequestDelete: (floorTemplate: FloorTemplate) => void;
};

function FloorTemplateRow({
  floorTemplate,
  onRequestDelete,
}: FloorTemplateRowProps) {
  const roomCount = floorTemplate.rooms.length;
  const bedCount = floorTemplate.beds.length;
  const floorInitial = floorTemplate.name.trim().charAt(0).toUpperCase() || "F";

  return (
    <SwipeRevealAction
      accessibilityLabel={`Delete ${floorTemplate.name}`}
      actionIcon={<TrashIcon color={colors.neutral.surface} size={18} />}
      actionLabel="Delete"
      onActionPress={() => onRequestDelete(floorTemplate)}
    >
      <View style={styles.templateRow}>
        <View style={styles.templateAccent} />
        <View style={styles.templateBadge}>
          <Text style={styles.templateBadgeText}>{floorInitial}</Text>
        </View>
        <View style={styles.templateTitleGroup}>
          <Text style={styles.templateName}>{floorTemplate.name}</Text>
          <View style={styles.templateMetaRow}>
            <Text style={styles.templateMetaChip}>
              {roomCount} {roomCount === 1 ? "room" : "rooms"}
            </Text>
            <Text style={styles.templateMetaChip}>
              {bedCount} {bedCount === 1 ? "bed" : "beds"}
            </Text>
          </View>
        </View>
      </View>
    </SwipeRevealAction>
  );
}

export default function Index() {
  const { localState, setLocalState } = useLocalState();
  const [floorTemplateToDelete, setFloorTemplateToDelete] =
    useState<FloorTemplate>();
  const floorTemplateCount = localState.floorTemplates.length;

  function handleCreateFloor() {
    setLocalState((currentState) => ({
      ...currentState,
      draftFloorTemplate: undefined,
    }));

    router.push("/floor-details");
  }

  function handleConfirmDeleteFloor() {
    if (!floorTemplateToDelete) {
      return;
    }

    setLocalState((currentState) => ({
      ...currentState,
      floorTemplates: currentState.floorTemplates.filter(
        (floorTemplate) => floorTemplate.id !== floorTemplateToDelete.id,
      ),
    }));
    setFloorTemplateToDelete(undefined);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>NurseFlow</Text>
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
                onRequestDelete={setFloorTemplateToDelete}
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
    padding: spacing.xl,
    paddingBottom: spacing.md,
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
    fontWeight: "700",
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
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 76,
    overflow: "hidden",
    padding: spacing.lg,
    boxShadow: "0 4px 12px rgba(33, 26, 29, 0.06)",
  },
  templateAccent: {
    backgroundColor: colors.brand.burgundy,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 4,
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
    fontWeight: "700",
  },
  templateTitleGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  templateName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "600",
  },
  templateMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  templateMetaChip: {
    backgroundColor: colors.neutral.backgroundTertiary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
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
