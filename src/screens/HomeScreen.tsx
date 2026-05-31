import { useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ConfirmationDialog,
  HospitalIcon,
  SwipeRevealAction,
  TrashIcon,
  ChevronRightIcon,
  BedIcon,
  RoomIcon,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize } from "../theme/tokens";
import type { FloorTemplate, Shift } from "../types/models";
import { createLocalId } from "../helpers/localId";

type FloorTemplateRowProps = {
  floorTemplate: FloorTemplate;
  onRequestDelete: (floorTemplate: FloorTemplate) => void;
  onPress: (floorTemplate: FloorTemplate) => void;
  onStartShift: (floorTemplate: FloorTemplate) => void;
};

function FloorTemplateRow({
  floorTemplate,
  onRequestDelete,
  onPress,
  onStartShift,
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
      <Pressable
        onPress={() => onPress(floorTemplate)}
        style={({ pressed }) => [
          styles.templateRow,
          pressed && styles.templateRowPressed,
        ]}
      >
        <View style={styles.templateAccent} />
        <View style={styles.templateLeft}>
          <View style={styles.templateBadge}>
            <Text style={styles.templateBadgeText}>{floorInitial}</Text>
          </View>
          <View style={styles.templateTitleGroup}>
            <Text style={styles.templateName}>{floorTemplate.name}</Text>
            <View style={styles.templateMetaRow}>
              <View style={styles.templateMetaChip}>
                <RoomIcon size={11} color={colors.neutral.textSecondary} />
                <Text style={styles.templateMetaChipText}>
                  {roomCount} {roomCount === 1 ? "room" : "rooms"}
                </Text>
              </View>
              <View style={styles.templateMetaChip}>
                <BedIcon size={11} color={colors.neutral.textSecondary} />
                <Text style={styles.templateMetaChipText}>
                  {bedCount} {bedCount === 1 ? "bed" : "beds"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.templateRight}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onStartShift(floorTemplate);
            }}
            style={({ pressed }) => [
              styles.startShiftButton,
              pressed && styles.startShiftButtonPressed,
            ]}
          >
            <Text style={styles.startShiftButtonText}>Start Shift</Text>
          </Pressable>
          <ChevronRightIcon color={colors.neutral.textTertiary} size={14} />
        </View>
      </Pressable>
    </SwipeRevealAction>
  );
}

function isCompletedFloorTemplate(floorTemplate: FloorTemplate) {
  const doctorSideIds = floorTemplate.doctorSides.map(
    (doctorSide) => doctorSide.id,
  );
  const hasNamedDoctorSides =
    floorTemplate.doctorSides.length === 2 &&
    floorTemplate.doctorSides.every((doctorSide) => doctorSide.name.trim());
  const hasRooms = floorTemplate.rooms.length > 0;
  const hasValidRooms = floorTemplate.rooms.every(
    (room) =>
      room.label.trim() &&
      room.bedCount > 0 &&
      doctorSideIds.includes(room.doctorSideId),
  );
  const hasBedsForEveryRoom = floorTemplate.rooms.every((room) =>
    floorTemplate.beds.some((bed) => bed.roomId === room.id),
  );

  return (
    Boolean(floorTemplate.name.trim()) &&
    hasNamedDoctorSides &&
    hasRooms &&
    hasValidRooms &&
    hasBedsForEveryRoom
  );
}

function createShiftFromTemplate(floorTemplate: FloorTemplate): Shift {
  return {
    id: createLocalId("shift"),
    floorTemplateId: floorTemplate.id,
    floorName: floorTemplate.name,
    status: "setup",
    admittingDoctorSideId: "",
    doctorSides: floorTemplate.doctorSides.map((doctorSide) => ({
      ...doctorSide,
    })),
    rooms: floorTemplate.rooms.map((room) => ({ ...room })),
    beds: floorTemplate.beds.map((bed) => ({ ...bed })),
    sideLoadLimits: {
      admitting: { min: 4, max: 5 },
      nonAdmitting: { min: 6, max: 7 },
    },
    nurses: [],
    bedStates: floorTemplate.beds.map((bed) => ({
      id: createLocalId("bed-state"),
      bedId: bed.id,
    })),
    flags: [],
  };
}

