import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import type { LocalStorageAdapter } from "./localStorageRepository";

type BrowserLocalStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function getBrowserLocalStorage() {
  return (globalThis as { localStorage?: BrowserLocalStorage }).localStorage;
}

function getLocalAppStateFileUri(key: string) {
  if (!FileSystem.documentDirectory) {
    return undefined;
  }

  return `${FileSystem.documentDirectory}${key}.json`;
}

export function createDeviceLocalStorageAdapter(): LocalStorageAdapter {
  return {
    async getItem(key) {
      if (Platform.OS === "web") {
        return getBrowserLocalStorage()?.getItem(key) ?? null;
      }

      const fileUri = getLocalAppStateFileUri(key);

      if (!fileUri) {
        return null;
      }

      const fileInfo = await FileSystem.getInfoAsync(fileUri);

      if (!fileInfo.exists) {
        return null;
      }

      return FileSystem.readAsStringAsync(fileUri);
    },

    async setItem(key, value) {
      if (Platform.OS === "web") {
        getBrowserLocalStorage()?.setItem(key, value);
        return;
      }

      const fileUri = getLocalAppStateFileUri(key);

      if (!fileUri) {
        return;
      }

      await FileSystem.writeAsStringAsync(fileUri, value);
    },

    async removeItem(key) {
      if (Platform.OS === "web") {
        getBrowserLocalStorage()?.removeItem(key);
        return;
      }

      const fileUri = getLocalAppStateFileUri(key);

      if (!fileUri) {
        return;
      }

      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    },
  };
}
