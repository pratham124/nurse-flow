import { useMemo } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  PlaceholderButton,
  SeverityBadge,
  SummaryChip,
  SummaryTile,
  SummaryTileGrid,
  WorkflowScreen,
  WorkflowSection,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize, fontWeight, shadows } from "../theme/tokens";
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

function getStatusLabel(status: string) {
  if (status === "generated") {
    return "Break scheduled";
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
          <View style={styles.chipRow}>
            {nurse ? (
              <>
                <SummaryChip label={nurse.licenseType} />
                <SummaryChip label={getExperienceLabel(nurse.experienceLevel)} />
              </>
            ) : (
              <SeverityBadge label="Removed nurse" tone="warning" />
            )}
          </View>
        </View>
        <Text style={styles.entryTime}>{entry.startTime}</Text>
      </View>

      <Text style={styles.entryMeta}>
        {entry.durationMinutes} min break
      </Text>
      <Text style={styles.entryMeta}>
        Sides: {sideLabels.length ? sideLabels.join(", ") : "No side coverage"}
      </Text>
      <Text style={styles.entryMeta}>
        Rooms: {roomLabels.length ? roomLabels.join(", ") : "No room coverage"}
      </Text>
      {hasWarning ? <SeverityBadge label="Break warning" tone="warning" /> : null}
    </View>
  );
}

function BreakWarningRow({ activeShift, warning }: BreakWarningRowProps) {
  const nurseNames = getNurseNames(activeShift, warning.nurseIds);
  const sideLabels = getSideLabels(activeShift, warning.doctorSideIds);
  const roomLabels = getRoomLabels(activeShift, warning.roomIds);

  return (
    <View style={styles.warningRow}>
      <View style={styles.warningTitleRow}>
        <SeverityBadge label={getWarningTypeLabel(warning.type)} tone="warning" />
      </View>
      <Text style={styles.warningMessage}>{warning.message}</Text>
      <Text style={styles.warningContext}>
        Nurses: {nurseNames.length ? nurseNames.join(", ") : "Removed or unavailable"}
      </Text>
      <Text style={styles.warningContext}>
        Sides: {sideLabels.length ? sideLabels.join(", ") : "No side link"}
      </Text>
      <Text style={styles.warningContext}>
        Rooms: {roomLabels.length ? roomLabels.join(", ") : "No room link"}
      </Text>
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
  const actionErrorText = !activeShift?.assignmentResult
    ? "Run assignment before refreshing breaks."
    : !activeShift.breakSchedule
      ? "Generate a break schedule before refreshing."
      : undefined;

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
      actionErrorText={actionErrorText}
      flow={assignmentFlow}
      headerActionLabel="Board"
      onHeaderActionPress={() => router.push("/floor-board")}
      onPrimaryPress={handleRefreshBreaks}
      primaryDisabled={!canRefresh}
      primaryLabel="Refresh breaks"
      subtitle=""
      title="Breaks"
    >
      <WorkflowSection title="Break summary">
        <SummaryTileGrid>
          <SummaryTile value={getStatusLabel(scheduleView.status)} label="Status" />
          <SummaryTile value={scheduleView.shiftStartTime} label="Shift start" />
          <SummaryTile
            value={getFloorActivityLabel(scheduleView.activityLevel)}
            label="Activity"
          />
          <SummaryTile
            value={sortedEntries.length.toString()}
            label={sortedEntries.length === 1 ? "Nurse" : "Nurses"}
          />
          <SummaryTile
            value={scheduleView.warnings.length.toString()}
            label={scheduleView.warnings.length === 1 ? "Warning" : "Warnings"}
          />
        </SummaryTileGrid>
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

      <WorkflowSection title="Local schedule">
        <View style={styles.localScheduleCard}>
          <Text style={styles.localScheduleText}>
            Break warnings are local schedule notes. Assignment flags and nurse
            requests still stay in their existing review flows.
          </Text>
          <PlaceholderButton
            label="Back to Floor Board"
            onPress={() => router.push("/floor-board")}
          />
        </View>
      </WorkflowSection>
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  entryRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.sm,
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
  entryTime: {
    color: colors.brand.burgundy,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  entryMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  chipRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  warningRow: {
    backgroundColor: colors.status.amber50,
    borderColor: colors.status.amber800,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.sm,
  },
  warningTitleRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  warningMessage: {
    color: colors.status.amber800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
    lineHeight: 18,
  },
  warningContext: {
    color: colors.status.amber800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  emptyText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  localScheduleCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  localScheduleText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
});
