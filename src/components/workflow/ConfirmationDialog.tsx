import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, textSize, fontWeight, shadows } from "../../theme/tokens";

type ConfirmationDialogProps = {
  confirmLabel: string;
  message: string;
  title: string;
  visible: boolean;
  cancelLabel?: string;
  confirmTone?: "default" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmationDialog({
  confirmLabel,
  message,
  title,
  visible,
  cancelLabel = "Cancel",
  confirmTone = "default",
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  const isDanger = confirmTone === "danger";

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.divider} />

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed ? styles.cancelButtonPressed : null,
              ]}
            >
              <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                isDanger ? styles.dangerButton : null,
                pressed ? styles.confirmButtonPressed : null,
              ]}
            >
              <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(16, 16, 20, 0.4)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xxl,
    borderWidth: 0.5,
    gap: spacing.md,
    maxWidth: 360,
    padding: spacing.xl,
    width: "100%",
    ...shadows.lg,
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  message: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral.borderTertiary,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  cancelButton: {
    alignItems: "center",
    borderColor: colors.neutral.borderSecondary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing.lg,
  },
  cancelButtonPressed: {
    backgroundColor: colors.neutral.backgroundSecondary,
  },
  cancelButtonText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.action,
    fontWeight: fontWeight.medium,
  },
  confirmButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing.lg,
  },
  confirmButtonPressed: {
    opacity: 0.85,
  },
  dangerButton: {
    backgroundColor: colors.status.red700,
  },
  confirmButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.medium,
  },
});

