import type { Text } from "react-native";

export const accessibilityFocusProps = {
  tabIndex: -1 as const,
};

export function focusAccessibilityElement(element: Text | null) {
  element?.focus();
}
