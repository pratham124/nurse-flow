import { Redirect } from "expo-router";

import { notificationsEnabled } from "../config/featureFlags";
import NotificationRecoveryScreen from "../screens/NotificationRecoveryScreen";

export default function NotificationRecoveryRoute() {
  // With notifications off there is nothing to recover from, so go home.
  if (!notificationsEnabled) {
    return <Redirect href="/" />;
  }

  return <NotificationRecoveryScreen />;
}
