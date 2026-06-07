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
import { colors, radius, spacing, textSize, fontWeight, shadows } from "../theme/tokens";
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

function copyFloorTemplate(floorTemplate: FloorTemplate): FloorTemplate {
  return {
    id: floorTemplate.id,
    name: floorTemplate.name,
    doctorSides: floorTemplate.doctorSides.map((doctorSide) => ({
      ...doctorSide,
    })),
    rooms: floorTemplate.rooms.map((room) => ({ ...room })),
    beds: floorTemplate.beds.map((bed) => ({ ...bed })),
  };
}

export default function Index() {
  const { localState, setLocalState } = useLocalState();
  const [floorTemplateToDelete, setFloorTemplateToDelete] =
    useState<FloorTemplate>();
  const [endShiftConfirmationVisible, setEndShiftConfirmationVisible] =
    useState(false);
  const [templateEditMessage, setTemplateEditMessage] = useState("");
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
    activeShift?.bedStates?.filter((bedState) =>
      bedState.patient?.initials.trim(),
    ).length ?? 0;

  function handleCreateFloor() {
    setLocalState((currentState) => ({
      ...currentState,
      draftFloorTemplate: undefined,
      isEditingActiveShiftTemplate: false,
    }));
    setTemplateEditMessage("");

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
    if (activeShift) {
      setTemplateEditMessage("End the active shift before editing templates.");
      return;
    }

    setLocalState((currentState) => ({
      ...currentState,
      draftFloorTemplate: copyFloorTemplate(floorTemplate),
      isEditingActiveShiftTemplate: false,
    }));
    setTemplateEditMessage("");
    router.push("/template-review");
  }

  function handleStartShift(floorTemplate: FloorTemplate) {
    if (!isCompletedFloorTemplate(floorTemplate)) {
      return;
    }

    setLocalState((currentState) => ({
      ...currentState,
      draftFloorTemplate: undefined,
      isEditingActiveShiftTemplate: false,
      activeShift: createShiftFromTemplate(floorTemplate),
    }));
    setTemplateEditMessage("");
    router.push("/start-shift");
  }

  function handleConfirmEndActiveShift() {
    setLocalState((currentState) => ({
      ...currentState,
      activeShift: undefined,
      draftFloorTemplate: undefined,
      isEditingActiveShiftTemplate: false,
    }));
    setTemplateEditMessage("");
    setEndShiftConfirmationVisible(false);
    router.replace("/");
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
            <View style={styles.activeShiftActions}>
              <Pressable
                accessibilityLabel="Resume active shift"
                accessibilityRole="button"
                onPress={handleResumeActiveShift}
                style={({ pressed }) => [
                  styles.resumeButton,
                  pressed && styles.resumeButtonPressed,
                ]}
              >
                <Text style={styles.resumeButtonText}>Resume</Text>
                <ChevronRightIcon color={colors.neutral.surface} size={14} />
              </Pressable>
              <Pressable
                accessibilityHint="Clears the current local shift but keeps saved floor templates."
                accessibilityRole="button"
                onPress={() => setEndShiftConfirmationVisible(true)}
                style={({ pressed }) => [
                  styles.endShiftButton,
                  pressed && styles.endShiftButtonPressed,
                ]}
              >
                <Text style={styles.endShiftButtonText}>End shift</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Floor Templates Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Floor Templates</Text>
          <Text style={styles.sectionCount}>{floorTemplateCount}</Text>
        </View>
        {templateEditMessage ? (
          <Text accessibilityRole="alert" style={styles.templateEditMessage}>
            {templateEditMessage}
          </Text>
        ) : null}

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
      <ConfirmationDialog
        confirmLabel="End shift"
        confirmTone="danger"
        message={`${activeShiftFloorName} shift data will be cleared from this local session. Saved floor templates will stay available.`}
        onCancel={() => setEndShiftConfirmationVisible(false)}
        onConfirm={handleConfirmEndActiveShift}
        title="End active shift?"
        visible={endShiftConfirmationVisible}
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
    backgroundColor: colors.neutral.surface,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl + 10,
    paddingBottom: spacing.md,
    gap: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.neutral.borderTertiary,
    ...shadows.sm,
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: 30,
    fontWeight: fontWeight.heavy,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.md,
    fontWeight: fontWeight.semibold,
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
    fontWeight: fontWeight.bold,
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
    fontWeight: fontWeight.semibold,
  },
  activeShiftCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.status.greenBorder || "#c0dd97",
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: colors.status.greenIcon || "#3b6d11",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  activeShiftTime: {
    color: colors.neutral.textSecondary,
    fontSize: 11,
    fontWeight: fontWeight.medium,
  },
  activeShiftName: {
    color: colors.neutral.textPrimary,
    fontSize: 18,
    fontWeight: fontWeight.bold,
    marginTop: 2,
  },
  activeShiftStats: {
    color: colors.neutral.textSecondary,
    fontSize: 13,
    marginBottom: spacing.xs,
    fontWeight: fontWeight.medium,
  },
  activeShiftActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  resumeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.status.greenIcon || "#3b6d11",
    borderRadius: radius.lg,
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  resumeButtonPressed: {
    opacity: 0.85,
  },
  resumeButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  endShiftButton: {
    alignItems: "center",
    borderColor: colors.status.red700,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  endShiftButtonPressed: {
    backgroundColor: colors.status.red50,
  },
  endShiftButtonText: {
    color: colors.status.red700,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.xl,
    ...shadows.sm,
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
    fontWeight: fontWeight.bold,
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
  templateEditMessage: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    lineHeight: 18,
    textAlign: "center",
  },
  templateRow: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: 76,
    padding: spacing.lg,
  },
  templateRowPressed: {
    opacity: 0.92,
    backgroundColor: colors.neutral.backgroundTertiary,
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
    fontWeight: fontWeight.bold,
  },
  templateTitleGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  templateName: {
    color: colors.neutral.textPrimary,
    fontSize: 16,
    fontWeight: fontWeight.bold,
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
    fontWeight: fontWeight.medium,
  },
  startShiftButton: {
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...shadows.sm,
  },
  startShiftButtonPressed: {
    opacity: 0.85,
  },
  startShiftButtonText: {
    color: colors.neutral.surface,
    fontSize: 12,
    fontWeight: fontWeight.bold,
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
    ...shadows.sm,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
});
