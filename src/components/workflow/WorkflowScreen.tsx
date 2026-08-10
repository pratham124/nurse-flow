import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { floorTemplateFlow } from "../../utils/workflowFlows";
import type { WorkflowFlowStep } from "../../utils/workflowFlows";
import { colors, radius, spacing, textSize, fontWeight, shadows } from "../../theme/tokens";
import { StepIndicator } from "./StepIndicator";
import { HomeIcon } from "./Icons";
import { ResponsiveContent } from "./ResponsiveContent";
import type { WorkflowStep } from "./types";

type WorkflowScreenProps = {
  title: string;
  subtitle?: string;
  headerActionLabel?: string;
  onHeaderActionPress?: () => void;
  activeStep: WorkflowStep;
  flow?: WorkflowFlowStep[];
  hideStepIndicator?: boolean;
  children: ReactNode;
  primaryLabel?: string;
  onPrimaryPress?: () => void;
  primaryDisabled?: boolean;
  primaryAppearance?: "prominent" | "compactSecondary";
  actionErrorText?: string;
  managesOwnScrolling?: boolean;
  bottomAccessory?: ReactNode;
};

type SegmentedProgressProps = {
  activeIndex: number;
  segmentCount: number;
};

export function WorkflowScreen({
  title,
  subtitle = "",
  headerActionLabel,
  onHeaderActionPress,
  activeStep,
  flow = floorTemplateFlow,
  hideStepIndicator = false,
  children,
  primaryLabel,
  onPrimaryPress,
  primaryDisabled = false,
  primaryAppearance = "prominent",
  actionErrorText,
  managesOwnScrolling = false,
  bottomAccessory,
}: WorkflowScreenProps) {
  const activeStepIndex = flow.findIndex(
    (flowStep) => flowStep.step === activeStep,
  );
  const showSubtitle = Boolean(subtitle) && !/^Step \d+ of \d+$/.test(subtitle);

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
              style={({ pressed }) => [
                styles.headerAction,
                pressed ? styles.headerActionPressed : null,
              ]}
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

      {managesOwnScrolling ? (
        <View style={styles.managedContent}>{children}</View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <ResponsiveContent expanded>
            <View style={styles.contentColumn}>
              {hideStepIndicator ? null : (
                <StepIndicator activeStep={activeStep} flow={flow} />
              )}
              {children}
            </View>
          </ResponsiveContent>
        </ScrollView>
      )}

      <View style={styles.actionBar}>
        {bottomAccessory}
        {actionErrorText ? (
          <Text accessibilityRole="alert" style={styles.actionErrorText}>
            {actionErrorText}
          </Text>
        ) : null}
        {primaryLabel && onPrimaryPress ? (
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: primaryDisabled }}
              disabled={primaryDisabled}
              onPress={onPrimaryPress}
              style={({ pressed }) => [
                styles.primaryButton,
                primaryAppearance === "compactSecondary"
                  ? styles.compactSecondaryButton
                  : null,
                primaryDisabled ? styles.disabledPrimaryButton : null,
                pressed && !primaryDisabled ? styles.pressedPrimaryButton : null,
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  primaryAppearance === "compactSecondary"
                    ? styles.compactSecondaryButtonText
                    : null,
                ]}
              >
                {primaryLabel}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function SegmentedProgress({
  activeIndex,
  segmentCount,
}: SegmentedProgressProps) {
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
    backgroundColor: colors.neutral.surface,
    gap: 2,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.borderTertiary,
    ...shadows.sm,
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
    fontWeight: fontWeight.bold,
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
  headerActionPressed: {
    opacity: 0.7,
  },
  subtitle: {
    color: colors.neutral.textSecondary,
    fontSize: 13,
    fontWeight: fontWeight.medium,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  progressSegment: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: radius.pill,
    flex: 1,
    height: 4,
  },
  completedProgressSegment: {
    backgroundColor: colors.brand.burgundy,
  },
  activeProgressSegment: {
    backgroundColor: colors.brand.burgundyLight,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xl,
  },
  contentColumn: {
    gap: spacing.cardGap,
  },
  managedContent: {
    flex: 1,
  },
  actionBar: {
    backgroundColor: colors.neutral.backgroundPrimary,
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
  },
  actionErrorText: {
    color: colors.status.red700,
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
    marginBottom: spacing.md,
    marginHorizontal: spacing.xl,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  compactSecondaryButton: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.brand.burgundy,
    borderWidth: 1,
    flex: 0,
    height: 44,
    minWidth: 144,
  },
  disabledPrimaryButton: {
    opacity: 0.48,
  },
  pressedPrimaryButton: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  compactSecondaryButtonText: {
    color: colors.brand.burgundy,
  },
});

