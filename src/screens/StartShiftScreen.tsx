import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  NumberStepperPlaceholder,
  SegmentedPlaceholder,
  SummaryTile,
  SummaryTileGrid,
  WorkflowSection,
  WorkflowScreen,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { shiftSetupFlow } from "../utils/workflowFlows";
import { colors, spacing, textSize } from "../theme/tokens";

function getCountLabel(count: number, singularLabel: string, pluralLabel: string) {
  return count === 1 ? singularLabel : pluralLabel;
}

export default function StartShiftScreen() {
  const { localState } = useLocalState();
  const activeShift = localState.activeShift;
  const doctorSideOptions =
    activeShift?.doctorSides.map((doctorSide) => doctorSide.name) ?? [];
  const canContinue = Boolean(activeShift);

  function handleContinue() {
    if (!activeShift) {
      router.push("/");
      return;
    }

    router.push("/nurses");
  }

  return (
    <WorkflowScreen
      activeStep="Shift"
      actionErrorText={
        canContinue ? "" : "Create a floor template before starting a shift."
      }
      headerActionLabel="Floors"
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={handleContinue}
      primaryLabel={canContinue ? "Continue" : "Back to floors"}
      flow={shiftSetupFlow}
      subtitle="Step 1 of 3"
      title={activeShift?.floorName ?? "Start shift"}
    >
      <WorkflowSection title="Template summary">
        <SummaryTileGrid>
          <SummaryTile
            value={(activeShift?.doctorSides.length ?? 0).toString()}
            label={getCountLabel(
              activeShift?.doctorSides.length ?? 0,
              "Doctor side",
              "Doctor sides",
            )}
          />
          <SummaryTile
            value={(activeShift?.rooms.length ?? 0).toString()}
            label={getCountLabel(activeShift?.rooms.length ?? 0, "Room", "Rooms")}
          />
          <SummaryTile
            value={(activeShift?.bedStates.length ?? 0).toString()}
            label={getCountLabel(activeShift?.bedStates.length ?? 0, "Bed", "Beds")}
          />
        </SummaryTileGrid>
      </WorkflowSection>

      <WorkflowSection title="Admitting side">
        <SegmentedPlaceholder
          options={doctorSideOptions.length ? doctorSideOptions : ["Side 1", "Side 2"]}
          selectedIndex={null}
        />
      </WorkflowSection>

      <WorkflowSection title="Side-based load limits">
        <View style={styles.limitRow}>
          <View style={styles.limitText}>
            <Text style={styles.limitTitle}>Admitting-side coverage</Text>
            <Text style={styles.limitMeta}>Default target around 4-5 patients</Text>
          </View>
          <NumberStepperPlaceholder
            value={(activeShift?.sideLoadLimits.admitting.max ?? 5).toString()}
          />
        </View>

        <View style={styles.limitRow}>
          <View style={styles.limitText}>
            <Text style={styles.limitTitle}>Non-admitting only</Text>
            <Text style={styles.limitMeta}>Default target around 6-7 patients</Text>
          </View>
          <NumberStepperPlaceholder
            value={(activeShift?.sideLoadLimits.nonAdmitting.max ?? 6).toString()}
          />
        </View>
      </WorkflowSection>
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  limitRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
  },
  limitText: {
    flex: 1,
    gap: spacing.xs,
  },
  limitTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  limitMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});
