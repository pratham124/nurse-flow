// Push notifications are turned off unless the build explicitly opts in with
// EXPO_PUBLIC_NOTIFICATIONS_ENABLED=true.
export function isNotificationsEnabled(
  value: string | undefined = process.env.EXPO_PUBLIC_NOTIFICATIONS_ENABLED,
) {
  return value === "true";
}

export const notificationsEnabled = isNotificationsEnabled();
