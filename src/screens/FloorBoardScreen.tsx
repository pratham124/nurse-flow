import { useState } from "react";
import { router } from "expo-router";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  BoardSubTabBar,
  FilterChip,
  FilterChipRow,
  LiveStatusChip,
  SeverityBadge,
  StatusPill,
  SummaryChip,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import { getShiftCensus, isOccupiedBedState } from "../utils/census";
import { assignmentFlow } from "../utils/workflowFlows";
import {
  colors,
  radius,
  spacing,
  textSize,
  fontWeight,
  shadows,
} from "../theme/tokens";
import type {
  Acuity,
  ExperienceLevel,
  Flag,
  FlagSeverity,
  RealtimeConnectionState,
  Shift,
} from "../types/models";

const boardFilters = [
  "All",
  "Flags",
  "Unassigned",
  "High acuity",
  "RN coverage",
] as const;

type BoardFilter = (typeof boardFilters)[number];

type BoardBedState = "assigned" | "empty" | "unassigned";

type BoardBedViewModel = {
  id: string;
  label: string;
  patient: string;
  acuity: string;
  acuityValue?: Acuity;
  flags: InlineFlagViewModel[];
  state: BoardBedState;
  nurse?: string;
};
type BoardRoom = {
  id: string;
  label: string;
  coverage: string;
  beds: BoardBedViewModel[];
  flags: InlineFlagViewModel[];
  hasFlag: boolean;
  hasRnCoverage: boolean;
  roomHasFlag: boolean;
};
type BoardSide = {
  id: string;
  name: string;
  admitting: boolean;
  rooms: BoardRoom[];
};
type FloorBoardListItem = { type: "side"; side: BoardSide };

type InlineFlagViewModel = {
  id: string;
  label: string;
  severity: FlagSeverity;
};

type NurseWorkloadViewModel = {
  id: string;
  name: string;
  licenseType: string;
  experience: string;
  team: string;
  roomCoverage: string;
  currentLoad: number;
  flags: InlineFlagViewModel[];
  maxLoad: number;
};

type BoardSideSectionProps = {
  side: BoardSide;
};

type BoardBedProps = BoardBedViewModel;

type FloorBoardListHeaderProps = {
  admittingSideName: string;
  flagCount: number;
  nurseWorkloads: NurseWorkloadViewModel[];
  onFilterPress: (filter: BoardFilter) => void;
  onRefreshLiveStatus: () => void;
  occupiedBedCount: number;
  realtimeConnectionState: RealtimeConnectionState;
  selectedFilter: BoardFilter;
  totalBedCount: number;
};

type BoardSummaryCardProps = {
  admittingSideName: string;
  flagCount: number;
  occupiedBedCount: number;
  totalBedCount: number;
};

function FloorBoardListHeader({
  admittingSideName,
  flagCount,
  nurseWorkloads,
  onFilterPress,
  onRefreshLiveStatus,
  occupiedBedCount,
  realtimeConnectionState,
  selectedFilter,
  totalBedCount,
}: FloorBoardListHeaderProps) {
  return (
    <View style={styles.headerContent}>
      <LiveStatusChip
        connectionState={realtimeConnectionState}
        onRefresh={onRefreshLiveStatus}
      />

      <WorkflowSection title="Board summary">
        <BoardSummaryCard
          admittingSideName={admittingSideName}
          flagCount={flagCount}
          occupiedBedCount={occupiedBedCount}
          totalBedCount={totalBedCount}
        />
      </WorkflowSection>

      <NurseWorkloadSection nurseWorkloads={nurseWorkloads} />

      <WorkflowSection title="Filters">
        <FilterChipRow>
          {boardFilters.map((filter) => (
            <FilterChip
              key={filter}
              label={filter}
              onPress={() => onFilterPress(filter)}
              selected={filter === selectedFilter}
            />
          ))}
        </FilterChipRow>
      </WorkflowSection>
    </View>
  );
}

function BoardSummaryCard({
  admittingSideName,
  flagCount,
  occupiedBedCount,
  totalBedCount,
}: BoardSummaryCardProps) {
  return (
    <View style={styles.boardSummaryCard}>
      <View style={styles.boardSummaryTopRow}>
        <View style={styles.censusGroup}>
          <Text style={styles.censusValue}>
            {occupiedBedCount}
            <Text style={styles.censusTotal}>/{totalBedCount}</Text>
          </Text>
          <Text style={styles.censusLabel}>Occupied beds</Text>
        </View>
        {flagCount > 0 ? (
          <SeverityBadge
            label={`${flagCount} ${flagCount === 1 ? "flag" : "flags"}`}
            tone="critical"
          />
        ) : (
          <SummaryChip label="No flags" />
        )}
      </View>

      <View style={styles.boardSummaryDetails}>
        <BoardSummaryDetail label="Admitting" value={admittingSideName} />
      </View>
    </View>
  );
}

