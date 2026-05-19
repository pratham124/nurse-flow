import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, textSize } from "../../theme/tokens";

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
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  sectionHeader: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.neutral.text,
    fontSize: textSize.lg,
    fontWeight: "700",
  },
  sectionNote: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});
