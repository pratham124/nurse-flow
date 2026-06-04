import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, textSize, fontWeight, shadows } from "../../theme/tokens";

type WorkflowSectionProps = {
  title: string;
  children: ReactNode;
  note?: string;
};

export function WorkflowSection({
  title,
  children,
  note,
}: WorkflowSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.topAccentBar} />
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: 18,
    padding: spacing.lg,
    position: "relative",
    overflow: "hidden",
    ...shadows.sm,
  },
  topAccentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.brand.burgundy,
  },
  sectionHeader: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.semibold,
  },
  sectionNote: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});

