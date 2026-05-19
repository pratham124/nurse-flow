import { Stack } from "expo-router";

import { colors } from "../theme/tokens";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.neutral.backgroundPrimary },
        fullScreenGestureEnabled: true,
        gestureEnabled: true,
        headerShown: false,
      }}
    />
  );
}
