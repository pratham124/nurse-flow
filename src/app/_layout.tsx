import { Stack } from "expo-router";

import { LocalStateProvider } from "../store/LocalStateContext";
import { colors } from "../theme/tokens";

export default function RootLayout() {
  return (
    <LocalStateProvider>
      <Stack
        screenOptions={{
          animation: "slide_from_right",
          contentStyle: { backgroundColor: colors.neutral.backgroundPrimary },
          fullScreenGestureEnabled: true,
          gestureEnabled: true,
          headerShown: false,
        }}
      />
    </LocalStateProvider>
  );
}
