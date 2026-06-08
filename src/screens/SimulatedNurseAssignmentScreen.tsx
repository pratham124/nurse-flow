import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  PlaceholderButton,
  StatusPill,
  SummaryChip,
  SummaryTile,
  SummaryTileGrid,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { colors, fontWeight, radius, shadows, spacing, textSize } from "../theme/tokens";
import type { Acuity, ExperienceLevel, Sex } from "../types/models";
import {
  getSelectedNurseAssignmentView,
  type NurseAssignedBedView,
  type NurseAssignmentView,
  type NurseAssignmentViewResult,
} from "../utils/nurseAssignmentView";
import { assignmentFlow } from "../utils/workflowFlows";

type NurseAssignmentListItem =
  | { type: "bed"; assignedBed: NurseAssignedBedView }
  | { type: "empty"; id: string; message: string; title: string };

type NurseAssignmentHeaderProps = {
  view: NurseAssignmentView;
};

type NurseAssignedBedRowProps = {
  assignedBed: NurseAssignedBedView;
};

type EmptyAssignmentRowProps = {
  message: string;
  title: string;
};

function getExperienceLabel(experienceLevel: ExperienceLevel) {
  if (experienceLevel === "new_grad") {
    return "New grad";
  }

  if (experienceLevel === "mid") {
    return "Mid";
  }

  return "Experienced";
}

function getSexLabel(sex?: Sex) {
  if (!sex) {
    return "Sex unknown";
  }

  if (sex === "female") {
    return "Female";
  }

  if (sex === "male") {
    return "Male";
  }

  if (sex === "other") {
    return "Other";
  }

  return "Sex unknown";
}

function getAcuityLabel(acuity?: Acuity) {
  if (acuity === "green") {
    return "Low acuity";
  }

  if (acuity === "yellow") {
    return "Medium acuity";
  }

  if (acuity === "red") {
    return "High acuity";
  }

  return "No acuity";
}

function getAcuityTone(acuity?: Acuity) {
  if (acuity === "green") {
    return "green";
  }

  if (acuity === "yellow") {
    return "yellow";
  }

  if (acuity === "red") {
    return "red";
  }

  return "empty";
}

function getPatientPrimaryText(assignedBed: NurseAssignedBedView) {
  const initials = assignedBed.bedState?.patient?.initials.trim();

  return initials || "Empty bed";
}

function getPatientDetailText(assignedBed: NurseAssignedBedView) {
  const patient = assignedBed.bedState?.patient;

  if (!patient?.initials.trim()) {
    return "No patient assigned to this bed.";
  }

  const ageText = patient.age ? `${patient.age} years old` : "Age unknown";
  const diagnosisText = patient.diagnosis?.trim()
    ? patient.diagnosis.trim()
    : "No diagnosis listed";

  return `${ageText} - ${getSexLabel(patient.sex)} - ${diagnosisText}`;
}

function getRoomCoverageText(view: NurseAssignmentView) {
  if (!view.coveredRooms.length) {
    return "No rooms";
  }

  return view.coveredRooms.map((room) => room.label).join(", ");
}

function getReadyListItems(view: NurseAssignmentView): NurseAssignmentListItem[] {
  if (!view.assignedBeds.length) {
    return [
      {
        id: "empty-assigned-beds",
        message: "No assigned beds for this nurse yet.",
        title: "No assigned beds",
        type: "empty",
      },
    ];
  }

  return view.assignedBeds.map((assignedBed) => ({
    assignedBed,
    type: "bed",
  }));
}

function getRecoveryListItems(
  result: NurseAssignmentViewResult,
): NurseAssignmentListItem[] {
  if (result.status === "ready") {
    return getReadyListItems(result.view);
  }

  return [
    {
      id: result.status,
      message: result.message,
      title: result.title,
      type: "empty",
    },
  ];
}

function getAssignmentItemKey(item: NurseAssignmentListItem) {
  return item.type === "bed" ? item.assignedBed.bed.id : item.id;
}

