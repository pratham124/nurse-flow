import { Stack } from "expo-router";

import { SessionGate } from "../components/SessionGate";
import { AuthSessionProvider } from "../store/AuthSessionContext";
import { LocalStateProvider } from "../store/LocalStateContext";
import { colors } from "../theme/tokens";

export default function RootLayout() {
  return (
    <AuthSessionProvider>
      <LocalStateProvider>
        <SessionGate>
          <Stack
            screenOptions={{
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.neutral.backgroundPrimary },
              fullScreenGestureEnabled: true,
              gestureEnabled: true,
              headerShown: false,
            }}
          />
        </SessionGate>
      </LocalStateProvider>
    </AuthSessionProvider>
  );
}
