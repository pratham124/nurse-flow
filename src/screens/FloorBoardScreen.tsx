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
import { assignmentFlow } from "../utils/workflowFlows";
import { colors, radius, spacing, textSize } from "../theme/tokens";

const nurses = [
  {
    name: "Taylor",
    detail: "RN, experienced",
    team: "Team A",
    rooms: "101, 102",
    load: "2/5",
  },
  {
    name: "Sam",
    detail: "LPN, mid",
    team: "Team B",
    rooms: "101",
    load: "0/6",
  },
];

const boardSides = [
  {
    name: "AB Side",
    admitting: true,
    rooms: [
      {
        label: "101",
        coverage: "Taylor, Sam",
        beds: [
          { label: "101-1", patient: "J.S.", acuity: "Yellow", nurse: "Taylor" },
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

type NurseWorkload = (typeof nurses)[number];
type BoardSide = (typeof boardSides)[number];
type BoardRoom = BoardSide["rooms"][number];
type BoardBedPreview = BoardRoom["beds"][number];
type FloorBoardListItem =
  | { type: "nurse"; nurse: NurseWorkload }
  | { type: "side"; side: BoardSide };

type NurseWorkloadRowProps = {
  nurse: NurseWorkload;
};

type BoardSideSectionProps = {
  side: BoardSide;
};

type BoardBedProps = BoardBedPreview;

type LoadChipProps = {
  value: string;
};

function FloorBoardListHeader() {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection title="Board summary">
        <SummaryTileGrid>
          <SummaryTile value="2/3" label="Occupied" />
          <SummaryTile value="AB" label="Admitting" />
          <SummaryTile value="Assigned" label="Status" />
          <SummaryTile value="2" label="Flags" />
        </SummaryTileGrid>
      </WorkflowSection>

      <WorkflowSection title="Filters">
        <FilterChipRow>
          {boardFilters.map((filter, index) => (
            <FilterChip key={filter} label={filter} selected={index === 0} />
          ))}
        </FilterChipRow>
      </WorkflowSection>

      <View style={styles.workloadHeader}>
        <Text style={styles.workloadTitle}>Nurse workload</Text>
      </View>
    </View>
  );
}

export default function FloorBoardScreen() {
  const boardListItems: FloorBoardListItem[] = [
    ...nurses.map((nurse) => ({ type: "nurse" as const, nurse })),
    ...boardSides.map((side) => ({ type: "side" as const, side })),
  ];

  return (
    <WorkflowListScreen
      activeStep="Board"
      data={boardListItems}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      keyExtractor={getFloorBoardItemKey}
      listHeader={<FloorBoardListHeader />}
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/flags")}
      primaryLabel="View flags"
      renderItem={renderFloorBoardItem}
      subtitle="4 North - assigned preview"
      title="Floor board"
    />
  );
}

function renderFloorBoardItem({ item }: { item: FloorBoardListItem }) {
  if (item.type === "nurse") {
    return <NurseWorkloadRow nurse={item.nurse} />;
  }

  return <BoardSideSection side={item.side} />;
}

function getFloorBoardItemKey(item: FloorBoardListItem) {
  return item.type === "nurse" ? `nurse-${item.nurse.name}` : `side-${item.side.name}`;
}

function NurseWorkloadRow({ nurse }: NurseWorkloadRowProps) {
  return (
    <View style={styles.nurseRow}>
      <View style={styles.nurseAvatar}>
        <Text style={styles.nurseAvatarText}>{nurse.name.charAt(0)}</Text>
      </View>
      <View style={styles.nurseInfo}>
        <View style={styles.nurseTopRow}>
          <Text style={styles.nurseName}>{nurse.name}</Text>
          <LoadChip value={nurse.load} />
        </View>
        <Text style={styles.nurseMeta}>{nurse.detail}</Text>
        <Text style={styles.nurseMeta}>
          {nurse.team} - rooms {nurse.rooms}
        </Text>
      </View>
    </View>
  );
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

function BoardBed({
  label,
  patient,
  acuity,
  nurse,
}: BoardBedProps) {
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
          <Text style={[styles.patientText, isEmpty ? styles.emptyPatientText : null]}>
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

function LoadChip({ value }: LoadChipProps) {
  const [assignedText, capacityText] = value.split("/");
  const assigned = Number(assignedText);
  const capacity = Number(capacityText);
  const isEmpty = assigned === 0;
  const isNearCapacity = capacity > 0 && assigned / capacity >= 0.8;

  return (
    <View
      style={[
        styles.loadChip,
        isEmpty ? styles.emptyLoadChip : null,
        isNearCapacity ? styles.warningLoadChip : null,
      ]}
    >
      <Text
        style={[
          styles.loadChipText,
          isEmpty ? styles.emptyLoadChipText : null,
          isNearCapacity ? styles.warningLoadChipText : null,
        ]}
      >
        {value}
      </Text>
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
  workloadHeader: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  workloadTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "500",
  },
  nurseRow: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  nurseInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  nurseTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  nurseAvatar: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: 18,
    borderWidth: 0.5,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  nurseAvatarText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.action,
    fontWeight: "500",
  },
  nurseName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  nurseMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
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
  loadChip: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
  },
  emptyLoadChip: {
    backgroundColor: colors.status.gray100,
  },
  warningLoadChip: {
    backgroundColor: colors.status.amber50,
  },
  loadChipText: {
    color: colors.neutral.textPrimary,
    fontSize: 13,
    fontWeight: "500",
  },
  emptyLoadChipText: {
    color: colors.status.gray800,
  },
  warningLoadChipText: {
    color: colors.status.amber800,
  },
});
