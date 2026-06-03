import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  FilterChip,
  FilterChipRow,
  StatusPill,
  SummaryTile,
  SummaryTileGrid,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { getShiftCensus } from "../utils/census";
import { assignmentFlow } from "../utils/workflowFlows";
import { colors, radius, spacing, textSize } from "../theme/tokens";
import type { Acuity, Shift } from "../types/models";

const boardSides = [
  {
    name: "AB Side",
    admitting: true,
    rooms: [
      {
        label: "101",
        coverage: "Taylor, Sam",
        beds: [
          {
            label: "101-1",
            patient: "J.S.",
            acuity: "Yellow",
            nurse: "Taylor",
          },
          { label: "101-2", patient: "Empty", acuity: "Empty", nurse: "Open" },
        ],
      },
    ],
  },
  {
    name: "SK Side",
    admitting: false,
    rooms: [
      {
        label: "102",
        coverage: "Taylor",
        beds: [
          { label: "102-1", patient: "M.R.", acuity: "Red", nurse: "Taylor" },
        ],
      },
    ],
  },
];

const boardFilters = ["All", "Flags", "Unassigned", "Red", "RN coverage"];

type BoardBedPreview = {
  label: string;
  patient: string;
  acuity: string;
  nurse: string;
};
type BoardRoom = {
  label: string;
  coverage: string;
  beds: BoardBedPreview[];
};
type BoardSide = {
  name: string;
  admitting: boolean;
  rooms: BoardRoom[];
};
type FloorBoardListItem = { type: "side"; side: BoardSide };

type BoardSideSectionProps = {
  side: BoardSide;
};

type BoardBedProps = BoardBedPreview;

type FloorBoardListHeaderProps = {
  occupiedBedCount: number;
  totalBedCount: number;
  admittingSideName: string;
  flagCount: number;
  status: string;
};

function FloorBoardListHeader({
  admittingSideName,
  flagCount,
  occupiedBedCount,
  status,
  totalBedCount,
}: FloorBoardListHeaderProps) {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection title="Board summary">
        <SummaryTileGrid>
          <SummaryTile
            value={`${occupiedBedCount}/${totalBedCount}`}
            label="Occupied"
          />
          <SummaryTile value={admittingSideName} label="Admitting" />
          <SummaryTile value={status} label="Status" />
          <SummaryTile value={flagCount.toString()} label="Flags" />
        </SummaryTileGrid>
      </WorkflowSection>

      <WorkflowSection title="Filters">
        <FilterChipRow>
          {boardFilters.map((filter, index) => (
            <FilterChip key={filter} label={filter} selected={index === 0} />
          ))}
        </FilterChipRow>
      </WorkflowSection>
    </View>
  );
}

function getAcuityLabel(acuity?: Acuity) {
  if (!acuity) {
    return "Empty";
  }

  return acuity.charAt(0).toUpperCase() + acuity.slice(1);
}

function getRoomCoverageLabel(activeShift: Shift, roomId: string) {
  const roomCoverage = activeShift.assignmentResult?.roomCoverage.find(
    (coverage) => coverage.roomId === roomId,
  );
  const nurseNames =
    roomCoverage?.nurseIds
      .map(
        (nurseId) =>
          activeShift.nurses.find((nurse) => nurse.id === nurseId)?.name,
      )
      .filter(Boolean) ?? [];

  return nurseNames.length ? nurseNames.join(", ") : "No coverage yet";
}

function getBedAssignmentNurseName(activeShift: Shift, bedId: string) {
  const bedAssignment = activeShift.assignmentResult?.bedAssignments.find(
    (assignment) => assignment.bedId === bedId,
  );

  return (
    activeShift.nurses.find((nurse) => nurse.id === bedAssignment?.nurseId)
      ?.name ?? "Open"
  );
}

