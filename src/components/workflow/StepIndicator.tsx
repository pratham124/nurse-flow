import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { WorkflowFlowStep } from "../../utils/workflowFlows";
import { colors, spacing, textSize, fontWeight, shadows } from "../../theme/tokens";
import type { WorkflowStep } from "./types";

type StepIndicatorProps = {
  activeStep: WorkflowStep;
  flow: WorkflowFlowStep[];
};

export function StepIndicator({ activeStep, flow }: StepIndicatorProps) {
  const activeIndex = flow.findIndex((flowStep) => flowStep.step === activeStep);

  return (
    <View style={styles.stepRow}>
      {flow.map(({ step, route }, index) => {
        const isActive = step === activeStep;
        const isComplete = index < activeIndex;

        return (
          <Pressable
            accessibilityRole={isComplete ? "button" : undefined}
            disabled={!isComplete}
            key={step}
            onPress={() => router.push(route)}
            style={({ pressed }) => [
              styles.tab,
              isActive ? styles.activeStepChip : null,
              pressed && isComplete ? styles.pressedTab : null,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                isActive ? styles.activeStepText : null,
              ]}
            >
              {step}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    backgroundColor: colors.neutral.backgroundPrimary,
    flexDirection: "row",
    gap: spacing.xs,
  },
  tab: {
    alignItems: "center",
    borderRadius: 20,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.xs,
  },
  pressedTab: {
    opacity: 0.7,
  },
  activeStepChip: {
    backgroundColor: colors.brand.burgundy,
    ...shadows.sm,
  },
  tabText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    textAlign: "center",
  },
  activeStepText: {
    color: colors.neutral.surface,
    fontWeight: fontWeight.semibold,
  },
});

