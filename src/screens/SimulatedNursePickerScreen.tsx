import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  SummaryChip,
  SummaryTile,
  SummaryTileGrid,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import { useWorkflowDraft } from "../store/WorkflowDraftContext";
import { assignmentFlow } from "../utils/workflowFlows";
import { colors, fontWeight, radius, shadows, spacing, textSize } from "../theme/tokens";
import type { ExperienceLevel, Shift } from "../types/models";

type NursePickerRowViewModel = {
  assignedBedCount: number;
  experience: string;
  id: string;
  isSelected: boolean;
  licenseType: string;
  name: string;
  roomCoverage: string;
};

type NursePickerListItem =
  | { type: "nurse"; nurse: NursePickerRowViewModel }
  | { type: "empty"; id: string; message: string; title: string };

type NursePickerHeaderProps = {
  nurseCount: number;
  selectedNurseName?: string;
};

type NursePickerRowProps = {
  nurse: NursePickerRowViewModel;
  onSelectNurse: (nurseId: string) => void;
};

type EmptyPickerRowProps = {
  message: string;
  title: string;
};

function getExperienceLabel(experienceLevel: ExperienceLevel) {
  if (experienceLevel === "new_grad") {
    return "New grad";
  }

  if (experienceLevel === "mid") {
    return "Mid";
  }

  return "Experienced";
}

function getRoomCoverageSummary(activeShift: Shift, nurseId: string) {
  const roomLabels =
    activeShift.assignmentResult?.roomCoverage
      .filter((coverage) => coverage.nurseIds.includes(nurseId))
      .map(
        (coverage) =>
          activeShift.rooms.find((room) => room.id === coverage.roomId)?.label,
      )
      .filter(Boolean) ?? [];

  return roomLabels.length ? roomLabels.join(", ") : "No rooms";
}

function getAssignedBedCount(activeShift: Shift, nurseId: string) {
  return (
    activeShift.assignmentResult?.bedAssignments.filter(
      (assignment) => assignment.nurseId === nurseId,
    ).length ?? 0
  );
}

function getPickerEmptyMessage(activeShift?: Shift) {
  if (!activeShift) {
    return {
      title: "No active shift",
      message: "Start a shift and run assignment before opening nurse view.",
    };
  }

  if (activeShift.status !== "assigned" || !activeShift.assignmentResult) {
    return {
      title: "Assignment needed",
      message: "Run assignment before opening nurse view.",
    };
  }

  if (!activeShift.nurses.length) {
    return {
      title: "No nurses available",
      message: "Add nurses before opening nurse view.",
    };
  }

  return undefined;
}

function getNurseRows(
  activeShift: Shift,
  selectedNurseId?: string,
): NursePickerRowViewModel[] {
  return activeShift.nurses.map((nurse) => ({
    assignedBedCount: getAssignedBedCount(activeShift, nurse.id),
    experience: getExperienceLabel(nurse.experienceLevel),
    id: nurse.id,
    isSelected: nurse.id === selectedNurseId,
    licenseType: nurse.licenseType,
    name: nurse.name,
    roomCoverage: getRoomCoverageSummary(activeShift, nurse.id),
  }));
}

function getPickerItems(
  activeShift: Shift | undefined,
  selectedNurseId?: string,
): NursePickerListItem[] {
  const emptyMessage = getPickerEmptyMessage(activeShift);

  if (emptyMessage || !activeShift) {
    return [
      {
        id: "empty-picker",
        message: emptyMessage?.message ?? "Return to the floor board.",
        title: emptyMessage?.title ?? "Nurse view unavailable",
        type: "empty",
      },
    ];
  }

  return getNurseRows(activeShift, selectedNurseId).map((nurse) => ({
    nurse,
    type: "nurse",
  }));
}

function getPickerItemKey(item: NursePickerListItem) {
  return item.type === "nurse" ? item.nurse.id : item.id;
}

