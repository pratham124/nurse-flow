import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, textSize, fontWeight, shadows } from "../../theme/tokens";

type BedChipProps = {
  label: string;
};

type ChipRowProps = {
  children: ReactNode;
};

type SummaryChipProps = {
  label: string;
};

type SummaryTileProps = {
  value: string;
  label: string;
};

type FilterChipProps = {
  label: string;
  onPress?: () => void;
  selected?: boolean;
};

type StatusTone = "occupied" | "empty" | "red" | "yellow" | "green";

type StatusPillProps = {
  label: string;
  tone: StatusTone;
};

type SeverityTone = "warning" | "info" | "critical";

type SeverityBadgeProps = {
  label: string;
  tone: SeverityTone;
};

export function BedChip({ label }: BedChipProps) {
  return (
    <View style={styles.bedChip}>
      <Text style={styles.bedChipText}>{label}</Text>
    </View>
  );
}

export function BedChipRow({ children }: ChipRowProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.bedChipRowContent}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function SummaryChip({ label }: SummaryChipProps) {
  return (
    <View style={styles.summaryChip}>
      <Text style={styles.summaryChipText}>{label}</Text>
    </View>
  );
}

export function SummaryTileGrid({ children }: ChipRowProps) {
  return <View style={styles.summaryTileGrid}>{children}</View>;
}

export function SummaryTile({
  value,
  label,
}: SummaryTileProps) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryTileValue}>{value}</Text>
      <Text style={styles.summaryTileLabel}>{label}</Text>
    </View>
  );
}

export function FilterChip({
  label,
  onPress,
  selected = false,
}: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress, selected }}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.filterChip, selected ? styles.selectedFilterChip : null]}
    >
      <Text
        style={[
          styles.filterChipText,
          selected ? styles.selectedFilterChipText : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function FilterChipRow({ children }: ChipRowProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.filterChipRowContent}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function StatusPill({
  label,
  tone,
}: StatusPillProps) {
  return (
    <View style={[styles.statusPill, statusPillStyles[tone]]}>
      <View style={[styles.statusDot, statusDotStyles[tone]]} />
      <Text style={[styles.statusPillText, statusPillTextStyles[tone]]}>
        {label}
      </Text>
    </View>
  );
}

export function SeverityBadge({
  label,
  tone,
}: SeverityBadgeProps) {
  return (
    <View style={[styles.severityBadge, severityBadgeStyles[tone]]}>
      <Text style={[styles.severityBadgeText, severityBadgeTextStyles[tone]]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bedChip: {
    backgroundColor: colors.brand.burgundy10,
    borderColor: "rgba(107, 30, 58, 0.2)",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  bedChipText: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
  },
  bedChipRowContent: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  summaryChip: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  summaryChipText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
  },
  summaryTileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryTile: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    flex: 1,
    gap: spacing.xs,
    minWidth: 86,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    ...shadows.sm,
  },
  summaryTileValue: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: "center",
  },
  summaryTileLabel: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    textAlign: "center",
  },
  filterChip: {
    alignItems: "center",
    borderColor: colors.neutral.borderSecondary,
    borderRadius: 20,
    borderWidth: 0.5,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filterChipRowContent: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  selectedFilterChip: {
    backgroundColor: colors.brand.burgundy10,
    borderColor: colors.brand.burgundy,
    borderWidth: 1,
    ...shadows.sm,
  },
  filterChipText: {
    color: colors.neutral.textSecondary,
    fontSize: 13,
  },
  selectedFilterChipText: {
    color: colors.brand.burgundy,
    fontWeight: fontWeight.semibold,
  },
  statusPill: {
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: textSize.xs,
    fontWeight: fontWeight.medium,
  },
  severityBadge: {
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  severityBadgeText: {
    fontSize: textSize.xs,
  },
});

const statusDotStyles = StyleSheet.create({
  occupied: {
    backgroundColor: colors.status.green700,
  },
  empty: {
    backgroundColor: colors.status.gray800,
  },
  red: {
    backgroundColor: colors.status.red700,
  },
  yellow: {
    backgroundColor: colors.status.yellow700,
  },
  green: {
    backgroundColor: colors.status.green700,
  },
});

const statusPillStyles = StyleSheet.create({
  occupied: {
    backgroundColor: colors.status.green50,
  },
  empty: {
    backgroundColor: colors.status.gray100,
  },
  red: {
    backgroundColor: colors.status.red50,
  },
  yellow: {
    backgroundColor: colors.status.amber50,
  },
  green: {
    backgroundColor: colors.status.green50,
  },
});

const statusPillTextStyles = StyleSheet.create({
  occupied: {
    color: colors.status.green800,
  },
  empty: {
    color: colors.status.gray800,
  },
  red: {
    color: colors.status.red800,
  },
  yellow: {
    color: colors.status.amber800,
  },
  green: {
    color: colors.status.green800,
  },
});

const severityBadgeStyles = StyleSheet.create({
  warning: {
    backgroundColor: colors.status.amber50,
  },
  info: {
    backgroundColor: colors.status.blue50,
  },
  critical: {
    backgroundColor: colors.status.red50,
  },
});

const severityBadgeTextStyles = StyleSheet.create({
  warning: {
    color: colors.status.amber800,
  },
  info: {
    color: colors.status.blue800,
  },
  critical: {
    color: colors.status.red800,
  },
});
