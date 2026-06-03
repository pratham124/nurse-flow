import { useEffect } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View, type DimensionValue } from "react-native";

import {
  CheckCircleIcon,
  SeverityBadge,
  SummaryTile,
  SummaryTileGrid,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { assignmentFlow } from "../utils/workflowFlows";
import { colors, radius, spacing, textSize } from "../theme/tokens";
import { getShiftCensus } from "../utils/census";
import {
  getAssignmentValidation,
  type AssignmentValidationBlocker,
} from "../utils/assignmentValidation";
import type { ExperienceLevel, Nurse } from "../types/models";

type NurseCapacityRow = {
  assigned: number;
  detail: string;
  id: string;
  max: number;
  name: string;
};

type CapacityRowProps = {
  assigned: number;
  detail: string;
  max: number;
  name: string;
};

type AssignmentReviewListHeaderProps = {
  admittingSideName: string;
  blockers: AssignmentValidationBlocker[];
  hasAdmittingSide: boolean;
  hasMissingAcuity: boolean;
  hasValidNurseInputs: boolean;
  hasValidSideLoadLimits: boolean;
  nurseCount: number;
  occupiedBedCount: number;
  totalNurseCapacity: number;
  totalBedCount: number;
};

type ChecklistRowProps = {
  complete: boolean;
  completeText: string;
  blockedText: string;
};

function getExperienceLabel(experienceLevel: ExperienceLevel) {
  switch (experienceLevel) {
    case "new_grad":
      return "new grad";
    case "mid":
      return "mid";
    case "experienced":
      return "experienced";
  }
}

function getNurseCapacityRows(nurses: Nurse[]): NurseCapacityRow[] {
  return nurses.map((nurse) => ({
    assigned: 0,
    detail: `${nurse.licenseType}, ${getExperienceLabel(nurse.experienceLevel)}`,
    id: nurse.id,
    max: nurse.maxPatientLoad,
    name: nurse.name,
  }));
}

function getCountLabel(count: number, singularLabel: string, pluralLabel: string) {
  return count === 1 ? singularLabel : pluralLabel;
}

function ChecklistRow({
  complete,
  completeText,
  blockedText,
}: ChecklistRowProps) {
  return (
    <View style={[styles.checkRow, complete ? null : styles.blockedCheckRow]}>
      <View style={styles.checkBadge}>
        {complete ? (
          <CheckCircleIcon />
        ) : (
          <SeverityBadge label="Fix" tone="warning" />
        )}
      </View>
      <Text style={[styles.checkText, complete ? null : styles.blockedCheckText]}>
        {complete ? completeText : blockedText}
      </Text>
    </View>
  );
}

function AssignmentReviewListHeader({
  admittingSideName,
  blockers,
  hasAdmittingSide,
  hasMissingAcuity,
  hasValidNurseInputs,
  hasValidSideLoadLimits,
  nurseCount,
  occupiedBedCount,
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
          <SummaryTile value={nurseCount.toString()} label="Nurses" />
          <SummaryTile value={totalNurseCapacity.toString()} label="Capacity" />
          <SummaryTile value={admittingSideName} label="Admitting" />
        </SummaryTileGrid>
      </WorkflowSection>

      <WorkflowSection title="Readiness checklist">
        <ChecklistRow
          blockedText="Choose admitting side"
          complete={hasAdmittingSide}
          completeText="Admitting side selected"
        />
        <ChecklistRow
          blockedText="Add nurses and set max loads"
          complete={hasValidNurseInputs}
          completeText={`${nurseCount} ${getCountLabel(
            nurseCount,
            "nurse has",
            "nurses have",
          )} max loads`}
        />
        <ChecklistRow
          blockedText="Fix side load limits"
          complete={hasValidSideLoadLimits}
          completeText="Side load limits are valid"
        />
        <ChecklistRow
          blockedText="Occupied beds need acuity"
          complete={!hasMissingAcuity}
          completeText="Occupied beds have acuity"
        />
      </WorkflowSection>

      {blockers.length ? (
        <WorkflowSection
          note="Fix these before running local assignment."
          title="Assignment blockers"
        >
          {blockers.map((blocker) => (
            <View key={blocker.id} style={styles.blockerRow}>
              <SeverityBadge label={blocker.label} tone="warning" />
              <Text style={styles.blockerText}>{blocker.message}</Text>
            </View>
          ))}
        </WorkflowSection>
      ) : null}

      <View style={styles.capacityTitleCard}>
        <Text style={styles.capacityTitle}>Nurse capacity</Text>
      </View>
    </View>
  );
}

function renderNurseCapacityItem({
  item,
}: {
  item: NurseCapacityRow;
}) {
  return (
    <CapacityRow
      assigned={item.assigned}
      detail={item.detail}
      max={item.max}
      name={item.name}
    />
  );
}

function getNurseCapacityKey(nurse: NurseCapacityRow) {
  return nurse.id;
}

export default function AssignmentReviewScreen() {
  const { localState } = useLocalState();
  const activeShift = localState.activeShift;
  const nurses = activeShift?.nurses ?? [];
  const validation = getAssignmentValidation(activeShift);
  const admittingDoctorSide = activeShift?.doctorSides.find(
    (doctorSide) => doctorSide.id === activeShift.admittingDoctorSideId,
  );
  const { occupiedBedCount, totalBedCount } = getShiftCensus(activeShift);
  const nurseCapacityRows = getNurseCapacityRows(nurses);
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

    router.push("/floor-board");
  }

  return (
    <WorkflowListScreen
      activeStep="Assign"
      actionErrorText={firstBlockerMessage}
      data={nurseCapacityRows}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      keyExtractor={getNurseCapacityKey}
      listHeader={
        <AssignmentReviewListHeader
          admittingSideName={admittingDoctorSide?.name ?? "-"}
          blockers={validation.blockers}
          hasAdmittingSide={validation.hasAdmittingSide}
          hasMissingAcuity={validation.hasMissingAcuity}
          hasValidNurseInputs={validation.hasValidNurseInputs}
          hasValidSideLoadLimits={validation.hasValidSideLoadLimits}
          nurseCount={nurses.length}
          occupiedBedCount={occupiedBedCount}
          totalNurseCapacity={validation.totalNurseCapacity}
          totalBedCount={totalBedCount}
        />
      }
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={handlePrimaryPress}
      primaryDisabled={!validation.canRunAssignment}
      primaryLabel="Run local assignment"
      renderItem={renderNurseCapacityItem}
      subtitle="Readiness preview"
      title="Assignment review"
    />
  );
}

