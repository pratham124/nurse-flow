import { useEffect } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  SeverityBadge,
  SummaryTile,
  SummaryTileGrid,
  StatusPill,
  WorkflowSection,
  WorkflowScreen,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { assignmentFlow } from "../utils/workflowFlows";
import { colors, radius, spacing, textSize, fontWeight, shadows } from "../theme/tokens";
import { getShiftCensus } from "../utils/census";
import {
  getAssignmentValidation,
  type AssignmentValidationBlocker,
} from "../utils/assignmentValidation";
import {
  getAssignmentNeedSummary,
  type AssignmentNeedSideSummary,
  type AssignmentNeedRoomSummary,
} from "../utils/assignmentNeedSummary";
import { generateAssignmentFlags } from "../utils/assignmentFlags";
import { generateLocalAssignmentResult } from "../utils/assignmentTeams";

type AssignmentReviewListHeaderProps = {
  admittingSideName: string;
  blockers: AssignmentValidationBlocker[];
  nurseCount: number;
  occupiedBedCount: number;
  patientNeedSummary: AssignmentNeedSideSummary[];
  redBedCount: number;
  totalNurseCapacity: number;
  totalBedCount: number;
};

type PatientNeedSectionProps = {
  sides: AssignmentNeedSideSummary[];
};

type PatientNeedRoomRowProps = {
  room: AssignmentNeedRoomSummary;
};

function getCountLabel(
  count: number,
  singularLabel: string,
  pluralLabel: string,
) {
  return count === 1 ? singularLabel : pluralLabel;
}

function getAcuityMixLabel(
  acuityCounts: AssignmentNeedRoomSummary["acuityCounts"],
) {
  return `${acuityCounts.green} Low / ${acuityCounts.yellow} Medium / ${acuityCounts.red} High`;
}

function PatientNeedSection({ sides }: PatientNeedSectionProps) {
  return (
    <WorkflowSection title="Patient Summary">
      {sides.map((side) => (
        <View key={side.id} style={styles.needSide}>
          <View style={styles.needSideHeader}>
            <Text style={styles.needSideTitle}>{side.name}</Text>
            <Text style={styles.needSideMeta}>
              {side.occupiedBedCount}{" "}
              {getCountLabel(side.occupiedBedCount, "patient", "patients")} -{" "}
              {getAcuityMixLabel(side.acuityCounts)}
            </Text>
          </View>

          {side.rooms.map((room) => (
            <PatientNeedRoomRow key={room.id} room={room} />
          ))}
        </View>
      ))}
    </WorkflowSection>
  );
}

function PatientNeedRoomRow({ room }: PatientNeedRoomRowProps) {
  return (
    <View style={styles.needRoom}>
      <View style={styles.needRoomHeader}>
        <Text style={styles.needRoomTitle}>Room {room.label}</Text>
        <Text style={styles.needRoomMeta}>
          {room.occupiedBedCount}{" "}
          {getCountLabel(room.occupiedBedCount, "patient", "patients")}
        </Text>
      </View>

      <View style={styles.acuityPillRow}>
        <StatusPill label={room.acuityCounts.green.toString()} tone="green" />
        <StatusPill label={room.acuityCounts.yellow.toString()} tone="yellow" />
        <StatusPill label={room.acuityCounts.red.toString()} tone="red" />
      </View>

      {room.redBedLabels.length ? (
        <Text style={styles.redBedText}>
          RN coverage needed: {room.redBedLabels.join(", ")}
        </Text>
      ) : null}
    </View>
  );
}

