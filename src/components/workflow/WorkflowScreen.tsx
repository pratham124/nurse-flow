import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { floorTemplateFlow } from "../../utils/workflowFlows";
import type { WorkflowFlowStep } from "../../utils/workflowFlows";
import { colors, radius, spacing, textSize } from "../../theme/tokens";
import { StepIndicator } from "./StepIndicator";
import { HomeIcon } from "./Icons";
import type { WorkflowStep } from "./types";

type WorkflowScreenProps = {
  title: string;
  subtitle: string;
  headerActionLabel?: string;
  onHeaderActionPress?: () => void;
  activeStep: WorkflowStep;
  flow?: WorkflowFlowStep[];
  children: ReactNode;
  primaryLabel: string;
  onPrimaryPress: () => void;
  helperText?: string;
};

export function WorkflowScreen({
  title,
  subtitle,
  headerActionLabel,
  onHeaderActionPress,
  activeStep,
  flow = floorTemplateFlow,
  children,
  primaryLabel,
  onPrimaryPress,
  helperText,
}: WorkflowScreenProps) {
  const activeStepIndex = flow.findIndex(
    (flowStep) => flowStep.step === activeStep,
  );
  const showSubtitle = !/^Step \d+ of \d+$/.test(subtitle);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>{title}</Text>
          {headerActionLabel && onHeaderActionPress ? (
            <Pressable
              accessibilityLabel={headerActionLabel}
              accessibilityRole="button"
              hitSlop={4}
              onPress={onHeaderActionPress}
              style={styles.headerAction}
            >
              <HomeIcon />
            </Pressable>
          ) : null}
        </View>
        {showSubtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <SegmentedProgress
          activeIndex={activeStepIndex}
          segmentCount={flow.length}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <StepIndicator activeStep={activeStep} flow={flow} />
        {children}
      </ScrollView>

      <View style={styles.actionBar}>
        {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onPrimaryPress}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SegmentedProgress({
  activeIndex,
  segmentCount,
}: {
  activeIndex: number;
  segmentCount: number;
}) {
  return (
    <View
      accessibilityLabel={`Step ${activeIndex + 1} of ${segmentCount}`}
      accessibilityRole="progressbar"
      style={styles.progressRow}
    >
      {Array.from({ length: segmentCount }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.progressSegment,
            index < activeIndex ? styles.completedProgressSegment : null,
            index === activeIndex ? styles.activeProgressSegment : null,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.neutral.backgroundPrimary,
  },
  header: {
    backgroundColor: colors.neutral.backgroundPrimary,
    gap: 2,
    padding: spacing.xl,
    paddingBottom: spacing.sm,
  },
  headerTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  title: {
    color: colors.neutral.textPrimary,
    flex: 1,
    fontSize: textSize.xl,
    fontWeight: "500",
  },
  headerAction: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: 18,
    borderWidth: 0.5,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  subtitle: {
    color: colors.neutral.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  progressSegment: {
    backgroundColor: colors.neutral.borderTertiary,
    borderRadius: 2,
    flex: 1,
    height: 3,
  },
  completedProgressSegment: {
    backgroundColor: colors.brand.burgundy,
  },
  activeProgressSegment: {
    backgroundColor: colors.brand.burgundyLight,
  },
  content: {
    gap: spacing.cardGap,
    padding: spacing.xl,
    paddingBottom: spacing.xl,
  },
  actionBar: {
    backgroundColor: colors.neutral.backgroundPrimary,
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: 0,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  helperText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.lg,
    flex: 1,
    height: 52,
    justifyContent: "center",
    marginBottom: 24,
    marginHorizontal: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: "500",
  },
});
