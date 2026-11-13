import { useShallow } from "zustand/react/shallow";
import { useMemo } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  BoardSubTabBar,
  LiveStatusChip,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import {
  colors,
  fontWeight,
  radius,
  spacing,
  textSize,
} from "../theme/tokens";
import type { RealtimeConnectionState } from "../types/models";
import {
  buildNurseRoomsView,
  keepRangesTogether,
  type NurseRoomRow,
} from "../utils/nurseRoomRanges";
import { assignmentFlow } from "../utils/workflowFlows";

// One card on the screen: a doctor side, or the "No patients assigned" group.
type NurseGroupItem = {
  id: string;
  title: string;
  note?: string;
  nurses: NurseRoomRow[];
};

type NurseGroupSectionProps = {
  group: NurseGroupItem;
};

type NurseRoomRowViewProps = {
  isFirst: boolean;
  isLast: boolean;
  nurse: NurseRoomRow;
};

type BoardNursesListHeaderProps = {
  onRefreshLiveStatus: () => void;
  realtimeConnectionState: RealtimeConnectionState;
};

export default function BoardNursesScreen() {
  const {
    activeShift,
    effectiveAssignmentFlags,
    effectiveAssignmentResult,
    realtimeConnectionState,
    retryLoadWorkspace,
  } = useServerWorkspace(
    useShallow((state) => ({
      activeShift: state.activeShift,
      effectiveAssignmentFlags: state.effectiveAssignmentFlags,
      effectiveAssignmentResult: state.effectiveAssignmentResult,
      realtimeConnectionState: state.realtimeConnectionState,
      retryLoadWorkspace: state.retryLoadWorkspace,
    })),
  );
  const groups = useMemo(() => {
    // Without an assignment there are no beds to build ranges from.
    if (!activeShift || !effectiveAssignmentResult) {
      return [];
    }

    // Same "effective" shift the Board uses, so manual moves show up here too.
    const view = buildNurseRoomsView({
      ...activeShift,
      assignmentResult: effectiveAssignmentResult,
      flags: effectiveAssignmentFlags,
    });
    const sideGroups: NurseGroupItem[] = view.sides
      .filter((side) => side.nurses.length > 0)
      .map((side) => ({
        id: side.doctorSideId,
        title: side.name,
        note: getGroupNote(side.nurses, side.admitting),
        nurses: side.nurses,
      }));

    if (view.nursesWithoutPatients.length > 0) {
      sideGroups.push({
        id: "no-patients",
        title: "No patients assigned",
        note: getNurseCountText(view.nursesWithoutPatients.length),
        nurses: view.nursesWithoutPatients,
      });
    }

    return sideGroups;
  }, [activeShift, effectiveAssignmentFlags, effectiveAssignmentResult]);

  return (
    <WorkflowListScreen
      activeStep="Board"
      bottomAccessory={<BoardSubTabBar activeTab="nurses" />}
      data={groups}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      keyExtractor={getGroupKey}
      ListEmptyComponent={<EmptyNursesMessage />}
      listHeader={
        <BoardNursesListHeader
          onRefreshLiveStatus={retryLoadWorkspace}
          realtimeConnectionState={realtimeConnectionState}
        />
      }
      onHeaderActionPress={() => router.push("/")}
      renderItem={renderGroupItem}
      subtitle=""
      title={activeShift?.floorName ?? "Nurses"}
    />
  );
}

function getGroupKey(group: NurseGroupItem) {
  return group.id;
}

function renderGroupItem({ item }: { item: NurseGroupItem }) {
  return <NurseGroupSection group={item} />;
}

function BoardNursesListHeader({
  onRefreshLiveStatus,
  realtimeConnectionState,
}: BoardNursesListHeaderProps) {
  return (
    <View style={styles.listHeader}>
      <LiveStatusChip
        connectionState={realtimeConnectionState}
        onRefresh={onRefreshLiveStatus}
      />
      <Text style={styles.legendText}>
        Rooms run in floor order. A bed label like 313-1 means the nurse has
        only bed 1 of a shared room.
      </Text>
    </View>
  );
}

function EmptyNursesMessage() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No nurse rooms yet</Text>
      <Text style={styles.emptyStateText}>
        Run assignment to see each nurse&apos;s rooms.
      </Text>
    </View>
  );
}

function getNurseCountText(nurseCount: number) {
  return `${nurseCount} ${nurseCount === 1 ? "nurse" : "nurses"}`;
}

// "Admitting side · 3 nurses · 16 patients" gives each side a quick total.
function getGroupNote(nurses: NurseRoomRow[], admitting: boolean) {
  const patientCount = nurses.reduce(
    (total, nurse) => total + nurse.currentLoad,
    0,
  );
  const parts = [
    getNurseCountText(nurses.length),
    `${patientCount} ${patientCount === 1 ? "patient" : "patients"}`,
  ];

  return (admitting ? ["Admitting side", ...parts] : parts).join(" · ");
}

