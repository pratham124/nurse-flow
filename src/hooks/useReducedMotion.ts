import { useSyncExternalStore } from "react";
import {
  AccessibilityInfo,
  type NativeEventSubscription,
} from "react-native";

let isReducedMotionEnabled = false;
let nativeSubscription: NativeEventSubscription | undefined;
const listeners = new Set<() => void>();

function updateReducedMotion(isEnabled: boolean) {
  if (isReducedMotionEnabled === isEnabled) {
    return;
  }

  isReducedMotionEnabled = isEnabled;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (!nativeSubscription) {
    void AccessibilityInfo.isReduceMotionEnabled().then(updateReducedMotion);
    nativeSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      updateReducedMotion,
    );
  }

  return () => {
    listeners.delete(listener);

    if (!listeners.size) {
      nativeSubscription?.remove();
      nativeSubscription = undefined;
    }
  };
}

function getReducedMotionSnapshot() {
  return isReducedMotionEnabled;
}

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    getReducedMotionSnapshot,
    getReducedMotionSnapshot,
  );
}