function NursePickerHeader({
  nurseCount,
  selectedNurseName,
}: NursePickerHeaderProps) {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection title="Local simulation">
        <View style={styles.summaryCard}>
          <View style={styles.chipRow}>
            <SummaryChip label="Regular nurse simulation" />
            <SummaryChip label="Local only" />
          </View>
          <Text style={styles.summaryText}>
            Choose one nurse from the active shift to see their local
            assignment view.
          </Text>
        </View>
      </WorkflowSection>

      <WorkflowSection title="Picker summary">
        <SummaryTileGrid>
          <SummaryTile value={nurseCount.toString()} label="Nurses" />
          <SummaryTile value={selectedNurseName ?? "-"} label="Selected" />
        </SummaryTileGrid>
      </WorkflowSection>
    </View>
  );
}

function NursePickerRow({ nurse, onSelectNurse }: NursePickerRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: nurse.isSelected }}
      onPress={() => onSelectNurse(nurse.id)}
      style={({ pressed }) => [
        styles.nurseRow,
        nurse.isSelected ? styles.selectedNurseRow : null,
        pressed ? styles.pressedNurseRow : null,
      ]}
    >
      <View style={styles.nurseTopRow}>
        <View style={styles.nurseNameGroup}>
          <Text style={styles.nurseName}>{nurse.name}</Text>
          <Text style={styles.nurseMeta}>
            {nurse.licenseType} - {nurse.experience}
          </Text>
        </View>
        <SummaryChip
          label={nurse.isSelected ? "Selected" : "Choose"}
        />
      </View>

      <View style={styles.nurseStatsRow}>
        <Text style={styles.nurseStat}>
          Beds: {nurse.assignedBedCount}
        </Text>
        <Text style={styles.nurseStat}>Rooms: {nurse.roomCoverage}</Text>
      </View>
    </Pressable>
  );
}

function EmptyPickerRow({ message, title }: EmptyPickerRowProps) {
  return (
    <View style={styles.emptyRow}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

function renderPickerItem({
  item,
  onSelectNurse,
}: {
  item: NursePickerListItem;
  onSelectNurse: (nurseId: string) => void;
}) {
  if (item.type === "empty") {
    return <EmptyPickerRow message={item.message} title={item.title} />;
  }

  return <NursePickerRow nurse={item.nurse} onSelectNurse={onSelectNurse} />;
}

export default function SimulatedNursePickerScreen() {
  const { activeShift } = useServerWorkspace();
  const { setSimulatedSessionState, simulatedSessionState } =
    useWorkflowDraft();
  const selectedNurse = activeShift?.nurses.find(
    (nurse) => nurse.id === simulatedSessionState.selectedNurseId,
  );
  const pickerItems = getPickerItems(
    activeShift,
    simulatedSessionState.selectedNurseId,
  );

  function selectNurse(nurseId: string) {
    setSimulatedSessionState({
      role: "regular_nurse",
      selectedNurseId: nurseId,
    });
    router.push("/simulated-nurse-assignment");
  }

  return (
    <WorkflowListScreen
      activeStep="Board"
      data={pickerItems}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      keyExtractor={getPickerItemKey}
      listHeader={
        <NursePickerHeader
          nurseCount={activeShift?.nurses.length ?? 0}
          selectedNurseName={selectedNurse?.name}
        />
      }
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/floor-board")}
      primaryLabel="Return to board"
      renderItem={({ item }) =>
        renderPickerItem({ item, onSelectNurse: selectNurse })
      }
      subtitle=""
      title="View as nurse"
    />
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  summaryCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  chipRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  nurseRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  selectedNurseRow: {
    backgroundColor: colors.brand.burgundy10,
    borderColor: colors.brand.burgundy,
    borderWidth: 1,
  },
  pressedNurseRow: {
    opacity: 0.82,
  },
  nurseTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  nurseNameGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  nurseName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  nurseMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  nurseStatsRow: {
    gap: spacing.xs,
  },
  nurseStat: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  emptyRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.lg,
    ...shadows.sm,
  },
  emptyTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  emptyMessage: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
});
