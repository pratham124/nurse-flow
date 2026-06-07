import { useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { WorkflowScreen, WorkflowSection } from "../components/workflow";
import { createLocalId } from "../helpers/localId";
import { useLocalState } from "../store/LocalStateContext";
import { colors, fontWeight, radius, spacing, textSize } from "../theme/tokens";
import type {
  Acuity,
  NurseCarryOverSuggestion,
  PatientCarryOverSuggestion,
} from "../types/models";
import { carryOverReviewFlow } from "../utils/workflowFlows";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NurseSuggestionRowProps = {
  suggestion: NurseCarryOverSuggestion;
  isIncluded: boolean;
  onToggle: () => void;
};

type PatientSuggestionRowProps = {
  suggestion: PatientCarryOverSuggestion;
  isIncluded: boolean;
  onToggle: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function toggleSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function TogglePill({ isIncluded, label }: { isIncluded: boolean; label: string }) {
  return (
    <View style={isIncluded ? styles.toggleOn : styles.toggleOff}>
      <Text style={isIncluded ? styles.toggleOnText : styles.toggleOffText}>
        {isIncluded ? "Added" : label}
      </Text>
    </View>
  );
}

function NurseSuggestionRow({ suggestion, isIncluded, onToggle }: NurseSuggestionRowProps) {
  return (
    <Pressable
      accessibilityLabel={
        isIncluded
          ? `Remove ${suggestion.name} from shift`
          : `Add ${suggestion.name} to shift`
      }
      accessibilityRole="switch"
      accessibilityState={{ checked: isIncluded }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.suggestionRow,
        isIncluded ? styles.suggestionRowIncluded : null,
        pressed ? styles.suggestionRowPressed : null,
      ]}
    >
      <View style={styles.suggestionTextGroup}>
        <Text style={styles.suggestionTitle}>{suggestion.name}</Text>
        <Text style={styles.suggestionMeta}>
          {suggestion.licenseType} - {getExperienceLabel(suggestion.experienceLevel)}
        </Text>
      </View>
      <TogglePill isIncluded={isIncluded} label="Add" />
    </Pressable>
  );
}

function PatientSuggestionRow({ suggestion, isIncluded, onToggle }: PatientSuggestionRowProps) {
  const displayName = suggestion.patient.initials.trim() || "Patient";

  return (
    <Pressable
      accessibilityLabel={
        isIncluded
          ? `Remove ${displayName} from shift`
          : `Add ${displayName} to shift`
      }
      accessibilityRole="switch"
      accessibilityState={{ checked: isIncluded }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.suggestionRow,
        isIncluded ? styles.suggestionRowIncluded : null,
        pressed ? styles.suggestionRowPressed : null,
      ]}
    >
      <View style={styles.suggestionTextGroup}>
        <Text style={styles.suggestionTitle}>{displayName}</Text>
        <Text style={styles.suggestionMeta}>
          {suggestion.previousBedLabel} - {getAcuityLabel(suggestion.acuity)}
        </Text>
      </View>
      <TogglePill isIncluded={isIncluded} label="Add" />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CarryOverReviewScreen() {
  const { localState, setLocalState } = useLocalState();
  const activeShift = localState.activeShift;
  const previousShiftSnapshot = activeShift
    ? localState.previousShiftSnapshots.find(
        (snapshot) => snapshot.floorTemplateId === activeShift.floorTemplateId,
      )
    : undefined;

  const nurseSuggestions = previousShiftSnapshot?.nurseSuggestions ?? [];
  const patientSuggestions = previousShiftSnapshot?.patientSuggestions ?? [];
  const canContinue = Boolean(activeShift);

  // Track which suggestions are toggled on (will be added to the shift).
  const [includedNurseIds, setIncludedNurseIds] = useState<Set<string>>(new Set());
  const [includedPatientIds, setIncludedPatientIds] = useState<Set<string>>(new Set());

  function handleContinue() {
    if (!activeShift) {
      router.push("/");
      return;
    }

    const acceptedNurses = nurseSuggestions.filter((s) => includedNurseIds.has(s.id));
    const acceptedPatients = patientSuggestions.filter((s) => includedPatientIds.has(s.id));

    if (acceptedNurses.length > 0 || acceptedPatients.length > 0) {
      setLocalState((currentState) => {
        if (!currentState.activeShift) return currentState;

        const shift = currentState.activeShift;

        // Build new nurses from accepted suggestions.
        const defaultMaxLoad = shift.sideLoadLimits.admitting.max;
        const newNurses = acceptedNurses.map((suggestion) => ({
          id: createLocalId("nurse"),
          name: suggestion.name,
          licenseType: suggestion.licenseType,
          experienceLevel: suggestion.experienceLevel,
          maxPatientLoad: defaultMaxLoad,
        }));

        // Pre-fill bed states for accepted patient suggestions.
        const updatedBedStates = shift.bedStates.map((bedState) => {
          const match = acceptedPatients.find(
            (s) => s.previousBedId === bedState.bedId,
          );
          if (!match) return bedState;

          return {
            ...bedState,
            patient: { ...match.patient },
            acuity: match.acuity,
          };
        });

        return {
          ...currentState,
          activeShift: {
            ...shift,
            nurses: [...shift.nurses, ...newNurses],
            bedStates: updatedBedStates,
          },
        };
      });
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
                isIncluded={includedNurseIds.has(suggestion.id)}
                onToggle={() =>
                  setIncludedNurseIds((ids) => toggleSet(ids, suggestion.id))
                }
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
                isIncluded={includedPatientIds.has(suggestion.id)}
                onToggle={() =>
                  setIncludedPatientIds((ids) => toggleSet(ids, suggestion.id))
                }
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  suggestionList: {
    gap: spacing.sm,
  },
  suggestionRow: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundTertiary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionRowIncluded: {
    backgroundColor: colors.status.green50,
    borderColor: colors.status.greenBorder,
  },
  suggestionRowPressed: {
    opacity: 0.85,
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

  // Toggle pill
  toggleOn: {
    backgroundColor: colors.status.greenIcon,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  toggleOnText: {
    color: colors.neutral.surface,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  toggleOff: {
    backgroundColor: "transparent",
    borderColor: colors.neutral.borderSecondary,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  toggleOffText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
  },

  emptyText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});
