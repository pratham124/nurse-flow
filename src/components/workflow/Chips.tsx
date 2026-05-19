import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, textSize } from "../../theme/tokens";

export function BedChip({ label }: { label: string }) {
  return (
    <View style={styles.bedChip}>
      <Text style={styles.bedChipText}>{label}</Text>
    </View>
  );
}

export function SummaryChip({ label }: { label: string }) {
  return (
    <View style={styles.summaryChip}>
      <Text style={styles.summaryChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bedChip: {
    backgroundColor: colors.brand.lightBlue,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bedChipText: {
    color: colors.neutral.text,
    fontSize: textSize.sm,
    fontWeight: "700",
  },
  summaryChip: {
    backgroundColor: colors.neutral.background,
    borderColor: colors.neutral.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  summaryChipText: {
    color: colors.neutral.text,
    fontSize: textSize.sm,
    fontWeight: "700",
  },
});