export default function Index() {
  const { localState, setLocalState } = useLocalState();
  const [floorTemplateToDelete, setFloorTemplateToDelete] =
    useState<FloorTemplate>();
  const floorTemplateCount = localState.floorTemplates.length;

  const activeShift = localState.activeShift;
  const activeShiftTemplate = activeShift
    ? localState.floorTemplates.find(
        (t) => t.id === activeShift.floorTemplateId,
      )
    : null;
  const activeShiftFloorName =
    activeShift?.floorName ?? activeShiftTemplate?.name ?? "Active Floor";
  const activeShiftNursesCount = activeShift?.nurses?.length ?? 0;
  const activeShiftPatientsCount =
    activeShift?.bedStates?.filter((bs) => bs.patient).length ?? 0;

  function handleCreateFloor() {
    setLocalState((currentState) => ({
      ...currentState,
      draftFloorTemplate: undefined,
      isEditingActiveShiftTemplate: false,
    }));

    router.push("/floor-details");
  }

  function handleConfirmDeleteFloor() {
    if (!floorTemplateToDelete) {
      return;
    }

    setLocalState((currentState) => {
      const shouldClearActiveShift =
        currentState.activeShift?.floorTemplateId === floorTemplateToDelete.id;

      return {
        ...currentState,
        activeShift: shouldClearActiveShift
          ? undefined
          : currentState.activeShift,
        isEditingActiveShiftTemplate: shouldClearActiveShift
          ? false
          : currentState.isEditingActiveShiftTemplate,
        floorTemplates: currentState.floorTemplates.filter(
          (floorTemplate) => floorTemplate.id !== floorTemplateToDelete.id,
        ),
      };
    });
    setFloorTemplateToDelete(undefined);
  }

  function handleSelectTemplate(floorTemplate: FloorTemplate) {
    setLocalState((currentState) => ({
      ...currentState,
      draftFloorTemplate: floorTemplate,
      isEditingActiveShiftTemplate: false,
    }));
    router.push("/template-review");
  }

  function handleStartShift(floorTemplate: FloorTemplate) {
    if (!isCompletedFloorTemplate(floorTemplate)) {
      return;
    }

    setLocalState((currentState) => ({
      ...currentState,
      draftFloorTemplate: floorTemplate,
      isEditingActiveShiftTemplate: true,
      activeShift: createShiftFromTemplate(floorTemplate),
    }));
    router.push("/start-shift");
  }

  function handleResumeActiveShift() {
    if (!activeShift) return;
    if (activeShift.status === "assigned") {
      router.push("/floor-board");
    } else {
      router.push("/start-shift");
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>NurseFlow</Text>
        <Text style={styles.subtitle}>Charge Nurse Portal</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Shift Card */}
        {activeShift && (
          <View style={styles.activeShiftCard}>
            <View style={styles.activeShiftHeader}>
              <View style={styles.activeShiftBadgeContainer}>
                <View style={styles.activeShiftPulse} />
                <Text style={styles.activeShiftBadgeText}>
                  ACTIVE SHIFT IN PROGRESS
                </Text>
              </View>
              <Text style={styles.activeShiftTime}>
                {activeShift.status === "assigned" ? "Assigned" : "In Setup"}
              </Text>
            </View>
            <Text style={styles.activeShiftName}>{activeShiftFloorName}</Text>
            <Text style={styles.activeShiftStats}>
              {activeShiftNursesCount}{" "}
              {activeShiftNursesCount === 1 ? "nurse" : "nurses"} •{" "}
              {activeShiftPatientsCount}{" "}
              {activeShiftPatientsCount === 1 ? "patient" : "patients"}
            </Text>
            <Pressable
              onPress={handleResumeActiveShift}
              style={({ pressed }) => [
                styles.resumeButton,
                pressed && styles.resumeButtonPressed,
              ]}
            >
              <Text style={styles.resumeButtonText}>Resume Active Shift</Text>
              <ChevronRightIcon color={colors.neutral.surface} size={14} />
            </Pressable>
          </View>
        )}

        {/* Floor Templates Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Floor Templates</Text>
          <Text style={styles.sectionCount}>{floorTemplateCount}</Text>
        </View>

        {floorTemplateCount ? (
          <View style={styles.templateList}>
            {localState.floorTemplates.map((floorTemplate) => (
              <FloorTemplateRow
                floorTemplate={floorTemplate}
                key={floorTemplate.id}
                onRequestDelete={setFloorTemplateToDelete}
                onPress={handleSelectTemplate}
                onStartShift={handleStartShift}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <HospitalIcon color={colors.brand.burgundy} size={28} />
            </View>
            <Text style={styles.emptyTitle}>No templates created yet</Text>
            <Text style={styles.emptyText}>
              Create a custom floor layout template on this device to start
              managing active shifts.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable
          accessibilityHint="Opens the static floor template setup path."
          accessibilityRole="button"
          onPress={handleCreateFloor}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Create floor template</Text>
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: 4,
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.xl,
    gap: spacing.cardGap,
    paddingBottom: spacing.xl * 2,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "700",
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
    fontWeight: "600",
  },
  activeShiftCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.status.greenBorder || "#c0dd97",
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    boxShadow: "0 6px 16px rgba(79, 127, 42, 0.08)",
  },
  activeShiftHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activeShiftBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeShiftPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.greenIcon || "#3b6d11",
  },
  activeShiftBadgeText: {
    color: colors.status.greenIcon || "#3b6d11",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  activeShiftTime: {
    color: colors.neutral.textSecondary,
    fontSize: 11,
  },
  activeShiftName: {
    color: colors.neutral.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  activeShiftStats: {
    color: colors.neutral.textSecondary,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  resumeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.status.greenIcon || "#3b6d11",
    borderRadius: radius.lg,
    paddingVertical: 12,
    marginTop: spacing.xs,
  },
  resumeButtonPressed: {
    opacity: 0.9,
  },
  resumeButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.xl,
    boxShadow: "0 4px 12px rgba(33, 26, 29, 0.04)",
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy10,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  emptyTitle: {
    color: colors.neutral.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    color: colors.neutral.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 260,
    textAlign: "center",
  },
  templateList: {
    gap: spacing.cardGap,
  },
  templateRow: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: 76,
    overflow: "hidden",
    padding: spacing.lg,
    boxShadow: "0 4px 12px rgba(33, 26, 29, 0.06)",
  },
  templateRowPressed: {
    opacity: 0.92,
    backgroundColor: colors.neutral.backgroundTertiary,
    transform: [{ scale: 0.985 }],
  },
  templateAccent: {
    backgroundColor: colors.brand.burgundy,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 4,
  },
  templateLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  templateRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
    fontSize: 16,
    fontWeight: "700",
  },
  templateMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  templateMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.neutral.backgroundTertiary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  templateMetaChipText: {
    color: colors.neutral.textSecondary,
    fontSize: 11,
    fontWeight: "500",
  },
  startShiftButton: {
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  startShiftButtonPressed: {
    opacity: 0.85,
  },
  startShiftButtonText: {
    color: colors.neutral.surface,
    fontSize: 12,
    fontWeight: "700",
  },
  actionBar: {
    backgroundColor: colors.neutral.backgroundPrimary,
    padding: spacing.xl,
    borderTopWidth: 0.5,
    borderTopColor: colors.neutral.borderTertiary,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.lg,
    height: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: "700",
  },
});
