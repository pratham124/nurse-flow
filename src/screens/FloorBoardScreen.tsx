import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  FilterChip,
  FilterChipRow,
  ScrollableList,
  StatusPill,
  SummaryTile,
  SummaryTileGrid,
  WorkflowSection,
  WorkflowScreen,
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

export default function FloorBoardScreen() {
  return (
    <WorkflowScreen
      activeStep="Board"
      headerActionLabel="Floors"
      helperText="Static board preview only. Editing and re-run behavior come later."
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/flags")}
      primaryLabel="View flags"
      flow={assignmentFlow}
      subtitle="4 North - assigned preview"
      title="Floor board"
    >
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
          {["All", "Flags", "Unassigned", "Red", "RN coverage"].map(
            (filter, index) => (
              <FilterChip key={filter} label={filter} selected={index === 0} />
            ),
          )}
        </FilterChipRow>
      </WorkflowSection>

      <WorkflowSection
        note="Every nurse stays visible, even when a nurse has no assigned beds."
        title="Nurse workload"
      >
        <ScrollableList maxHeight={280}>
          {nurses.map((nurse, index) => (
            <View
              key={nurse.name}
              style={[styles.nurseRow, index > 0 ? styles.dividedRow : null]}
            >
              <View style={styles.nurseAvatar}>
                <Text style={styles.nurseAvatarText}>
                  {nurse.name.charAt(0)}
                </Text>
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
          ))}
        </ScrollableList>
      </WorkflowSection>

      {boardSides.map((side) => (
        <WorkflowSection
          key={side.name}
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

              <ScrollableList maxHeight={320}>
                {room.beds.map((bed) => (
                  <BoardBed key={bed.label} {...bed} />
                ))}
              </ScrollableList>
            </View>
          ))}
        </WorkflowSection>
      ))}
    </WorkflowScreen>
  );
}

function BoardBed({
  label,
  patient,
  acuity,
  nurse,
}: {
  label: string;
  patient: string;
  acuity: string;
  nurse: string;
}) {
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

function LoadChip({ value }: { value: string }) {
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
  nurseRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
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
  dividedRow: {
    borderTopColor: colors.neutral.borderTertiary,
    borderTopWidth: 0.5,
  },
});
