import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { SessionGate } from "../components/SessionGate";
import { AuthSessionProvider } from "../store/AuthSessionContext";
import { NotificationPermissionProvider } from "../store/NotificationPermissionContext";
import { NotificationTapProvider } from "../store/NotificationTapContext";
import { ServerWorkspaceProvider } from "../store/ServerWorkspaceContext";
import { WorkflowDraftProvider } from "../store/WorkflowDraftContext";
import { colors } from "../theme/tokens";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthSessionProvider>
        <NotificationPermissionProvider>
          <ServerWorkspaceProvider>
            <NotificationTapProvider>
              <WorkflowDraftProvider>
                <SessionGate>
                  <Stack
                    screenOptions={{
                      animation: "slide_from_right",
                      contentStyle: {
                        backgroundColor: colors.neutral.backgroundPrimary,
                      },
                      gestureEnabled: true,
                      headerShown: false,
                    }}
                  />
                </SessionGate>
              </WorkflowDraftProvider>
            </NotificationTapProvider>
          </ServerWorkspaceProvider>
        </NotificationPermissionProvider>
      </AuthSessionProvider>
    </GestureHandlerRootView>
  );
}
