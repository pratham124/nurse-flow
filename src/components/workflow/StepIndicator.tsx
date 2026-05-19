import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { WorkflowFlowStep } from "../../constants/workflowFlows";
import { colors, radius, spacing, textSize } from "../../theme/tokens";
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
            style={[
              styles.stepChip,
              isActive ? styles.activeStepChip : null,
              isComplete ? styles.completeStepChip : null,
              isComplete ? styles.stepButton : null,
            ]}
          >
            <Text
              style={[
                styles.stepText,
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
    flexDirection: "row",
    gap: spacing.sm,
  },
  stepChip: {
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  activeStepChip: {
    backgroundColor: colors.brand.burgundy,
    borderColor: colors.brand.burgundy,
  },
  completeStepChip: {
    backgroundColor: colors.brand.softGreen,
    borderColor: colors.brand.softGreen,
  },
  stepButton: {
    borderColor: colors.brand.burgundy,
  },
  stepText: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
    fontWeight: "700",
    textAlign: "center",
  },
  activeStepText: {
    color: colors.neutral.surface,
  },
});
