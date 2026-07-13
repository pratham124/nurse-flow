import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import {
  colors,
  fontWeight,
  radius,
  spacing,
  textSize,
} from "../theme/tokens";
import { BellIcon } from "./workflow";
import type {
  DevicePushRegistrationState,
  NotificationPermissionStatus,
} from "../types/models";

type NotificationPermissionDialogProps = {
  onClose: () => void;
  onRetryRegistration: () => Promise<void>;
  permissionStatus: NotificationPermissionStatus;
  registrationState: DevicePushRegistrationState;
  visible: boolean;
};

type RegistrationStatusContent = {
  badgeBackgroundColor: string;
  badgeTextColor: string;
  helperText: string;
  title: string;
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

const registrationStatusContent: Record<
  DevicePushRegistrationState["status"],
  RegistrationStatusContent
> = {
  idle: {
    badgeBackgroundColor: colors.neutral.backgroundSecondary,
    badgeTextColor: colors.neutral.textSecondary,
    helperText: "This device is not connected for background updates.",
    title: "Not registered",
  },
  registering: {
    badgeBackgroundColor: colors.status.blue50,
    badgeTextColor: colors.status.blue800,
    helperText: "Connecting this device to your signed-in profile.",
    title: "Connecting",
  },
  registered: {
    badgeBackgroundColor: colors.status.green50,
    badgeTextColor: colors.status.green800,
    helperText: "This device is ready for background updates.",
    title: "Registered",
  },
  error: {
    badgeBackgroundColor: colors.status.red50,
    badgeTextColor: colors.status.red700,
    helperText: "Nurse Flow could not connect this device to the server.",
    title: "Needs attention",
  },
};

const notificationCategories = [
  "Nurse requests",
  "Assignments & breaks",
  "Floor activity & safety",
] as const;

export function NotificationPermissionDialog({
  onClose,
  onRetryRegistration,
  permissionStatus,
  registrationState,
  visible,
}: NotificationPermissionDialogProps) {
  const content = permissionStatusContent[permissionStatus];
  const registrationContent =
    registrationStatusContent[registrationState.status];

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
            <View style={styles.statusIcon}>
              <BellIcon color={content.accentColor} size={18} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>{content.title}</Text>
              <Text style={styles.helperText}>{content.helperText}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.registrationHeader}>
              <Text style={styles.sectionTitle}>Device registration</Text>
              <View
                style={[
                  styles.registrationBadge,
                  {
                    backgroundColor:
                      registrationContent.badgeBackgroundColor,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.registrationBadgeText,
                    { color: registrationContent.badgeTextColor },
                  ]}
                >
                  {registrationContent.title}
                </Text>
              </View>
            </View>
            <Text style={styles.helperText}>
              {registrationContent.helperText}
            </Text>
          </View>
          {registrationState.status === "error" ? (
            <View style={styles.errorPanel}>
              <Text accessibilityRole="alert" style={styles.errorText}>
                {registrationState.errorMessage}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void onRetryRegistration()}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.retryButtonPressed,
                ]}
              >
                <Text style={styles.retryButtonText}>Retry registration</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Updates include</Text>
            <View style={styles.categoryList}>
              {notificationCategories.map((category) => (
                <View key={category} style={styles.categoryChip}>
                  <Text style={styles.categoryText}>{category}</Text>
                </View>
              ))}
            </View>
          </View>
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
  categoryChip: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryList: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  categoryText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
  },
  dialog: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    gap: spacing.xl,
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
  errorPanel: {
    backgroundColor: colors.status.red50,
    borderRadius: radius.md,
    gap: spacing.md,
    padding: spacing.lg,
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
  registrationBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  registrationBadgeText: {
    fontSize: textSize.xs,
    fontWeight: fontWeight.semibold,
  },
  registrationHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  retryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.pill,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  retryButtonPressed: {
    opacity: 0.75,
  },
  retryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  statusIcon: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
});
