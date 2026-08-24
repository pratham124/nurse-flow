import { useEffect, useRef, useState } from "react";
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
import { ConfirmationDialog } from "../components/workflow/ConfirmationDialog";
import { createLocalId } from "../helpers/localId";
import type { AssignmentOptimizerStatus } from "../services/optimizerRepository";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import { assignmentFlow } from "../utils/workflowFlows";
import {
  colors,
  radius,
  spacing,
  textSize,
  fontWeight,
  shadows,
} from "../theme/tokens";
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

type AssignmentReviewListHeaderProps = {
  activeOverrideCount: number;
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
  activeOverrideCount,
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

      {activeOverrideCount > 0 ? (
        <WorkflowSection
          note="A confirmed rerun starts a new generated baseline."
          title="Manual overrides"
        >
          <View style={styles.overrideWarning}>
            <Text style={styles.overrideWarningText}>
              {activeOverrideCount} active {activeOverrideCount === 1 ? "move" : "moves"} will be cleared when assignment is rerun.
            </Text>
          </View>
        </WorkflowSection>
      ) : null}
    </View>
  );
}

export default function AssignmentReviewScreen() {
  const {
    activeAssignmentOverridesByBedId,
    activeShift,
    realtimeConnectionState,
    runAssignmentOptimizer,
    saveStatus,
  } = useServerWorkspace();
  const [serverSaveError, setServerSaveError] = useState("");
  const [isOptimizerRunning, setIsOptimizerRunning] = useState(false);
  const [showRerunConfirmation, setShowRerunConfirmation] = useState(false);
  const optimizerRequestInFlightRef = useRef(false);
  const retryMutationIdRef = useRef<string | undefined>(undefined);
  const nurses = activeShift?.nurses ?? [];
  const validation = getAssignmentValidation(activeShift);
  const patientNeedSummary = getAssignmentNeedSummary(activeShift);
  const admittingDoctorSide = activeShift?.doctorSides.find(
    (doctorSide) => doctorSide.id === activeShift.admittingDoctorSideId,
  );
  const { occupiedBedCount, totalBedCount } = getShiftCensus(activeShift);
  const firstBlockerMessage = validation.blockers[0]?.message ?? "";
  const activeOverrideCount = Object.keys(
    activeAssignmentOverridesByBedId,
  ).length;
  const hasLiveConnection = realtimeConnectionState === "live";
  const connectionMessage = hasLiveConnection
    ? ""
    : realtimeConnectionState === "connecting" ||
        realtimeConnectionState === "reconnecting"
      ? "The server connection is being restored. Wait before running assignment."
      : "A server connection is required to run assignment.";

  useEffect(() => {
    if (!activeShift) {
      router.replace("/");
    }
  }, [activeShift]);

  async function runBackendAssignment() {
    if (
      !activeShift ||
      !validation.canRunAssignment ||
      optimizerRequestInFlightRef.current
    ) {
      return;
    }

    if (!hasLiveConnection) {
      setServerSaveError(connectionMessage);
      return;
    }

    const clientMutationId =
      retryMutationIdRef.current ?? createLocalId("optimizer-run");
    retryMutationIdRef.current = clientMutationId;
    optimizerRequestInFlightRef.current = true;
    setIsOptimizerRunning(true);
    setServerSaveError("");

    try {
      const result = await runAssignmentOptimizer({
        clientMutationId,
        expectedBaselineAssignmentResultId:
          activeShift.assignmentResult?.id,
      });

      if (result.status === "saved") {
        retryMutationIdRef.current = undefined;
        router.push("/floor-board");
        return;
      }

      if (result.status !== "unavailable") {
        retryMutationIdRef.current = undefined;
      }

      setServerSaveError(getOptimizerErrorMessage(result.status));
    } catch (error) {
      setServerSaveError(
        error instanceof Error
          ? error.message
          : "Assignment could not be calculated. No assignment was saved.",
      );
    } finally {
      optimizerRequestInFlightRef.current = false;
      setIsOptimizerRunning(false);
    }
  }

  function handlePrimaryPress() {
    if (
      !activeShift ||
      !validation.canRunAssignment ||
      isOptimizerRunning ||
      saveStatus === "saving"
    ) {
      return;
    }

    if (activeShift.assignmentResult && activeOverrideCount > 0) {
      setShowRerunConfirmation(true);
      return;
    }

    void runBackendAssignment();
  }

  function handleConfirmRerun() {
    setShowRerunConfirmation(false);
    void runBackendAssignment();
  }

  return (
    <>
      <WorkflowScreen
        activeStep="Assign"
        actionErrorText={
          serverSaveError || firstBlockerMessage || connectionMessage
        }
        bottomAccessory={
          isOptimizerRunning ? (
            <Text
              accessibilityLiveRegion="polite"
              style={styles.calculatingText}
            >
              Calculating and saving the assignment on the server…
            </Text>
          ) : undefined
        }
        flow={assignmentFlow}
        headerActionLabel="Floors"
        onHeaderActionPress={() => router.push("/")}
        onPrimaryPress={handlePrimaryPress}
        primaryBusy={isOptimizerRunning}
        primaryDisabled={
          !validation.canRunAssignment ||
          !hasLiveConnection ||
          isOptimizerRunning ||
          saveStatus === "saving"
        }
        primaryLabel={
          isOptimizerRunning
            ? "Calculating…"
            : saveStatus === "saving"
              ? "Saving..."
              : serverSaveError
                ? "Retry assignment"
                : activeShift?.assignmentResult
                  ? "Rerun assignment"
                  : "Run assignment"
        }
        subtitle=""
        title={activeShift?.floorName ?? "Assignment review"}
      >
        <AssignmentReviewListHeader
          activeOverrideCount={activeOverrideCount}
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
      <ConfirmationDialog
        confirmLabel="Rerun and clear moves"
        confirmTone="danger"
        message={`A successful rerun will create a new generated assignment and clear ${activeOverrideCount} active manual ${activeOverrideCount === 1 ? "move" : "moves"}. The current assignment and moves stay unchanged if the rerun does not succeed.`}
        onCancel={() => setShowRerunConfirmation(false)}
        onConfirm={handleConfirmRerun}
        title="Rerun assignment?"
        visible={showRerunConfirmation}
      />
    </>
  );
}

function getOptimizerErrorMessage(status: AssignmentOptimizerStatus) {
  switch (status) {
    case "stale":
      return "Shift details changed while assignment was calculating. The latest shift was refreshed; review it before trying again. No assignment was saved.";
    case "invalid_input":
      return "The server found an invalid assignment setup. Review the nurses, occupied beds, acuity, and load limits before trying again. No assignment was saved.";
    case "timed_out":
      return "Assignment calculation timed out. No assignment was saved. Review the current setup and try again.";
    case "unavailable":
      return "The assignment service is unavailable. No assignment was saved. Check the connection and try again.";
    case "failed":
      return "Assignment could not be calculated. No assignment was saved. Review the setup and try again.";
    case "saved":
      return "";
  }
}

const styles = StyleSheet.create({
  calculatingText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 20,
    paddingHorizontal: spacing.xl,
    textAlign: "center",
  },
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
  overrideWarning: {
    backgroundColor: colors.status.amber50,
    borderColor: colors.status.amber800,
    borderRadius: radius.md,
    borderWidth: 0.5,
    padding: spacing.md,
  },
  overrideWarningText: {
    color: colors.status.amber800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 19,
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
