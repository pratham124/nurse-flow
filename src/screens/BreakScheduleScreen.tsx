import { useMemo } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  BoardSubTabBar,
  WorkflowScreen,
  WorkflowSection,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize, fontWeight } from "../theme/tokens";
import type {
  BreakScheduleEntry,
  BreakScheduleWarning,
  ExperienceLevel,
  Shift,
} from "../types/models";
import {
  generateLocalBreakSchedule,
  getBreakScheduleView,
  getFloorActivityLabel,
} from "../utils/breakSchedule";
import { assignmentFlow } from "../utils/workflowFlows";

type BreakEntryRowProps = {
  activeShift: Shift;
  entry: BreakScheduleEntry;
};

type BreakWarningRowProps = {
  activeShift: Shift;
  warning: BreakScheduleWarning;
};

type BreakSummaryCardProps = {
  activityLabel: string;
  canRefresh: boolean;
  needsRefresh: boolean;
  nurseCount: number;
  onRefresh: () => void;
  shiftStartTime: string;
  statusLabel: string;
  warningCount: number;
};

type BreakSummaryDetailProps = {
  label: string;
  value: string;
};

function getStatusLabel(status: string) {
  if (status === "generated") {
    return "Scheduled";
  }

  if (status === "needs_refresh") {
    return "Needs refresh";
  }

  return "Not scheduled";
}

function getExperienceLabel(experienceLevel: ExperienceLevel) {
  if (experienceLevel === "new_grad") {
    return "New grad";
  }

  if (experienceLevel === "mid") {
    return "Mid";
  }

  return "Experienced";
}

function getWarningTypeLabel(type: BreakScheduleWarning["type"]) {
  switch (type) {
    case "no_experienced_nurse_for_side":
      return "Experienced coverage";
    case "overlapping_room_coverage":
      return "Room overlap";
    case "missing_assignment_result":
      return "Missing assignment";
    case "missing_nurse":
      return "Missing nurse";
    case "unable_to_schedule_break":
      return "Review needed";
  }
}

function getSortedEntries(entries: BreakScheduleEntry[]) {
  return [...entries].sort((firstEntry, secondEntry) =>
    firstEntry.startTime.localeCompare(secondEntry.startTime),
  );
}

function getSideLabels(activeShift: Shift, sideIds: string[]) {
  return sideIds
    .map(
      (sideId) =>
        activeShift.doctorSides.find((doctorSide) => doctorSide.id === sideId)
          ?.name,
    )
    .filter((name): name is string => Boolean(name));
}

function getRoomLabels(activeShift: Shift, roomIds: string[]) {
  return roomIds
    .map(
      (roomId) =>
        activeShift.rooms.find((room) => room.id === roomId)?.label,
    )
    .filter((label): label is string => Boolean(label));
}

function getNurseNames(activeShift: Shift, nurseIds: string[]) {
  return nurseIds
    .map(
      (nurseId) =>
        activeShift.nurses.find((nurse) => nurse.id === nurseId)?.name,
    )
    .filter((name): name is string => Boolean(name));
}