function NurseAssignmentHeader({ view }: NurseAssignmentHeaderProps) {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection title="Local simulation">
        <View style={styles.summaryCard}>
          <View style={styles.chipRow}>
            <SummaryChip label="Regular nurse simulation" />
            <SummaryChip label="Local only" />
          </View>
          <Text style={styles.summaryText}>
            Viewing only the assignment generated for {view.nurse.name}.
          </Text>
        </View>
      </WorkflowSection>

      <WorkflowSection title="Assignment summary">
        <SummaryTileGrid>
          <SummaryTile value={view.nurse.name} label="Nurse" />
          <SummaryTile
            value={`${view.nurse.licenseType} - ${getExperienceLabel(
              view.nurse.experienceLevel,
            )}`}
            label="Profile"
          />
          <SummaryTile
            value={view.assignedBeds.length.toString()}
            label="Assigned beds"
          />
        </SummaryTileGrid>
      </WorkflowSection>

      <WorkflowSection title="Room coverage">
        <View style={styles.coverageCard}>
          <Text style={styles.coverageText}>{getRoomCoverageText(view)}</Text>
          {view.invalidAssignmentCount ? (
            <Text accessibilityRole="alert" style={styles.warningText}>
              {view.invalidAssignmentCount} assignment row could not be shown
              because its bed, room, or doctor side was missing.
            </Text>
          ) : null}
        </View>
      </WorkflowSection>

      <WorkflowSection title="Nurse actions">
        <View style={styles.actionRow}>
          <PlaceholderButton label="Flag issue" />
          <PlaceholderButton label="Request swap" />
        </View>
        <Text style={styles.actionHelper}>
          Mock issue and swap forms are planned for later Phase 3 tasks.
        </Text>
      </WorkflowSection>
    </View>
  );
}

function EmptyAssignmentRow({ message, title }: EmptyAssignmentRowProps) {
  return (
    <View style={styles.emptyRow}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

function NurseAssignedBedRow({ assignedBed }: NurseAssignedBedRowProps) {
  const acuity = assignedBed.bedState?.acuity;

  return (
    <View style={styles.bedRow}>
      <View style={styles.bedTopRow}>
        <View style={styles.bedTitleGroup}>
          <Text style={styles.roomText}>Room {assignedBed.room.label}</Text>
          <Text style={styles.sideText}>{assignedBed.doctorSide.name}</Text>
        </View>
        <BedChip label={assignedBed.bed.label} />
      </View>

      <View style={styles.patientBlock}>
        <Text style={styles.patientPrimary}>
          {getPatientPrimaryText(assignedBed)}
        </Text>
        <Text style={styles.patientDetail}>
          {getPatientDetailText(assignedBed)}
        </Text>
      </View>

      <StatusPill label={getAcuityLabel(acuity)} tone={getAcuityTone(acuity)} />
    </View>
  );
}

function renderAssignmentItem({ item }: { item: NurseAssignmentListItem }) {
  if (item.type === "empty") {
    return <EmptyAssignmentRow message={item.message} title={item.title} />;
  }

  return <NurseAssignedBedRow assignedBed={item.assignedBed} />;
}

export default function SimulatedNurseAssignmentScreen() {
  const { localState, setSimulatedSessionState, simulatedSessionState } =
    useLocalState();
  const assignmentResult = getSelectedNurseAssignmentView(
    localState.activeShift,
    simulatedSessionState.selectedNurseId,
  );
  const listItems = getRecoveryListItems(assignmentResult);
  const readyView =
    assignmentResult.status === "ready" ? assignmentResult.view : undefined;

  function returnToChargeView() {
    setSimulatedSessionState({ role: "charge" });
    router.push("/floor-board");
  }

  return (
    <WorkflowListScreen
      activeStep="Board"
      data={listItems}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      keyExtractor={getAssignmentItemKey}
      listHeader={readyView ? <NurseAssignmentHeader view={readyView} /> : undefined}
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/simulated-nurse-picker")}
      primaryLabel="Choose nurse"
      renderItem={renderAssignmentItem}
      listFooter={
        <PlaceholderButton
          label="Back to charge view"
          onPress={returnToChargeView}
        />
      }
      subtitle=""
      title={readyView ? `Viewing ${readyView.nurse.name}` : "Nurse view"}
    />
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  summaryCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  chipRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  coverageCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.sm,
  },
  coverageText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.semibold,
    lineHeight: 20,
  },
  warningText: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionHelper: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  bedRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  bedTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  bedTitleGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  roomText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  sideText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  patientBlock: {
    gap: spacing.xs,
  },
  patientPrimary: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  patientDetail: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  emptyRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.lg,
    ...shadows.sm,
  },
  emptyTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  emptyMessage: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
});

