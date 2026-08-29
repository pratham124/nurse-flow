import { useShallow } from "zustand/react/shallow";
import { memo, useCallback, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AssignmentMoveDialog } from "../components/assignment/AssignmentMoveDialog";

import {
  BedChip,
  BoardSubTabBar,
  FilterChip,
  FilterChipRow,
  LiveStatusChip,
  SeverityBadge,
  StatusPill,
  SummaryChip,
  SwipeRevealAction,
  WorkflowListScreen,
  WorkflowScreen,
  WorkflowSection,
} from "../components/workflow";
import {
  expandedContentMaxWidth,
  useResponsiveLayout,
} from "../hooks/useResponsiveLayout";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import { getShiftCensus, isOccupiedBedState } from "../utils/census";
import {
  createFloorBoardLookup,
  type FloorBoardLookup,
} from "../utils/floorBoardLookup";
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
  nurseId?: string;
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
  onMoveBed: (bedId: string) => void;
  side: BoardSide;
};

type BoardBedProps = BoardBedViewModel & {
  isWrappedByMoveAction?: boolean;
};

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

type ExpandedFloorBoardProps = {
  activeShift?: Shift;
  activeBoardSides: BoardSide[];
  admittingSideName: string;
  flagCount: number;
  nurseWorkloads: NurseWorkloadViewModel[];
  occupiedBedCount: number;
  onFilterPress: (filter: BoardFilter) => void;
  onMoveBed: (bedId: string) => void;
  onRefreshLiveStatus: () => void;
  onSelectNurse: (nurseId: string) => void;
  realtimeConnectionState: RealtimeConnectionState;
  selectedFilter: BoardFilter;
  selectedNurseId?: string;
  totalBedCount: number;
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

function getRoomCoverageLabel(
  lookup: FloorBoardLookup,
  nurseIds: string[],
  occupiedBedCount: number,
) {
  const nurseNames =
    nurseIds
      .map((nurseId) => lookup.nurseById.get(nurseId)?.name)
      .filter(Boolean) ?? [];

  if (nurseNames.length) {
    return nurseNames.join(", ");
  }

  return occupiedBedCount > 0 ? "Uncovered" : "No occupied beds";
}

function roomHasRnCoverage(lookup: FloorBoardLookup, nurseIds: string[]) {
  return nurseIds.some(
    (nurseId) => lookup.nurseById.get(nurseId)?.licenseType === "RN",
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

function getBoardSides(
  activeShift: Shift,
  lookup: FloorBoardLookup,
): BoardSide[] {
  return activeShift.doctorSides.map((doctorSide) => ({
    id: doctorSide.id,
    name: doctorSide.name,
    admitting: doctorSide.id === activeShift.admittingDoctorSideId,
    rooms: (lookup.roomsByDoctorSideId.get(doctorSide.id) ?? [])
      .map((room) => {
        const coverageNurseIds =
          lookup.roomCoverageNurseIdsByRoomId.get(room.id) ?? [];
        const roomFlags = (lookup.roomFlagsByRoomId.get(room.id) ?? []).map(
          getInlineFlag,
        );
        const beds = (lookup.bedsByRoomId.get(room.id) ?? [])
          .map((bed): BoardBedViewModel => {
            const bedState = lookup.bedStateByBedId.get(bed.id);
            const isOccupied = isOccupiedBedState(bedState);
            const nurseId = lookup.assignmentByBedId.get(bed.id)?.nurseId;
            const nurseName = nurseId
              ? lookup.nurseById.get(nurseId)?.name
              : undefined;
            const bedFlags = (lookup.bedFlagsByBedId.get(bed.id) ?? []).map(
              getInlineFlag,
            );

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
              nurseId,
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
            lookup,
            coverageNurseIds,
            occupiedBedCount,
          ),
          beds,
          flags: roomFlags,
          hasFlag:
            roomFlags.length > 0 || beds.some((bed) => bed.flags.length > 0),
          hasRnCoverage: roomHasRnCoverage(lookup, coverageNurseIds),
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

function getNurseWorkloads(
  activeShift: Shift,
  lookup: FloorBoardLookup,
): NurseWorkloadViewModel[] {
  return activeShift.nurses.map((nurse) => {
    const coveredRoomLabels = lookup.roomLabelsByNurseId.get(nurse.id) ?? [];

    return {
      id: nurse.id,
      name: nurse.name,
      licenseType: nurse.licenseType,
      experience: getExperienceLabel(nurse.experienceLevel),
      team:
        lookup.generatedTeamLabelByNurseId.get(nurse.id) ?? "No team yet",
      roomCoverage: coveredRoomLabels.length
        ? coveredRoomLabels.join(", ")
        : "No rooms",
      currentLoad: lookup.assignedBedCountByNurseId.get(nurse.id) ?? 0,
      flags: (lookup.nurseFlagsByNurseId.get(nurse.id) ?? []).map(getInlineFlag),
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

function getNurseBoardSides(boardSides: BoardSide[], nurseId: string) {
  return boardSides.flatMap((side) => {
    const rooms = side.rooms.flatMap((room) => {
      const beds = room.beds.filter((bed) => bed.nurseId === nurseId);

      return beds.length ? [{ ...room, beds }] : [];
    });

    return rooms.length ? [{ ...side, rooms }] : [];
  });
}

function getSideNurseWorkloads(
  side: BoardSide,
  nurseWorkloads: NurseWorkloadViewModel[],
) {
  const nurseIds = new Set(
    side.rooms.flatMap((room) =>
      room.beds.flatMap((bed) => (bed.nurseId ? [bed.nurseId] : [])),
    ),
  );

  return nurseWorkloads.filter((nurse) => nurseIds.has(nurse.id));
}

function ExpandedFloorBoard({
  activeShift,
  activeBoardSides,
  admittingSideName,
  flagCount,
  nurseWorkloads,
  occupiedBedCount,
  onFilterPress,
  onMoveBed,
  onRefreshLiveStatus,
  onSelectNurse,
  realtimeConnectionState,
  selectedFilter,
  selectedNurseId,
  totalBedCount,
}: ExpandedFloorBoardProps) {
  const selectedNurse = nurseWorkloads.find(
    (nurse) => nurse.id === selectedNurseId,
  );
  const selectedNurseSides = selectedNurse
    ? getNurseBoardSides(activeBoardSides, selectedNurse.id)
    : [];

  return (
    <WorkflowScreen
      activeStep="Board"
      bottomAccessory={<BoardSubTabBar activeTab="board" />}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      managesOwnScrolling
      onHeaderActionPress={() => router.push("/")}
      subtitle=""
      title={activeShift?.floorName ?? "Floor board"}
    >
      <View style={styles.expandedContent}>
        <ScrollView
          contentContainerStyle={styles.expandedPaneContent}
          keyboardShouldPersistTaps="handled"
          style={styles.expandedSummaryPane}
        >
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
          {activeBoardSides.map((side) => {
            const sideNurses = getSideNurseWorkloads(side, nurseWorkloads);

            return (
              <WorkflowSection
                key={side.id}
                note={side.admitting ? "Admitting side" : "Non-admitting side"}
                title={side.name}
              >
                {sideNurses.length ? (
                  sideNurses.map((nurse) => {
                    const isSelected = nurse.id === selectedNurse?.id;

                    return (
                      <Pressable
                        accessibilityLabel={`${nurse.name}, ${nurse.currentLoad} of ${nurse.maxLoad} patients`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={nurse.id}
                        onPress={() => onSelectNurse(nurse.id)}
                        style={({ pressed }) => [
                          styles.expandedNurseRow,
                          isSelected ? styles.selectedExpandedNurseRow : null,
                          pressed ? styles.expandedNurseRowPressed : null,
                        ]}
                      >
                        <View style={styles.expandedNurseCopy}>
                          <Text style={styles.nurseWorkloadName}>{nurse.name}</Text>
                          <Text style={styles.nurseWorkloadMeta}>
                            {nurse.licenseType} · {nurse.roomCoverage}
                          </Text>
                        </View>
                        <Text style={styles.nurseWorkloadLoad}>
                          {nurse.currentLoad}/{nurse.maxLoad}
                        </Text>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.emptyWorkloadText}>
                    No assigned nurses match this filter.
                  </Text>
                )}
              </WorkflowSection>
            );
          })}
        </ScrollView>

        <ScrollView
          contentContainerStyle={styles.expandedPaneContent}
          keyboardShouldPersistTaps="handled"
          style={styles.expandedDetailPane}
        >
          {selectedNurse ? (
            <>
              <WorkflowSection
                note={`${selectedNurse.currentLoad} of ${selectedNurse.maxLoad} patients`}
                title={selectedNurse.name}
              >
                <Text style={styles.selectedNurseMeta}>
                  {selectedNurse.licenseType} · {selectedNurse.experience}
                </Text>
                <Text style={styles.selectedNurseMeta}>
                  Coverage: {selectedNurse.roomCoverage}
                </Text>
                <InlineFlagList flags={selectedNurse.flags} />
              </WorkflowSection>
              {selectedNurseSides.map((side) => (
                <BoardSideSection
                  key={side.id}
                  onMoveBed={onMoveBed}
                  side={side}
                />
              ))}
              {!selectedNurseSides.length ? (
                <View style={styles.emptyBoard}>
                  <Text style={styles.emptyBoardTitle}>No matching beds</Text>
                  <Text style={styles.emptyBoardText}>
                    This nurse has no beds in the current board filter.
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.emptyBoard}>
              <Text style={styles.emptyBoardTitle}>Choose a nurse</Text>
              <Text style={styles.emptyBoardText}>
                Select a nurse summary to review rooms, beds, and move actions.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </WorkflowScreen>
  );
}

export default function FloorBoardScreen() {
  const { isExpanded } = useResponsiveLayout();
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
  const [selectedFilter, setSelectedFilter] = useState<BoardFilter>("All");
  const [selectedMoveBedId, setSelectedMoveBedId] = useState<string>();
  const [selectedNurseId, setSelectedNurseId] = useState<string>();
  const effectiveShift = useMemo(
    () =>
      activeShift
        ? {
            ...activeShift,
            assignmentResult: effectiveAssignmentResult,
            flags: effectiveAssignmentFlags,
          }
        : undefined,
    [activeShift, effectiveAssignmentFlags, effectiveAssignmentResult],
  );
  const floorBoardLookup = useMemo(
    () => (effectiveShift ? createFloorBoardLookup(effectiveShift) : undefined),
    [effectiveShift],
  );
  const { occupiedBedCount, totalBedCount } = useMemo(
    () => getShiftCensus(effectiveShift),
    [effectiveShift],
  );
  const admittingDoctorSide = effectiveShift?.doctorSides.find(
    (doctorSide) => doctorSide.id === effectiveShift.admittingDoctorSideId,
  );
  const boardSides = useMemo(
    () =>
      effectiveShift && floorBoardLookup
        ? getBoardSides(effectiveShift, floorBoardLookup)
        : [],
    [effectiveShift, floorBoardLookup],
  );
  const activeBoardSides = useMemo(
    () => getFilteredBoardSides(boardSides, selectedFilter),
    [boardSides, selectedFilter],
  );
  const boardListItems = useMemo<FloorBoardListItem[]>(
    () =>
      activeBoardSides.map((side) => ({
        type: "side",
        side,
      })),
    [activeBoardSides],
  );
  const nurseWorkloads = useMemo(
    () =>
      effectiveShift && floorBoardLookup
        ? getNurseWorkloads(effectiveShift, floorBoardLookup)
        : [],
    [effectiveShift, floorBoardLookup],
  );
  const effectiveSelectedNurseId = nurseWorkloads.some(
    (nurse) => nurse.id === selectedNurseId,
  )
    ? selectedNurseId
    : nurseWorkloads[0]?.id;
  const renderBoardSideItem = useCallback(
    ({ item }: { item: FloorBoardListItem }) => (
      <BoardSideSection
        onMoveBed={setSelectedMoveBedId}
        side={item.side}
      />
    ),
    [],
  );

  return (
    <>
      {isExpanded ? (
        <ExpandedFloorBoard
          activeBoardSides={activeBoardSides}
          activeShift={activeShift}
          admittingSideName={admittingDoctorSide?.name ?? "-"}
          flagCount={effectiveAssignmentFlags.length}
          nurseWorkloads={nurseWorkloads}
          occupiedBedCount={occupiedBedCount}
          onFilterPress={setSelectedFilter}
          onMoveBed={setSelectedMoveBedId}
          onRefreshLiveStatus={retryLoadWorkspace}
          onSelectNurse={setSelectedNurseId}
          realtimeConnectionState={realtimeConnectionState}
          selectedFilter={selectedFilter}
          selectedNurseId={effectiveSelectedNurseId}
          totalBedCount={totalBedCount}
        />
      ) : (
        <WorkflowListScreen
          activeStep="Board"
          bottomAccessory={<BoardSubTabBar activeTab="board" />}
          data={boardListItems}
          flow={assignmentFlow}
          headerActionLabel="Floors"
          keyExtractor={getFloorBoardItemKey}
          ListEmptyComponent={
            <EmptyBoardMessage selectedFilter={selectedFilter} />
          }
          listHeader={
            <FloorBoardListHeader
              admittingSideName={admittingDoctorSide?.name ?? "-"}
              flagCount={effectiveAssignmentFlags.length}
              nurseWorkloads={nurseWorkloads}
              occupiedBedCount={occupiedBedCount}
              onFilterPress={setSelectedFilter}
              onRefreshLiveStatus={retryLoadWorkspace}
              realtimeConnectionState={realtimeConnectionState}
              selectedFilter={selectedFilter}
              totalBedCount={totalBedCount}
            />
          }
          onHeaderActionPress={() => router.push("/")}
          renderItem={renderBoardSideItem}
          subtitle=""
          title={activeShift?.floorName ?? "Floor board"}
        />
      )}
      {activeShift && effectiveAssignmentResult ? (
        <AssignmentMoveDialog
          activeShift={activeShift}
          bedId={selectedMoveBedId}
          effectiveAssignmentResult={effectiveAssignmentResult}
          onClose={() => setSelectedMoveBedId(undefined)}
          visible={Boolean(selectedMoveBedId)}
        />
      ) : null}
    </>
  );
}

function getFloorBoardItemKey(item: FloorBoardListItem) {
  return `side-${item.side.id}`;
}

const BoardSideSection = memo(function BoardSideSection({
  onMoveBed,
  side,
}: BoardSideSectionProps) {
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

          {room.beds.map((bed) =>
            bed.state === "assigned" ? (
              <SwipeRevealAction
                accessibilityLabel={`Move bed ${bed.label}, ${bed.patient}, ${bed.acuity} acuity, currently assigned to ${bed.nurse}`}
                actionLabel="Move"
                actionTone="brand"
                enableAccessibilityReveal
                key={bed.id}
                onActionPress={() => onMoveBed(bed.id)}
              >
                <BoardBed {...bed} isWrappedByMoveAction />
              </SwipeRevealAction>
            ) : (
              <BoardBed key={bed.id} {...bed} />
            ),
          )}
        </View>
      ))}
    </WorkflowSection>
  );
});

function BoardBed({
  label,
  patient,
  acuity,
  flags,
  isWrappedByMoveAction = false,
  nurse,
  state,
}: BoardBedProps) {
  const isEmpty = state === "empty";
  const isUnassigned = state === "unassigned";
  const acuityColor = getAcuityColor(acuity);

  return (
    <View
      accessibilityLabel={`Bed ${label}, ${patient}, ${isEmpty ? "empty" : `${acuity} acuity`}, ${isUnassigned ? "unassigned" : nurse ? `assigned to ${nurse}` : "not assigned"}`}
      accessibilityElementsHidden={isWrappedByMoveAction}
      accessible={!isWrappedByMoveAction}
      importantForAccessibility={
        isWrappedByMoveAction ? "no-hide-descendants" : "auto"
      }
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
          {!isEmpty ? (
            <Text style={styles.acuityText}>Acuity: {acuity}</Text>
          ) : null}
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
  expandedContent: {
    alignSelf: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.lg,
    maxWidth: expandedContentMaxWidth,
    padding: spacing.xl,
    width: "100%",
  },
  expandedSummaryPane: {
    flex: 0.9,
  },
  expandedDetailPane: {
    flex: 1.4,
  },
  expandedPaneContent: {
    gap: spacing.cardGap,
    paddingBottom: spacing.xl,
  },
  expandedNurseRow: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundTertiary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 56,
    padding: spacing.md,
  },
  selectedExpandedNurseRow: {
    backgroundColor: colors.brand.burgundy10,
    borderColor: colors.brand.burgundy,
    borderWidth: 2,
  },
  expandedNurseRowPressed: {
    opacity: 0.82,
  },
  expandedNurseCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  selectedNurseMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
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
  acuityText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.medium,
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