function BreakSummaryCard({
  activityLabel,
  canRefresh,
  needsRefresh,
  nurseCount,
  onRefresh,
  shiftStartTime,
  statusLabel,
  warningCount,
}: BreakSummaryCardProps) {
  const showRefreshAction = needsRefresh && canRefresh;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTopRow}>
        <View style={styles.summaryTitleGroup}>
          <Text style={styles.summaryEyebrow}>Break plan</Text>
          <Text style={styles.summaryStatus}>{statusLabel}</Text>
        </View>
        {showRefreshAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRefresh}
            style={({ pressed }) => [
              styles.refreshPill,
              pressed ? styles.refreshPillPressed : null,
            ]}
          >
            <Text style={styles.refreshPillText}>Refresh</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.summaryDetails}>
        <BreakSummaryDetail label="Shift start" value={shiftStartTime} />
        <BreakSummaryDetail label="Activity" value={activityLabel} />
        <BreakSummaryDetail
          label={nurseCount === 1 ? "Nurse" : "Nurses"}
          value={nurseCount.toString()}
        />
      </View>

      {warningCount > 0 ? (
        <View style={styles.warningStrip}>
          <Text style={styles.warningStripText}>
            {warningCount} {warningCount === 1 ? "warning" : "warnings"} need
            review.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function BreakSummaryDetail({ label, value }: BreakSummaryDetailProps) {
  return (
    <View style={styles.summaryDetail}>
      <Text style={styles.summaryDetailLabel}>{label}</Text>
      <Text style={styles.summaryDetailValue}>{value}</Text>
    </View>
  );
}

function BreakEntryRow({ activeShift, entry }: BreakEntryRowProps) {
  const nurse = activeShift.nurses.find(
    (activeNurse) => activeNurse.id === entry.nurseId,
  );
  const sideLabels = getSideLabels(activeShift, entry.doctorSideIds);
  const roomLabels = getRoomLabels(activeShift, entry.coveredRoomIds);
  const hasWarning = entry.warningIds.length > 0;

  return (
    <View style={styles.entryRow}>
      <View style={styles.entryTopRow}>
        <View style={styles.entryNameGroup}>
          <Text style={styles.entryName}>{nurse?.name ?? entry.nurseName}</Text>
          {nurse ? (
            <Text style={styles.entrySubtext}>
              {nurse.licenseType} · {getExperienceLabel(nurse.experienceLevel)}
            </Text>
          ) : (
            <Text style={styles.entrySubtext}>Removed nurse</Text>
          )}
        </View>
        <View style={styles.entryTimeGroup}>
          <Text style={styles.entryTime}>{entry.startTime}</Text>
          <Text style={styles.entryDuration}>{entry.durationMinutes} min</Text>
        </View>
      </View>

      <View style={styles.entryCoverageRow}>
        <Text style={styles.entryCoverageText}>
          Side {sideLabels.length ? sideLabels.join(", ") : "unassigned"}
        </Text>
        <Text style={styles.entryCoverageText}>
          Rooms {roomLabels.length ? roomLabels.join(", ") : "unassigned"}
        </Text>
      </View>

      {hasWarning ? (
        <View style={styles.entryWarningNote}>
          <Text style={styles.entryWarningNoteText}>Needs charge review</Text>
        </View>
      ) : null}
    </View>
  );
}

function BreakWarningRow({ activeShift, warning }: BreakWarningRowProps) {
  const nurseNames = getNurseNames(activeShift, warning.nurseIds);
  const sideLabels = getSideLabels(activeShift, warning.doctorSideIds);
  const roomLabels = getRoomLabels(activeShift, warning.roomIds);

  return (
    <View style={styles.warningRow}>
      <View style={styles.warningTopRow}>
        <Text style={styles.warningTitle}>{getWarningTypeLabel(warning.type)}</Text>
      </View>
      <Text style={styles.warningMessage}>{warning.message}</Text>
      <View style={styles.warningContextRow}>
        <Text style={styles.warningContext}>
          {nurseNames.length ? nurseNames.join(", ") : "Removed or unavailable"}
        </Text>
        <Text style={styles.warningContext}>
          Side {sideLabels.length ? sideLabels.join(", ") : "none"}
        </Text>
        <Text style={styles.warningContext}>
          Rooms {roomLabels.length ? roomLabels.join(", ") : "none"}
        </Text>
      </View>
    </View>
  );
}

export default function BreakScheduleScreen() {
  const { localState, setLocalState } = useLocalState();
  const activeShift = localState.activeShift;
  const scheduleView = getBreakScheduleView(activeShift);
  const sortedEntries = useMemo(
    () => getSortedEntries(scheduleView.entries),
    [scheduleView.entries],
  );
  const canRefresh = Boolean(
    activeShift?.breakSchedule && activeShift.assignmentResult,
  );

  function handleRefreshBreaks() {
    setLocalState((currentState) => {
      const currentShift = currentState.activeShift;

      if (
        !currentShift?.breakSchedule ||
        !currentShift.assignmentResult
      ) {
        return currentState;
      }

      return {
        ...currentState,
        activeShift: {
          ...currentShift,
          breakSchedule: generateLocalBreakSchedule(
            currentShift,
            currentShift.assignmentResult,
          ),
        },
      };
    });
  }

  return (
    <WorkflowScreen
      activeStep="Board"
      flow={assignmentFlow}
      headerActionLabel="Board"
      onHeaderActionPress={() => router.push("/floor-board")}
      bottomAccessory={<BoardSubTabBar activeTab="breaks" />}
      subtitle=""
      title={activeShift?.floorName ?? "Breaks"}
    >
      <WorkflowSection title="Break summary">
        <BreakSummaryCard
          activityLabel={getFloorActivityLabel(scheduleView.activityLevel)}
          canRefresh={canRefresh}
          needsRefresh={scheduleView.status === "needs_refresh"}
          nurseCount={sortedEntries.length}
          onRefresh={handleRefreshBreaks}
          shiftStartTime={scheduleView.shiftStartTime}
          statusLabel={getStatusLabel(scheduleView.status)}
          warningCount={scheduleView.warnings.length}
        />
      </WorkflowSection>

      <WorkflowSection title="Break entries">
        {activeShift && sortedEntries.length ? (
          sortedEntries.map((entry) => (
            <BreakEntryRow
              key={entry.id}
              activeShift={activeShift}
              entry={entry}
            />
          ))
        ) : (
          <Text style={styles.emptyText}>
            {scheduleView.emptyMessage ?? "No break entries yet."}
          </Text>
        )}
      </WorkflowSection>

      {activeShift && scheduleView.warnings.length ? (
        <WorkflowSection title="Break warnings">
          {scheduleView.warnings.map((warning) => (
            <BreakWarningRow
              key={warning.id}
              activeShift={activeShift}
              warning={warning}
            />
          ))}
        </WorkflowSection>
      ) : null}

    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
  },
  summaryTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  summaryTitleGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  summaryEyebrow: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  summaryStatus: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  refreshPill: {
    backgroundColor: colors.brand.burgundy10,
    borderColor: colors.brand.burgundy,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  refreshPillPressed: {
    opacity: 0.76,
  },
  refreshPillText: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  summaryDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryDetail: {
    backgroundColor: colors.neutral.backgroundTertiary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    flex: 1,
    gap: spacing.xs,
    minWidth: 88,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  summaryDetailLabel: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.semibold,
  },
  summaryDetailValue: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  warningStrip: {
    backgroundColor: colors.status.amber50,
    borderColor: colors.status.amber800,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  warningStripText: {
    color: colors.status.amber800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  entryRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
  },
  entryTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  entryNameGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  entryName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  entrySubtext: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  entryTimeGroup: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  entryTime: {
    color: colors.brand.burgundy,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  entryDuration: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.semibold,
  },
  entryCoverageRow: {
    backgroundColor: colors.neutral.backgroundTertiary,
    borderRadius: radius.sm,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  entryCoverageText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  entryWarningNote: {
    backgroundColor: colors.status.amber50,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  entryWarningNoteText: {
    color: colors.status.amber800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  warningRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderLeftColor: colors.status.amber800,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.sm,
    padding: spacing.md,
  },
  warningTopRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  warningTitle: {
    color: colors.status.amber800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  warningMessage: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  warningContextRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  warningContext: {
    backgroundColor: colors.status.amber50,
    borderRadius: radius.pill,
    color: colors.status.amber800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  emptyText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});
