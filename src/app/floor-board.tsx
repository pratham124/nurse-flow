import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  WorkflowSection,
  WorkflowScreen,
  SummaryChip,
} from "../components/workflow";
import { assignmentFlow } from "../constants/workflowFlows";
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
        <View style={styles.summaryRow}>
          <SummaryChip label="2/3 occupied" />
          <SummaryChip label="AB admitting" />
          <SummaryChip label="Assigned" />
          <SummaryChip label="2 flags" />
        </View>
      </WorkflowSection>

      <WorkflowSection title="Filters">
        <View style={styles.summaryRow}>
          {["All", "Flags", "Unassigned", "Red", "RN coverage"].map(
            (filter) => (
              <SummaryChip key={filter} label={filter} />
            ),
          )}
        </View>
      </WorkflowSection>

      <WorkflowSection
        note="Every nurse stays visible, even when a nurse has no assigned beds."
        title="Nurse workload"
      >
        {nurses.map((nurse) => (
          <View key={nurse.name} style={styles.nurseRow}>
            <View style={styles.nurseTopRow}>
              <Text style={styles.nurseName}>{nurse.name}</Text>
              <SummaryChip label={nurse.load} />
            </View>
            <Text style={styles.nurseMeta}>{nurse.detail}</Text>
            <Text style={styles.nurseMeta}>
              {nurse.team} - rooms {nurse.rooms}
            </Text>
          </View>
        ))}
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
                <Text style={styles.roomTitle}>Room {room.label}</Text>
                <SummaryChip label={`Coverage: ${room.coverage}`} />
              </View>

              <View style={styles.bedList}>
                {room.beds.map((bed) => (
                  <BoardBed key={bed.label} {...bed} />
                ))}
              </View>
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
        <View>
          <BedChip label={label} />
          <Text style={styles.patientText}>{patient}</Text>
        </View>
      </View>
      <Text style={styles.assignedText}>{isEmpty ? "Not assigned" : nurse}</Text>
    </View>
  );
}

function getAcuityColor(acuity: string) {
  if (acuity === "Red") {
    return colors.acuity.red;
  }

  if (acuity === "Yellow") {
    return colors.acuity.yellow;
  }

  if (acuity === "Green") {
    return colors.acuity.green;
  }

  return colors.neutral.border;
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  nurseRow: {
    borderTopColor: colors.neutral.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  nurseTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  nurseName: {
    color: colors.neutral.text,
    fontSize: textSize.md,
    fontWeight: "700",
  },
  nurseMeta: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
  },
  roomSection: {
    borderTopColor: colors.neutral.border,
    borderTopWidth: 1,
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  roomHeader: {
    gap: spacing.sm,
  },
  roomTitle: {
    color: colors.neutral.text,
    fontSize: textSize.md,
    fontWeight: "700",
  },
  bedList: {
    gap: spacing.sm,
  },
  boardBed: {
    alignItems: "center",
    backgroundColor: colors.neutral.background,
    borderColor: colors.neutral.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    padding: spacing.sm,
  },
  emptyBoardBed: {
    opacity: 0.72,
  },
  bedIdentity: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  acuityRail: {
    borderRadius: 3,
    height: 36,
    width: 6,
  },
  patientText: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
    marginTop: spacing.xs,
  },
  assignedText: {
    color: colors.neutral.text,
    fontSize: textSize.sm,
    fontWeight: "700",
  },
});
