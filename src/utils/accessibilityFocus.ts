import {
  AccessibilityInfo,
  findNodeHandle,
  type Text,
} from "react-native";

export const accessibilityFocusProps = {};

export function focusAccessibilityElement(element: Text | null) {
  const nodeHandle = findNodeHandle(element);

  if (nodeHandle) {
    AccessibilityInfo.setAccessibilityFocus(nodeHandle);
  }
}