function AssignmentReviewListHeader({
  admittingSideName,
  blockers,
  nurseCount,
  occupiedBedCount,
  patientNeedSummary,
  redBedCount,
  totalNurseCapacity,
  totalBedCount,
}: AssignmentReviewListHeaderProps) {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection title="Shift summary">
        <SummaryTileGrid>
          <SummaryTile
            value={`${occupiedBedCount}/${totalBedCount}`}
            label="Occupied"
          />
          <SummaryTile
            value={nurseCount.toString()}
            label={getCountLabel(nurseCount, "Nurse", "Nurses")}
          />
          <SummaryTile value={totalNurseCapacity.toString()} label="Capacity" />
          <SummaryTile
            value={redBedCount.toString()}
            label={getCountLabel(redBedCount, "Red bed", "Red beds")}
          />
          <SummaryTile value={admittingSideName} label="Admitting" />
        </SummaryTileGrid>
      </WorkflowSection>

      <PatientNeedSection sides={patientNeedSummary} />

      {blockers.length ? (
        <WorkflowSection
          note="Fix these before running assignment."
          title="Assignment blockers"
        >
          {blockers.map((blocker) => (
            <View key={blocker.id} style={styles.blockerRow}>
              <SeverityBadge label={`⚠️ ${blocker.label}`} tone="warning" />
              <Text style={styles.blockerText}>{blocker.message}</Text>
            </View>
          ))}
        </WorkflowSection>
      ) : null}
    </View>
  );
}

export default function AssignmentReviewScreen() {
  const { localState, setLocalState } = useLocalState();
  const activeShift = localState.activeShift;
  const nurses = activeShift?.nurses ?? [];
  const validation = getAssignmentValidation(activeShift);
  const patientNeedSummary = getAssignmentNeedSummary(activeShift);
  const admittingDoctorSide = activeShift?.doctorSides.find(
    (doctorSide) => doctorSide.id === activeShift.admittingDoctorSideId,
  );
  const { occupiedBedCount, totalBedCount } = getShiftCensus(activeShift);
  const firstBlockerMessage = validation.blockers[0]?.message ?? "";

  useEffect(() => {
    if (!activeShift) {
      router.replace("/start-shift");
    }
  }, [activeShift]);

  function handlePrimaryPress() {
    if (!activeShift) {
      router.replace("/start-shift");
      return;
    }

    if (!validation.canRunAssignment) {
      return;
    }

    setLocalState((currentState) => {
      const currentShift = currentState.activeShift;

      if (!currentShift) {
        return currentState;
      }

      const assignmentResult = generateLocalAssignmentResult(currentShift);

      return {
        ...currentState,
        activeShift: {
          ...currentShift,
          assignmentResult,
          flags: generateAssignmentFlags(currentShift, assignmentResult),
          status: "assigned",
        },
      };
    });

    router.push("/floor-board");
  }

  return (
    <WorkflowScreen
      activeStep="Assign"
      actionErrorText={firstBlockerMessage}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={handlePrimaryPress}
      primaryDisabled={!validation.canRunAssignment}
      primaryLabel="Run local assignment"
      subtitle=""
      title={activeShift?.floorName ?? "Assignment review"}
    >
      <AssignmentReviewListHeader
        admittingSideName={admittingDoctorSide?.name ?? "-"}
        blockers={validation.blockers}
        nurseCount={nurses.length}
        occupiedBedCount={occupiedBedCount}
        patientNeedSummary={patientNeedSummary.sides}
        redBedCount={patientNeedSummary.totalRedBedCount}
        totalNurseCapacity={validation.totalNurseCapacity}
        totalBedCount={totalBedCount}
      />
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  blockerRow: {
    backgroundColor: colors.status.amber50,
    borderColor: colors.status.amber800,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...shadows.sm,
  },
  blockerText: {
    color: colors.status.amber800,
    fontSize: textSize.sm,
    lineHeight: 18,
    fontWeight: fontWeight.medium,
  },
  needSide: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  needSideHeader: {
    gap: spacing.xs,
  },
  needSideTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  needSideMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
    fontWeight: fontWeight.medium,
  },
  needRoom: {
    backgroundColor: colors.neutral.backgroundPrimary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.sm,
  },
  needRoomHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  needRoomTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  needRoomMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  acuityPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  redBedText: {
    color: colors.status.red800,
    fontSize: textSize.sm,
    lineHeight: 18,
    fontWeight: fontWeight.semibold,
  },
});