function CapacityRow({
  assigned,
  detail,
  max,
  name,
}: CapacityRowProps) {
  const fillPercent: DimensionValue =
    max > 0 ? `${Math.min((assigned / max) * 100, 100)}%` : "0%";

  return (
    <View style={styles.capacityRow}>
      <View style={styles.capacityHeader}>
        <View style={styles.nurseAvatar}>
          <Text style={styles.nurseAvatarText}>{name.charAt(0)}</Text>
        </View>
        <View style={styles.capacityInfo}>
          <Text style={styles.capacityName}>{name}</Text>
          <Text style={styles.capacityDetail}>{detail}</Text>
        </View>
        <View style={styles.loadPill}>
          <Text style={styles.loadPillText}>
            {assigned}/{max}
          </Text>
        </View>
      </View>

      <View style={styles.capacityTrack}>
        <View style={[styles.capacityFill, { width: fillPercent }]} />
      </View>
      <Text style={styles.capacityHint}>
        {max - assigned} open {max - assigned === 1 ? "slot" : "slots"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  checkRow: {
    alignItems: "center",
    borderLeftColor: colors.status.greenBorder,
    borderLeftWidth: 2,
    flexDirection: "row",
    gap: 10,
    paddingLeft: 10,
    paddingVertical: spacing.md,
  },
  checkBadge: {
    alignItems: "center",
    height: 18,
    justifyContent: "center",
    minWidth: 18,
  },
  checkText: {
    color: colors.neutral.textPrimary,
    flex: 1,
    fontSize: textSize.md,
  },
  blockedCheckRow: {
    borderLeftColor: colors.status.amber800,
  },
  blockedCheckText: {
    color: colors.status.amber800,
    fontWeight: "500",
  },
  blockerRow: {
    backgroundColor: colors.status.amber50,
    borderColor: colors.status.amber800,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  blockerText: {
    color: colors.status.amber800,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  capacityRow: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  capacityTitleCard: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    padding: spacing.lg,
  },
  capacityTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "500",
  },
  capacityHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
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
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  capacityInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  capacityName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  capacityDetail: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
  },
  loadPill: {
    backgroundColor: colors.status.gray100,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
  },
  loadPillText: {
    color: colors.status.gray800,
    fontSize: 13,
    fontWeight: "500",
  },
  capacityTrack: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.pill,
    height: 6,
    overflow: "hidden",
  },
  capacityFill: {
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.pill,
    height: "100%",
    minWidth: 0,
  },
  capacityHint: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
  },
});
