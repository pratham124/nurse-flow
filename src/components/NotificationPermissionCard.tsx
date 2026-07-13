import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import {
  colors,
  fontWeight,
  radius,
  spacing,
  textSize,
} from "../theme/tokens";
import type {
  DevicePushRegistrationState,
  NotificationPermissionStatus,
} from "../types/models";

type NotificationPermissionDialogProps = {
  onClose: () => void;
  permissionStatus: NotificationPermissionStatus;
  registrationState: DevicePushRegistrationState;
  visible: boolean;
};

type PermissionStatusContent = {
  accentColor: string;
  helperText: string;
  title: string;
};

const permissionStatusContent: Record<
  NotificationPermissionStatus,
  PermissionStatusContent
> = {
  unknown: {
    accentColor: colors.status.blue800,
    helperText:
      "Set them up later to receive updates when Nurse Flow is not open.",
    title: "Notifications are not set up",
  },
  granted: {
    accentColor: colors.status.greenIcon,
    helperText: "This device can receive Nurse Flow updates.",
    title: "Notifications are on",
  },
  denied: {
    accentColor: colors.brand.burgundyLight,
    helperText: "Nurse Flow still works normally while you are using the app.",
    title: "Notifications are blocked",
  },
  provisional: {
    accentColor: colors.status.blue800,
    helperText: "Updates may arrive quietly on this device.",
    title: "Quiet notifications are on",
  },
  unavailable: {
    accentColor: colors.neutral.textTertiary,
    helperText: "Nurse Flow still works normally in this app environment.",
    title: "Notifications are unavailable",
  },
};

export function NotificationPermissionDialog({
  onClose,
  permissionStatus,
  registrationState,
  visible,
}: NotificationPermissionDialogProps) {
  const content = permissionStatusContent[permissionStatus];

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.dialogHeader}>
            <Text style={styles.dialogTitle}>Notifications</Text>
            <Pressable
              accessibilityLabel="Close notifications"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
            >
              <Text style={styles.closeButtonText}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: content.accentColor },
              ]}
            />
            <View style={styles.copy}>
              <Text style={styles.title}>{content.title}</Text>
              <Text style={styles.helperText}>{content.helperText}</Text>
            </View>
          </View>
          {registrationState.status === "error" ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {registrationState.errorMessage}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(33, 26, 29, 0.32)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  closeButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.xs,
  },
  closeButtonPressed: {
    opacity: 0.65,
  },
  closeButtonText: {
    color: colors.brand.burgundy,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  dialog: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    gap: spacing.lg,
    maxWidth: 420,
    padding: spacing.xl,
    width: "100%",
  },
  dialogHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dialogTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  errorText: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  statusRow: {
    alignItems: "flex-start",
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
  },
  helperText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  statusIndicator: {
    borderRadius: radius.pill,
    height: 8,
    marginTop: 5,
    width: 8,
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
});
