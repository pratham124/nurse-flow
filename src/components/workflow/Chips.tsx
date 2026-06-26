import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  colors,
  radius,
  spacing,
  textSize,
  fontWeight,
  shadows,
} from "../../theme/tokens";
import type { RealtimeConnectionState } from "../../types/models";

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

type LiveStatusChipProps = {
  connectionState: RealtimeConnectionState;
  onRefresh?: () => void;
};

type LiveStatusTone = "live" | "pending" | "warning" | "error";

type LiveStatusContent = {
  label: string;
  tone: LiveStatusTone;
};

const liveStatusContent: Record<RealtimeConnectionState, LiveStatusContent> = {
  connecting: {
    label: "Connecting",
    tone: "pending",
  },
  live: {
    label: "Live",
    tone: "live",
  },
  reconnecting: {
    label: "Reconnecting",
    tone: "pending",
  },
  disconnected: {
    label: "Disconnected",
    tone: "warning",
  },
  error: {
    label: "Live issue",
    tone: "error",
  },
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

export function SummaryTile({ value, label }: SummaryTileProps) {
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

export function StatusPill({ label, tone }: StatusPillProps) {
  return (
    <View style={[styles.statusPill, statusPillStyles[tone]]}>
      <View style={[styles.statusDot, statusDotStyles[tone]]} />
      <Text style={[styles.statusPillText, statusPillTextStyles[tone]]}>
        {label}
      </Text>
    </View>
  );
}

export function SeverityBadge({ label, tone }: SeverityBadgeProps) {
  return (
    <View style={[styles.severityBadge, severityBadgeStyles[tone]]}>
      <Text style={[styles.severityBadgeText, severityBadgeTextStyles[tone]]}>
        {label}
      </Text>
    </View>
  );
}

export function LiveStatusChip({
  connectionState,
  onRefresh,
}: LiveStatusChipProps) {
  const content = liveStatusContent[connectionState];
  const canRefresh =
    Boolean(onRefresh) &&
    (connectionState === "disconnected" || connectionState === "error");

  return (
    <View style={[styles.liveStatusChip, liveStatusChipStyles[content.tone]]}>
      <View style={styles.liveStatusLabelRow}>
        <View
          style={[styles.liveStatusDot, liveStatusDotStyles[content.tone]]}
        />
        <Text style={styles.liveStatusLabel}>{content.label}</Text>
      </View>
      {canRefresh ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRefresh}
          style={({ pressed }) => [
            styles.liveStatusRefreshButton,
            pressed && styles.liveStatusRefreshButtonPressed,
          ]}
        >
          <Text style={styles.liveStatusRefreshText}>Refresh</Text>
        </Pressable>
      ) : null}
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
  liveStatusChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 24,
    paddingVertical: 2,
  },
  liveStatusLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  liveStatusDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  liveStatusLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  liveStatusRefreshButton: {
    alignItems: "center",
    borderLeftColor: colors.neutral.borderSecondary,
    borderLeftWidth: 0.5,
    justifyContent: "center",
    minHeight: 24,
    paddingLeft: spacing.sm,
  },
  liveStatusRefreshButtonPressed: {
    opacity: 0.7,
  },
  liveStatusRefreshText: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
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

const liveStatusChipStyles = StyleSheet.create({
  live: {
    backgroundColor: "transparent",
  },
  pending: {
    backgroundColor: "transparent",
  },
  warning: {
    backgroundColor: "transparent",
  },
  error: {
    backgroundColor: "transparent",
  },
});

const liveStatusDotStyles = StyleSheet.create({
  live: {
    backgroundColor: colors.status.green700,
  },
  pending: {
    backgroundColor: colors.status.blue800,
  },
  warning: {
    backgroundColor: colors.status.yellow700,
  },
  error: {
    backgroundColor: colors.status.red700,
  },
});

type SegmentedControlProps<T extends string> = {
  options: readonly T[];
  selectedOption: T;
  onSelect: (option: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  selectedOption,
  onSelect,
}: SegmentedControlProps<T>) {
  return (
    <View style={segmentedStyles.container}>
      {options.map((option) => {
        const isSelected = option === selectedOption;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(option)}
            style={[
              segmentedStyles.button,
              isSelected ? segmentedStyles.selectedButton : null,
            ]}
          >
            <Text
              style={[
                segmentedStyles.text,
                isSelected ? segmentedStyles.selectedText : null,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const segmentedStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: radius.md,
    padding: 3,
    gap: 2,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  selectedButton: {
    backgroundColor: colors.neutral.surface,
    ...shadows.sm,
  },
  text: {
    color: colors.neutral.textSecondary,
    fontSize: 13,
    fontWeight: fontWeight.medium,
  },
  selectedText: {
    color: colors.neutral.textPrimary,
    fontWeight: fontWeight.bold,
  },
});
