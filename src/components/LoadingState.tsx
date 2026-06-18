import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, fontWeight, spacing, textSize } from "../theme/tokens";

type LoadingStateVariant = "card" | "inline";

type LoadingStateProps = {
  color?: string;
  message?: string;
  showMessage?: boolean;
  variant?: LoadingStateVariant;
};

export function LoadingState({
  color = colors.brand.burgundy,
  message = "Loading",
  showMessage = true,
  variant = "card",
}: LoadingStateProps) {
  const isInline = variant === "inline";

  return (
    <View
      accessibilityLabel={message}
      accessibilityRole="progressbar"
      style={isInline ? styles.inlineContainer : styles.cardContainer}
    >
      <ActivityIndicator color={color} />
      {showMessage ? (
        <Text style={isInline ? styles.inlineMessage : styles.cardMessage}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    alignItems: "center",
    gap: spacing.md,
  },
  cardMessage: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: "center",
  },
  inlineContainer: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
  },
  inlineMessage: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
});