function NurseGroupSection({ group }: NurseGroupSectionProps) {
  return (
    <WorkflowSection note={group.note} title={group.title}>
      <View>
        {group.nurses.map((nurse, index) => (
          <NurseRoomRowView
            isFirst={index === 0}
            isLast={index === group.nurses.length - 1}
            key={nurse.id}
            nurse={nurse}
          />
        ))}
      </View>
    </WorkflowSection>
  );
}

// Two lines per nurse: who they are and their load, then their rooms. Each
// range is its own chip so a long list wraps between ranges, never inside one.
function NurseRoomRowView({ isFirst, isLast, nurse }: NurseRoomRowViewProps) {
  const hasRooms = nurse.ranges.length > 0;
  const isRn = nurse.licenseType === "RN";

  return (
    <View
      accessibilityLabel={`${nurse.name}, ${nurse.licenseType}, ${nurse.rangeAccessibilityText}, ${nurse.currentLoad} of ${nurse.maxLoad} patients`}
      accessible
      style={[
        styles.nurseRow,
        isFirst ? styles.firstNurseRow : styles.nurseRowDivider,
        isLast ? styles.lastNurseRow : null,
      ]}
    >
      <View style={styles.nurseTopLine}>
        <View
          style={[styles.licenseBadge, isRn ? styles.rnBadge : styles.lpnBadge]}
        >
          <Text
            style={[
              styles.licenseBadgeText,
              isRn ? styles.rnBadgeText : styles.lpnBadgeText,
            ]}
          >
            {nurse.licenseType}
          </Text>
        </View>
        <Text style={styles.nurseName}>{nurse.name}</Text>
        <Text style={styles.nurseLoad}>
          {nurse.currentLoad}
          <Text style={styles.nurseLoadMax}>/{nurse.maxLoad}</Text>
        </Text>
      </View>

      {hasRooms ? (
        <View style={styles.roomChips}>
          {nurse.ranges.map((range) => (
            <View key={range} style={styles.roomChip}>
              <Text style={styles.roomChipText}>
                {keepRangesTogether(range)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noPatientsText}>No patients</Text>
      )}
    </View>
  );
}

const badgeWidth = 36;

const styles = StyleSheet.create({
  listHeader: {
    gap: spacing.sm,
  },
  legendText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  // Rows sit on hairline dividers with generous padding, so each nurse reads
  // as one unit and neighbours don't blur together.
  nurseRow: {
    gap: spacing.sm,
    paddingVertical: spacing.md2,
  },
  // The card already pads its edges, so the outer rows drop their own padding.
  firstNurseRow: {
    paddingTop: 0,
  },
  lastNurseRow: {
    paddingBottom: 0,
  },
  nurseRowDivider: {
    borderTopColor: colors.neutral.borderTertiary,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Top-aligned so the badge and load stay level with the first line of a
  // long name that wraps.
  nurseTopLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
  // Badge look matches the license badge on the Nurses setup screen. A fixed
  // width lines up every name in the column.
  licenseBadge: {
    alignItems: "center",
    borderRadius: radius.micro,
    marginTop: 2,
    paddingVertical: 2,
    width: badgeWidth,
  },
  rnBadge: {
    backgroundColor: colors.status.blue50,
  },
  rnBadgeText: {
    color: colors.status.blue800,
  },
  lpnBadge: {
    backgroundColor: colors.status.amber50,
  },
  lpnBadgeText: {
    color: colors.status.amber800,
  },
  licenseBadgeText: {
    fontSize: textSize.xs,
    fontWeight: fontWeight.bold,
  },
  nurseName: {
    color: colors.neutral.textPrimary,
    flex: 1,
    fontSize: textSize.lg,
    fontWeight: fontWeight.semibold,
  },
  nurseLoad: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontVariant: ["tabular-nums"],
    fontWeight: fontWeight.bold,
  },
  nurseLoadMax: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.md,
    fontWeight: fontWeight.medium,
  },
  // Chips start under the name, not under the badge, so rooms form a column.
  roomChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginLeft: badgeWidth + spacing.sm,
  },
  roomChip: {
    backgroundColor: colors.neutral.secondarySurface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  roomChipText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.action,
    fontVariant: ["tabular-nums"],
    fontWeight: fontWeight.medium,
  },
  noPatientsText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.md,
    marginLeft: badgeWidth + spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.xs,
    marginTop: spacing.md,
    padding: spacing.xl,
  },
  emptyStateTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
    textAlign: "center",
  },
  emptyStateText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
    textAlign: "center",
  },
});