type BoardSummaryDetailProps = {
  label: string;
  value: string;
};

function BoardSummaryDetail({ label, value }: BoardSummaryDetailProps) {
  return (
    <View style={styles.boardSummaryDetail}>
      <Text style={styles.boardSummaryDetailLabel}>{label}</Text>
      <Text style={styles.boardSummaryDetailValue}>{value}</Text>
    </View>
  );
}

type NurseWorkloadSectionProps = {
  nurseWorkloads: NurseWorkloadViewModel[];
};

type NurseWorkloadRowProps = {
  nurseWorkload: NurseWorkloadViewModel;
};

function NurseWorkloadSection({ nurseWorkloads }: NurseWorkloadSectionProps) {
  return (
    <WorkflowSection title="Nurse workload">
      {nurseWorkloads.length ? (
        <FlatList
          contentContainerStyle={styles.nurseWorkloadListContent}
          data={nurseWorkloads}
          horizontal
          keyExtractor={getNurseWorkloadKey}
          renderItem={renderNurseWorkloadItem}
          showsHorizontalScrollIndicator={false}
        />
      ) : (
        <Text style={styles.emptyWorkloadText}>No nurses added yet.</Text>
      )}
    </WorkflowSection>
  );
}

function renderNurseWorkloadItem({ item }: { item: NurseWorkloadViewModel }) {
  return <NurseWorkloadRow nurseWorkload={item} />;
}

function getNurseWorkloadKey(nurseWorkload: NurseWorkloadViewModel) {
  return nurseWorkload.id;
}

function NurseWorkloadRow({ nurseWorkload }: NurseWorkloadRowProps) {
  return (
    <View style={styles.nurseWorkloadRow}>
      <View style={styles.nurseWorkloadTopRow}>
        <View style={styles.nurseWorkloadNameGroup}>
          <Text style={styles.nurseWorkloadName}>{nurseWorkload.name}</Text>
          <Text style={styles.nurseWorkloadMeta}>
            {nurseWorkload.licenseType} · {nurseWorkload.experience}
          </Text>
        </View>
        <Text style={styles.nurseWorkloadLoad}>
          {nurseWorkload.currentLoad}/{nurseWorkload.maxLoad}
        </Text>
      </View>

      <View style={styles.workloadCoverageBox}>
        <Text style={styles.workloadCoverageText}>{nurseWorkload.team}</Text>
        <Text style={styles.workloadCoverageText}>
          Rooms {nurseWorkload.roomCoverage}
        </Text>
      </View>

      <InlineFlagList flags={nurseWorkload.flags} />
    </View>
  );
}

function InlineFlagList({ flags }: { flags: InlineFlagViewModel[] }) {
  if (!flags.length) {
    return null;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.inlineFlagListContent}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.inlineFlagList}
    >
      {flags.map((flag) => (
        <SeverityBadge key={flag.id} label={flag.label} tone={flag.severity} />
      ))}
    </ScrollView>
  );
}

function getAcuityLabel(acuity?: Acuity) {
  if (!acuity) {
    return "No acuity";
  }

  switch (acuity) {
    case "green":
      return "Low";
    case "yellow":
      return "Medium";
    case "red":
      return "High";
  }
}

function getRoomCoverageNurseIds(activeShift: Shift, roomId: string) {
  return (
    activeShift.assignmentResult?.roomCoverage.find(
      (coverage) => coverage.roomId === roomId,
    )?.nurseIds ?? []
  );
}

function getRoomCoverageLabel(
  activeShift: Shift,
  nurseIds: string[],
  occupiedBedCount: number,
) {
  const nurseNames =
    nurseIds
      .map(
        (nurseId) =>
          activeShift.nurses.find((nurse) => nurse.id === nurseId)?.name,
      )
      .filter(Boolean) ?? [];

  if (nurseNames.length) {
    return nurseNames.join(", ");
  }

  return occupiedBedCount > 0 ? "Uncovered" : "No occupied beds";
}