function getBoardSides(activeShift?: Shift): BoardSide[] {
  if (!activeShift?.assignmentResult) {
    return boardSides;
  }

  return activeShift.doctorSides.map((doctorSide) => ({
    name: doctorSide.name,
    admitting: doctorSide.id === activeShift.admittingDoctorSideId,
    rooms: activeShift.rooms
      .filter((room) => room.doctorSideId === doctorSide.id)
      .map((room) => ({
        label: room.label,
        coverage: getRoomCoverageLabel(activeShift, room.id),
        beds: activeShift.beds
          .filter((bed) => bed.roomId === room.id)
          .map((bed) => {
            const bedState = activeShift.bedStates.find(
              (shiftBedState) => shiftBedState.bedId === bed.id,
            );
            const patientInitials = bedState?.patient?.initials.trim();

            return {
              label: bed.label,
              patient: patientInitials || "Empty",
              acuity: patientInitials
                ? getAcuityLabel(bedState?.acuity)
                : "Empty",
              nurse: getBedAssignmentNurseName(activeShift, bed.id),
            };
          }),
      })),
  }));
}

export default function FloorBoardScreen() {
  const { localState } = useLocalState();
  const activeShift = localState.activeShift;
  const { occupiedBedCount, totalBedCount } = getShiftCensus(activeShift);
  const admittingDoctorSide = activeShift?.doctorSides.find(
    (doctorSide) => doctorSide.id === activeShift.admittingDoctorSideId,
  );
  const activeBoardSides = getBoardSides(activeShift);
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
          admittingSideName={admittingDoctorSide?.name ?? "AB"}
          flagCount={activeShift?.flags.length ?? 2}
          occupiedBedCount={occupiedBedCount}
          status={activeShift?.status === "assigned" ? "Assigned" : "Preview"}
          totalBedCount={totalBedCount}
        />
      }
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/flags")}
      primaryLabel="View flags"
      renderItem={renderFloorBoardItem}
      subtitle="Assigned floor board"
      title={activeShift?.floorName ?? "Floor board"}
    />
  );
}

function renderFloorBoardItem({ item }: { item: FloorBoardListItem }) {
  return <BoardSideSection side={item.side} />;
}

function getFloorBoardItemKey(item: FloorBoardListItem) {
  return `side-${item.side.name}`;
}

function BoardSideSection({ side }: BoardSideSectionProps) {
  return (
    <WorkflowSection
      note={side.admitting ? "Admitting side" : "Non-admitting side"}
      title={side.name}
    >
      {side.rooms.map((room) => (
        <View key={room.label} style={styles.roomSection}>
          <View style={styles.roomHeader}>
            <View>
              <Text style={styles.roomTitle}>Room {room.label}</Text>
              <Text style={styles.roomMeta}>Coverage: {room.coverage}</Text>
            </View>
          </View>

          {room.beds.map((bed) => (
            <BoardBed key={bed.label} {...bed} />
          ))}
        </View>
      ))}
    </WorkflowSection>
  );
}

function BoardBed({ label, patient, acuity, nurse }: BoardBedProps) {
  const isEmpty = patient === "Empty";
  const acuityColor = getAcuityColor(acuity);

  return (
    <View style={[styles.boardBed, isEmpty ? styles.emptyBoardBed : null]}>
      <View style={styles.bedIdentity}>
        <View style={[styles.acuityRail, { backgroundColor: acuityColor }]} />
        <View style={styles.bedCopy}>
          <View style={styles.bedTopLine}>
            <BedChip label={label} />
            {acuity !== "Empty" ? (
              <Text style={styles.acuityText}>{acuity}</Text>
            ) : null}
          </View>
          <Text
            style={[
              styles.patientText,
              isEmpty ? styles.emptyPatientText : null,
            ]}
          >
            {patient}
          </Text>
        </View>
      </View>
      {isEmpty || nurse === "Open" ? (
        <StatusPill label="Not assigned" tone="empty" />
      ) : (
        <Text style={styles.assignedText}>{nurse}</Text>
      )}
    </View>
  );
}

function getAcuityColor(acuity: string) {
  if (acuity === "Red") {
    return colors.status.red700;
  }

  if (acuity === "Yellow") {
    return colors.status.yellow700;
  }

  if (acuity === "Green") {
    return colors.status.green700;
  }

  return colors.neutral.borderTertiary;
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  roomSection: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
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
    fontWeight: "500",
  },
  roomMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
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
  },
  emptyBoardBed: {
    opacity: 0.72,
  },
  bedIdentity: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    flex: 1,
  },
  acuityRail: {
    borderRadius: 2,
    height: 44,
    width: 4,
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
  acuityText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
  },
  patientText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
  },
  emptyPatientText: {
    color: colors.neutral.textSecondary,
  },
  assignedText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: "500",
  },
});
