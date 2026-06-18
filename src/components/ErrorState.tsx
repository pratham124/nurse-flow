import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontWeight, radius, spacing, textSize } from "../theme/tokens";

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  title?: string;
};

export function ErrorState({
  message,
  onRetry,
  retryLabel = "Retry",
  title = "Something went wrong",
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text accessibilityRole="alert" style={styles.message}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            pressed ? styles.retryButtonPressed : null,
          ]}
        >
          <Text style={styles.retryButtonText}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.status.red50,
    borderColor: colors.status.red700,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    color: colors.status.red700,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  message: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  retryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.status.red700,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing.lg,
  },
  retryButtonPressed: {
    opacity: 0.8,
  },
  retryButtonText: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