function roomHasRnCoverage(activeShift: Shift, nurseIds: string[]) {
  return nurseIds.some(
    (nurseId) =>
      activeShift.nurses.find((nurse) => nurse.id === nurseId)?.licenseType ===
      "RN",
  );
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

function getFlagLabel(flag: Flag) {
  switch (flag.type) {
    case "unassigned_bed":
      return "Unassigned";
    case "no_eligible_coverage":
      return "No coverage";
    case "rn_required":
      return "RN needed";
    case "over_side_load_limit":
      return "Side limit";
    case "over_max_load":
      return "Over max";
    case "team_imbalance":
      return "Imbalance";
    case "understaffed":
      return "Understaffed";
    case "validation":
      return "Input";
  }
}

function getInlineFlag(flag: Flag): InlineFlagViewModel {
  return {
    id: flag.id,
    label: getFlagLabel(flag),
    severity: flag.severity,
  };
}

function getBedInlineFlags(activeShift: Shift, bedId: string) {
  return activeShift.flags
    .filter((flag) => flag.bedId === bedId)
    .map(getInlineFlag);
}

function getRoomInlineFlags(activeShift: Shift, roomId: string) {
  return activeShift.flags
    .filter((flag) => flag.roomId === roomId && !flag.bedId)
    .map(getInlineFlag);
}

function getNurseInlineFlags(activeShift: Shift, nurseId: string) {
  return activeShift.flags
    .filter((flag) => flag.nurseId === nurseId)
    .map(getInlineFlag);
}

function getBedAssignmentNurseName(activeShift: Shift, bedId: string) {
  const bedAssignment = activeShift.assignmentResult?.bedAssignments.find(
    (assignment) => assignment.bedId === bedId,
  );

  return activeShift.nurses.find((nurse) => nurse.id === bedAssignment?.nurseId)
    ?.name;
}

function getBoardSides(activeShift?: Shift): BoardSide[] {
  if (!activeShift) {
    return [];
  }

  return activeShift.doctorSides.map((doctorSide) => ({
    id: doctorSide.id,
    name: doctorSide.name,
    admitting: doctorSide.id === activeShift.admittingDoctorSideId,
    rooms: activeShift.rooms
      .filter((room) => room.doctorSideId === doctorSide.id)
      .map((room) => {
        const coverageNurseIds = getRoomCoverageNurseIds(activeShift, room.id);
        const roomFlags = getRoomInlineFlags(activeShift, room.id);
        const beds = activeShift.beds
          .filter((bed) => bed.roomId === room.id)
          .map((bed): BoardBedViewModel => {
            const bedState = activeShift.bedStates.find(
              (shiftBedState) => shiftBedState.bedId === bed.id,
            );
            const isOccupied = isOccupiedBedState(bedState);
            const nurseName = getBedAssignmentNurseName(activeShift, bed.id);
            const bedFlags = getBedInlineFlags(activeShift, bed.id);

            if (!isOccupied) {
              return {
                id: bed.id,
                label: bed.label,
                patient: "Empty",
                acuity: "Empty",
                flags: bedFlags,
                state: "empty",
              };
            }

            return {
              id: bed.id,
              label: bed.label,
              patient: bedState?.patient?.initials.trim() ?? "Occupied",
              acuity: getAcuityLabel(bedState?.acuity),
              acuityValue: bedState?.acuity,
              flags: bedFlags,
              nurse: nurseName,
              state: nurseName ? "assigned" : "unassigned",
            };
          });
        const occupiedBedCount = beds.filter(
          (bed) => bed.state !== "empty",
        ).length;

        return {
          id: room.id,
          label: room.label,
          coverage: getRoomCoverageLabel(
            activeShift,
            coverageNurseIds,
            occupiedBedCount,
          ),
          beds,
          flags: roomFlags,
          hasFlag:
            roomFlags.length > 0 || beds.some((bed) => bed.flags.length > 0),
          hasRnCoverage: roomHasRnCoverage(activeShift, coverageNurseIds),
          roomHasFlag: roomFlags.length > 0,
        };
      }),
  }));
}

function getFilteredBoardSides(
  boardSides: BoardSide[],
  selectedFilter: BoardFilter,
) {
  if (selectedFilter === "All") {
    return boardSides;
  }

  return boardSides
    .map((side) => ({
      ...side,
      rooms: side.rooms.flatMap((room) => {
        if (selectedFilter === "RN coverage") {
          return room.hasRnCoverage ? [room] : [];
        }

        const filteredBeds = room.beds.filter((bed) => {
          if (selectedFilter === "Flags") {
            return bed.flags.length > 0;
          }

          if (selectedFilter === "Unassigned") {
            return bed.state === "unassigned";
          }

          return bed.acuityValue === "red";
        });

        if (selectedFilter === "Flags" && room.roomHasFlag) {
          return [{ ...room, beds: room.beds }];
        }

        return filteredBeds.length ? [{ ...room, beds: filteredBeds }] : [];
      }),
    }))
    .filter((side) => side.rooms.length > 0);
}

function getNurseWorkloads(activeShift?: Shift): NurseWorkloadViewModel[] {
  if (!activeShift) {
    return [];
  }

  return activeShift.nurses.map((nurse) => {
    const team = activeShift.assignmentResult?.generatedTeams.find(
      (generatedTeam) => generatedTeam.nurseIds.includes(nurse.id),
    );
    const coveredRoomLabels =
      activeShift.assignmentResult?.roomCoverage
        .filter((coverage) => coverage.nurseIds.includes(nurse.id))
        .map(
          (coverage) =>
            activeShift.rooms.find((room) => room.id === coverage.roomId)
              ?.label,
        )
        .filter(Boolean) ?? [];
    const currentLoad =
      activeShift.assignmentResult?.bedAssignments.filter(
        (assignment) => assignment.nurseId === nurse.id,
      ).length ?? 0;
    return {
      id: nurse.id,
      name: nurse.name,
      licenseType: nurse.licenseType,
      experience: getExperienceLabel(nurse.experienceLevel),
      team: team?.label ?? "No team yet",
      roomCoverage: coveredRoomLabels.length
        ? coveredRoomLabels.join(", ")
        : "No rooms",
      currentLoad,
      flags: getNurseInlineFlags(activeShift, nurse.id),
      maxLoad: nurse.maxPatientLoad,
    };
  });
}

function EmptyBoardMessage({
  selectedFilter,
}: {
  selectedFilter: BoardFilter;
}) {
  const message =
    selectedFilter === "Flags"
      ? "There are no active flags on this shift board."
      : selectedFilter === "Unassigned"
        ? "All occupied beds on this floor have been assigned to nurses."
        : selectedFilter === "High acuity"
          ? "There are no high acuity (red) patients on this shift."
          : selectedFilter === "RN coverage"
            ? "There are no rooms requiring RN coverage on this shift."
            : "No beds found.";

  return (
    <View style={styles.emptyBoard}>
      <Text style={styles.emptyBoardTitle}>No matching items</Text>
      <Text style={styles.emptyBoardText}>{message}</Text>
    </View>
  );
}

export default function FloorBoardScreen() {
  const { activeShift, realtimeConnectionState, retryLoadWorkspace } =
    useServerWorkspace();
  const [selectedFilter, setSelectedFilter] = useState<BoardFilter>("All");
  const { occupiedBedCount, totalBedCount } = getShiftCensus(activeShift);
  const admittingDoctorSide = activeShift?.doctorSides.find(
    (doctorSide) => doctorSide.id === activeShift.admittingDoctorSideId,
  );
  const activeBoardSides = getFilteredBoardSides(
    getBoardSides(activeShift),
    selectedFilter,
  );
  const boardListItems: FloorBoardListItem[] = activeBoardSides.map((side) => ({
    type: "side",
    side,
  }));
  return (
    <WorkflowListScreen
      activeStep="Board"
      data={boardListItems}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      keyExtractor={getFloorBoardItemKey}
      listHeader={
        <FloorBoardListHeader
          admittingSideName={admittingDoctorSide?.name ?? "-"}
          flagCount={activeShift?.flags.length ?? 0}
          nurseWorkloads={getNurseWorkloads(activeShift)}
          onFilterPress={setSelectedFilter}
          onRefreshLiveStatus={retryLoadWorkspace}
          occupiedBedCount={occupiedBedCount}
          realtimeConnectionState={realtimeConnectionState}
          selectedFilter={selectedFilter}
          totalBedCount={totalBedCount}
        />
      }
      onHeaderActionPress={() => router.push("/")}
      bottomAccessory={<BoardSubTabBar activeTab="board" />}
      renderItem={renderFloorBoardItem}
      ListEmptyComponent={<EmptyBoardMessage selectedFilter={selectedFilter} />}
      subtitle=""
      title={activeShift?.floorName ?? "Floor board"}
    />
  );
}

function renderFloorBoardItem({ item }: { item: FloorBoardListItem }) {
  return <BoardSideSection side={item.side} />;
}

function getFloorBoardItemKey(item: FloorBoardListItem) {
  return `side-${item.side.id}`;
}

function BoardSideSection({ side }: BoardSideSectionProps) {
  return (
    <WorkflowSection
      note={side.admitting ? "Admitting side" : "Non-admitting side"}
      title={side.name}
    >
      {side.rooms.map((room) => (
        <View key={room.id} style={styles.roomSection}>
          <View style={styles.roomHeader}>
            <View>
              <Text style={styles.roomTitle}>Room {room.label}</Text>
              <Text style={styles.roomMeta}>Coverage: {room.coverage}</Text>
            </View>
          </View>
          <InlineFlagList flags={room.flags} />

          {room.beds.map((bed) => (
            <BoardBed key={bed.id} {...bed} />
          ))}
        </View>
      ))}
    </WorkflowSection>
  );
}

function BoardBed({
  label,
  patient,
  acuity,
  flags,
  nurse,
  state,
}: BoardBedProps) {
  const isEmpty = state === "empty";
  const isUnassigned = state === "unassigned";
  const acuityColor = getAcuityColor(acuity);

  return (
    <View
      style={[
        styles.boardBed,
        isEmpty ? styles.emptyBoardBed : null,
        isUnassigned ? styles.unassignedBoardBed : null,
      ]}
    >
      <View style={styles.bedIdentity}>
        <View style={[styles.acuityRail, { backgroundColor: acuityColor }]} />
        <View style={styles.bedCopy}>
          <View style={styles.bedTopLine}>
            <BedChip label={label} />
          </View>
          <Text
            style={[
              styles.patientText,
              isEmpty ? styles.emptyPatientText : null,
            ]}
          >
            {patient}
          </Text>
          <InlineFlagList flags={flags} />
        </View>
      </View>
      {isEmpty ? (
        <StatusPill label="Empty" tone="empty" />
      ) : isUnassigned ? (
        <StatusPill label="Unassigned" tone="red" />
      ) : (
        <Text style={styles.assignedText}>{nurse}</Text>
      )}
    </View>
  );
}

function getAcuityColor(acuity: string) {
  if (acuity === "High") {
    return colors.status.red700;
  }

  if (acuity === "Medium") {
    return colors.status.yellow700;
  }

  if (acuity === "Low") {
    return colors.status.green700;
  }

  return colors.neutral.borderTertiary;
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  boardSummaryCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
  },
  boardSummaryTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  censusGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  censusValue: {
    color: colors.brand.burgundy,
    fontSize: textSize.xl,
    fontWeight: fontWeight.heavy,
    lineHeight: 30,
  },
  censusTotal: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  censusLabel: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  boardSummaryDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  boardSummaryDetail: {
    backgroundColor: colors.neutral.backgroundTertiary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    flex: 1,
    gap: spacing.xs,
    minWidth: 96,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  boardSummaryDetailLabel: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.semibold,
  },
  boardSummaryDetailValue: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  inlineFlagList: {
    maxWidth: "100%",
  },
  inlineFlagListContent: {
    alignItems: "center",
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  emptyWorkloadText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  nurseWorkloadListContent: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  nurseWorkloadRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    width: 220,
  },
  nurseWorkloadTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  nurseWorkloadNameGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  nurseWorkloadName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  nurseWorkloadMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
    fontWeight: fontWeight.medium,
  },
  workloadCoverageBox: {
    backgroundColor: colors.neutral.backgroundTertiary,
    borderRadius: radius.sm,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  workloadCoverageText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  nurseWorkloadLoad: {
    color: colors.brand.burgundy,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  roomSection: {
    backgroundColor: colors.neutral.backgroundPrimary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  roomHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  roomTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  roomMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xs,
  },
  boardBed: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  emptyBoardBed: {
    opacity: 0.72,
  },
  unassignedBoardBed: {
    backgroundColor: colors.status.red50,
    borderColor: colors.status.red700,
    borderWidth: 1.5,
    ...shadows.sm,
  },
  bedIdentity: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    flex: 1,
  },
  acuityRail: {
    borderRadius: 3,
    height: 44,
    width: 5,
  },
  bedCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  bedTopLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  patientText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  emptyPatientText: {
    color: colors.neutral.textSecondary,
  },
  assignedText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  emptyBoard: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.xl,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  emptyBoardTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
    textAlign: "center",
  },
  emptyBoardText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
    textAlign: "center",
  },
});
