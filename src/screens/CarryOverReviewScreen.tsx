import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { WorkflowScreen, WorkflowSection } from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { colors, fontWeight, radius, spacing, textSize } from "../theme/tokens";
import type {
  Acuity,
  NurseCarryOverSuggestion,
  PatientCarryOverSuggestion,
} from "../types/models";
import { carryOverReviewFlow } from "../utils/workflowFlows";

type SuggestionStatusBadgeProps = {
  label: string;
};

type NurseSuggestionRowProps = {
  suggestion: NurseCarryOverSuggestion;
};

type PatientSuggestionRowProps = {
  suggestion: PatientCarryOverSuggestion;
};

function getExperienceLabel(experienceLevel: NurseCarryOverSuggestion["experienceLevel"]) {
  switch (experienceLevel) {
    case "new_grad":
      return "New grad";
    case "mid":
      return "Mid";
    case "experienced":
      return "Experienced";
  }
}

function getAcuityLabel(acuity?: Acuity) {
  switch (acuity) {
    case "green":
      return "Low acuity";
    case "yellow":
      return "Medium acuity";
    case "red":
      return "High acuity";
    default:
      return "No acuity";
  }
}

function SuggestionStatusBadge({ label }: SuggestionStatusBadgeProps) {
  return (
    <View style={styles.pendingBadge}>
      <Text style={styles.pendingBadgeText}>{label}</Text>
    </View>
  );
}

function NurseSuggestionRow({ suggestion }: NurseSuggestionRowProps) {
  return (
    <View style={styles.suggestionRow}>
      <View style={styles.suggestionTextGroup}>
        <Text style={styles.suggestionTitle}>{suggestion.name}</Text>
        <Text style={styles.suggestionMeta}>
          {suggestion.licenseType} - {getExperienceLabel(suggestion.experienceLevel)}
        </Text>
      </View>
      <SuggestionStatusBadge label="Pending review" />
    </View>
  );
}

function PatientSuggestionRow({ suggestion }: PatientSuggestionRowProps) {
  return (
    <View style={styles.suggestionRow}>
      <View style={styles.suggestionTextGroup}>
        <Text style={styles.suggestionTitle}>
          {suggestion.patient.initials.trim() || "Patient"}
        </Text>
        <Text style={styles.suggestionMeta}>
          {suggestion.previousBedLabel} - {getAcuityLabel(suggestion.acuity)}
        </Text>
      </View>
      <SuggestionStatusBadge label="Pending review" />
    </View>
  );
}

export default function CarryOverReviewScreen() {
  const { localState } = useLocalState();
  const activeShift = localState.activeShift;
  const previousShiftSnapshot = activeShift
    ? localState.previousShiftSnapshots.find(
        (snapshot) => snapshot.floorTemplateId === activeShift.floorTemplateId,
      )
    : undefined;

  const nurseSuggestions = previousShiftSnapshot?.nurseSuggestions ?? [];
  const patientSuggestions = previousShiftSnapshot?.patientSuggestions ?? [];
  const canContinue = Boolean(activeShift);

  function handleContinue() {
    if (!activeShift) {
      router.push("/");
      return;
    }

    router.push("/start-shift");
  }

  return (
    <WorkflowScreen
      activeStep="Carry-over"
      actionErrorText={
        canContinue ? "" : "Start a shift before reviewing carry-over."
      }
      flow={carryOverReviewFlow}
      headerActionLabel="Floors"
      hideStepIndicator
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={handleContinue}
      primaryLabel={canContinue ? "Continue setup" : "Back to floors"}
      title={activeShift?.floorName ?? "Carry-over review"}
    >
      <WorkflowSection title="Nurse suggestions">
        {nurseSuggestions.length ? (
          <View style={styles.suggestionList}>
            {nurseSuggestions.map((suggestion) => (
              <NurseSuggestionRow
                key={suggestion.id}
                suggestion={suggestion}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No nurses from the previous shift.</Text>
        )}
      </WorkflowSection>

      <WorkflowSection title="Patient suggestions">
        {patientSuggestions.length ? (
          <View style={styles.suggestionList}>
            {patientSuggestions.map((suggestion) => (
              <PatientSuggestionRow
                key={suggestion.id}
                suggestion={suggestion}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            No occupied patients from the previous shift.
          </Text>
        )}
      </WorkflowSection>
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  suggestionList: {
    gap: spacing.sm,
  },
  suggestionRow: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundTertiary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionTextGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  suggestionTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.semibold,
  },
  suggestionMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  pendingBadge: {
    backgroundColor: colors.status.amber50,
    borderColor: colors.status.amber800,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pendingBadgeText: {
    color: colors.status.amber800,
    fontSize: textSize.xs,
    fontWeight: fontWeight.semibold,
  },
  emptyText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});
