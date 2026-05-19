import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { floorTemplateFlow } from "../../utils/workflowFlows";
import type { WorkflowFlowStep } from "../../utils/workflowFlows";
import { colors, radius, spacing, textSize } from "../../theme/tokens";
import { StepIndicator } from "./StepIndicator";
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
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>{title}</Text>
          {headerActionLabel && onHeaderActionPress ? (
            <Pressable
              accessibilityRole="button"
              onPress={onHeaderActionPress}
              style={styles.headerAction}
            >
              <Text style={styles.headerActionText}>{headerActionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.subtitle}>{subtitle}</Text>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  header: {
    backgroundColor: colors.neutral.surface,
    borderBottomColor: colors.neutral.border,
    borderBottomWidth: 1,
    gap: spacing.xs,
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  headerTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  title: {
    color: colors.brand.burgundy,
    flex: 1,
    fontSize: textSize.xl,
    fontWeight: "700",
  },
  headerAction: {
    alignItems: "center",
    borderColor: colors.brand.burgundy,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  headerActionText: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.neutral.mutedText,
    fontSize: textSize.md,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xl,
  },
  actionBar: {
    backgroundColor: colors.neutral.surface,
    borderTopColor: colors.neutral.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  helperText: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
    lineHeight: 18,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.md,
    flex: 1,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.md,
    fontWeight: "700",
  },
});
