import { useRef } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useReducedMotion } from "../../hooks/useReducedMotion";
import { colors, radius, spacing, textSize, fontWeight, shadows } from "../../theme/tokens";

type ConfirmationDialogProps = {
  confirmLabel: string;
  message: string;
  title: string;
  visible: boolean;
  cancelLabel?: string;
  cancelDisabled?: boolean;
  confirmDisabled?: boolean;
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
  cancelDisabled = false,
  confirmDisabled = false,
  confirmTone = "default",
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  const isDanger = confirmTone === "danger";
  const isReducedMotionEnabled = useReducedMotion();
  const titleRef = useRef<Text>(null);

  function focusDialogTitle() {
    const titleNode = findNodeHandle(titleRef.current);

    if (titleNode) {
      AccessibilityInfo.setAccessibilityFocus(titleNode);
    }
  }

  return (
    <Modal
      animationType={isReducedMotionEnabled ? "none" : "fade"}
      onShow={focusDialogTitle}
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View accessibilityViewIsModal style={styles.backdrop}>
        <View style={styles.card}>
          <Text
            accessibilityRole="header"
            ref={titleRef}
            style={styles.title}
          >
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.divider} />

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: cancelDisabled }}
              disabled={cancelDisabled}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.cancelButton,
                cancelDisabled ? styles.disabledButton : null,
                pressed && !cancelDisabled ? styles.cancelButtonPressed : null,
              ]}
            >
              <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: confirmDisabled }}
              disabled={confirmDisabled}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                isDanger ? styles.dangerButton : null,
                confirmDisabled ? styles.disabledButton : null,
                pressed && !confirmDisabled
                  ? styles.confirmButtonPressed
                  : null,
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
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  cancelButton: {
    alignItems: "center",
    borderColor: colors.neutral.borderSecondary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    justifyContent: "center",
    minHeight: 44,
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
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  confirmButtonPressed: {
    opacity: 0.85,
  },
  disabledButton: {
    opacity: 0.48,
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

