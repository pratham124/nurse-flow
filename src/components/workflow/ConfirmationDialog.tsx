import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, textSize } from "../../theme/tokens";

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

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={[
                styles.confirmButton,
                isDanger ? styles.dangerButton : null,
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
    backgroundColor: "rgba(16, 16, 20, 0.38)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    maxWidth: 340,
    padding: spacing.xl,
    width: "100%",
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "600",
  },
  message: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
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
  cancelButtonText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.action,
    fontWeight: "500",
  },
  confirmButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing.lg,
  },
  dangerButton: {
    backgroundColor: colors.status.red700,
  },
  confirmButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: "500",
  },
});
