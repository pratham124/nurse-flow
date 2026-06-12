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
import type { Acuity, ExperienceLevel, NurseRequest, Sex } from "../types/models";
import {
  getNurseBreakView,
  type NurseBreakView,
} from "../utils/breakSchedule";
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
  breakView: NurseBreakView;
  hasBreakSchedule: boolean;
  onFlagIssue: () => void;
  onRequestSwap: () => void;
  view: NurseAssignmentView;
};

type NurseAssignedBedRowProps = {
  assignedBed: NurseAssignedBedView;
};

type EmptyAssignmentRowProps = {
  message: string;
  title: string;
};

type RequestHistorySectionProps = {
  requests: NurseRequest[];
  view: NurseAssignmentView;
};

type RequestHistoryRowProps = {
  request: NurseRequest;
  view: NurseAssignmentView;
};

type NurseBreakSummaryProps = {
  breakView: NurseBreakView;
  hasBreakSchedule: boolean;
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

function getNurseBreakLabel({
  breakView,
  hasBreakSchedule,
}: NurseBreakSummaryProps) {
  if (breakView.entry) {
    return `Break ${breakView.breakTimeLabel}`;
  }

  return hasBreakSchedule
    ? "No break assigned for this nurse yet."
    : breakView.breakTimeLabel;
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

function getRequestSourceText(view: NurseAssignmentView, request: NurseRequest) {
  if (!request.sourceBedId) {
    return "No bed context";
  }

  const assignedBed = view.assignedBeds.find(
    (bedView) => bedView.bed.id === request.sourceBedId,
  );

  return assignedBed
    ? `Room ${assignedBed.room.label} - Bed ${assignedBed.bed.label}`
    : "Assigned bed unavailable";
}

function getRequestCreatedText(request: NurseRequest) {
  return new Date(request.createdAt).toLocaleString();
}

function getRequestTypeLabel(request: NurseRequest) {
  return request.type === "swap" ? "swap" : "issue";
}

function getRequestStatusLabel(request: NurseRequest) {
  const statusLabel =
    request.status.charAt(0).toUpperCase() + request.status.slice(1);

  return `${statusLabel} ${getRequestTypeLabel(request)}`;
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

function NurseAssignmentHeader({
  breakView,
  hasBreakSchedule,
  onFlagIssue,
  onRequestSwap,
  view,
}: NurseAssignmentHeaderProps) {
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

      <NurseBreakSummary
        breakView={breakView}
        hasBreakSchedule={hasBreakSchedule}
      />

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
          <PlaceholderButton label="Flag issue" onPress={onFlagIssue} />
          <PlaceholderButton label="Request swap" onPress={onRequestSwap} />
        </View>
        <Text style={styles.actionHelper}>
          Issue notes and swap requests are local mock requests for this active
          shift.
        </Text>
      </WorkflowSection>

      <RequestHistorySection requests={view.requests} view={view} />
    </View>
  );
}

function NurseBreakSummary({
  breakView,
  hasBreakSchedule,
}: NurseBreakSummaryProps) {
  const warning = breakView.warnings[0];

  return (
    <WorkflowSection title="Break summary">
      <View style={styles.breakSummaryCard}>
        <View style={styles.chipRow}>
          <SummaryChip
            label={getNurseBreakLabel({
              breakView,
              hasBreakSchedule,
            })}
          />
          {warning ? <SummaryChip label="Local schedule warning" /> : null}
        </View>
        {warning ? (
          <Text accessibilityRole="alert" style={styles.breakWarningText}>
            {warning.message}
          </Text>
        ) : (
          <Text style={styles.breakSummaryText}>
            This view only shows {breakView.entry ? "your" : "this nurse's"} local
            break status.
          </Text>
        )}
      </View>
    </WorkflowSection>
  );
}

function RequestHistorySection({ requests, view }: RequestHistorySectionProps) {
  return (
    <WorkflowSection title="Local request history">
      <View style={styles.issueHistoryCard}>
        {requests.length ? (
          requests.map((request) => (
            <RequestHistoryRow
              key={request.id}
              request={request}
              view={view}
            />
          ))
        ) : (
          <Text style={styles.issueHistoryEmpty}>No local requests yet.</Text>
        )}
      </View>
    </WorkflowSection>
  );
}

function RequestHistoryRow({ request, view }: RequestHistoryRowProps) {
  const isSwap = request.type === "swap";

  return (
    <View
      style={[
        styles.issueRequestRow,
        isSwap ? styles.swapRequestRow : null,
      ]}
    >
      <View style={styles.issueRequestTopRow}>
        <Text
          style={[
            styles.issueRequestLabel,
            isSwap ? styles.swapRequestLabel : null,
          ]}
        >
          {getRequestStatusLabel(request)}
        </Text>
        <Text style={styles.issueRequestTime}>
          {getRequestCreatedText(request)}
        </Text>
      </View>
      <Text style={styles.issueRequestSource}>
        {getRequestSourceText(view, request)}
      </Text>
      <Text style={styles.issueRequestMessage}>{request.message}</Text>
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
  const breakView = getNurseBreakView(
    localState.activeShift,
    readyView?.nurse.id,
  );

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
      listHeader={
        readyView ? (
          <NurseAssignmentHeader
            breakView={breakView}
            hasBreakSchedule={Boolean(localState.activeShift?.breakSchedule)}
            onFlagIssue={() => router.push("/simulated-nurse-issue")}
            onRequestSwap={() => router.push("/simulated-nurse-swap")}
            view={readyView}
          />
        ) : undefined
      }
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
  breakSummaryCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  breakSummaryText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  breakWarningText: {
    color: colors.status.amber800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
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
  issueHistoryCard: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.sm,
  },
  issueHistoryEmpty: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  issueRequestRow: {
    backgroundColor: colors.status.amber50,
    borderColor: colors.neutral.borderTertiary,
    borderLeftColor: colors.status.amber800,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.md,
  },
  issueRequestTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  issueRequestLabel: {
    color: colors.status.amber800,
    flex: 1,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
    lineHeight: 18,
  },
  swapRequestRow: {
    backgroundColor: colors.status.blue50,
    borderLeftColor: colors.status.blue800,
  },
  swapRequestLabel: {
    color: colors.status.blue800,
  },
  issueRequestTime: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.medium,
    lineHeight: 16,
    textAlign: "right",
  },
  issueRequestSource: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  issueRequestMessage: {
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
