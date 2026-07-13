import type { SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import {
  AndroidImportance,
  getExpoPushTokenAsync,
  setNotificationChannelAsync,
} from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type {
  DevicePushPlatform,
  NotificationPermissionStatus,
} from "../types/models";

type RegisterDevicePushTokenInput = {
  permissionStatus: Extract<
    NotificationPermissionStatus,
    "granted" | "provisional"
  >;
  profileId: string;
};

type RegisterDevicePushTokenResult = {
  registeredAt: string;
};

const deviceIdStorageKey = "nurse-flow-device-push-id";
const notificationChannelId = "shift-updates";
let pendingRegistration: Promise<RegisterDevicePushTokenResult> | undefined;

function getPushPlatform(): DevicePushPlatform {
  if (Platform.OS === "android" || Platform.OS === "ios") {
    return Platform.OS;
  }

  throw new Error(
    "Push notifications are available only in a supported iOS or Android build.",
  );
}

async function getOrCreateDeviceId() {
  const canUseSecureStorage = await SecureStore.isAvailableAsync();

  if (!canUseSecureStorage) {
    throw new Error(
      "Secure device storage is unavailable, so notifications cannot be registered safely.",
    );
  }

  const storedDeviceId = await SecureStore.getItemAsync(deviceIdStorageKey);

  if (storedDeviceId) {
    return storedDeviceId;
  }

  const deviceId = Crypto.randomUUID();
  await SecureStore.setItemAsync(deviceIdStorageKey, deviceId);
  return deviceId;
}

async function getStoredDeviceId() {
  const canUseSecureStorage = await SecureStore.isAvailableAsync();

  if (!canUseSecureStorage) {
    return undefined;
  }

  return SecureStore.getItemAsync(deviceIdStorageKey);
}

function getExpoProjectId() {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (typeof projectId !== "string" || !projectId) {
    throw new Error(
      "This build is missing its Expo project ID, so notifications cannot be registered.",
    );
  }

  return projectId;
}

async function performDevicePushTokenRegistration(
  supabase: SupabaseClient,
  input: RegisterDevicePushTokenInput,
): Promise<RegisterDevicePushTokenResult> {
  const platform = getPushPlatform();

  if (platform === "android") {
    await setNotificationChannelAsync(notificationChannelId, {
      importance: AndroidImportance.DEFAULT,
      name: "Shift updates",
    });
  }

  const [deviceId, expoPushToken] = await Promise.all([
    getOrCreateDeviceId(),
    getExpoPushTokenAsync({ projectId: getExpoProjectId() }),
  ]);
  const registeredAt = new Date().toISOString();
  const { error } = await supabase.rpc("register_device_push_token", {
    p_device_id: deviceId,
    p_permission_status: input.permissionStatus,
    p_platform: platform,
    p_profile_id: input.profileId,
    p_push_token: expoPushToken.data,
  });

  if (error) {
    throw new Error(`Notifications could not be registered: ${error.message}`);
  }

  return { registeredAt };
}

export function registerDevicePushToken(
  supabase: SupabaseClient,
  input: RegisterDevicePushTokenInput,
) {
  const registration = performDevicePushTokenRegistration(supabase, input);
  pendingRegistration = registration;

  void registration.then(
    () => {
      if (pendingRegistration === registration) {
        pendingRegistration = undefined;
      }
    },
    () => {
      if (pendingRegistration === registration) {
        pendingRegistration = undefined;
      }
    },
  );

  return registration;
}

export async function disableCurrentDevicePushToken(
  supabase: SupabaseClient,
  profileId: string,
) {
  try {
    await pendingRegistration;
  } catch {
    // Registration already reports its own error. Sign out can still continue
    // when no active token was created.
  }

  const deviceId = await getStoredDeviceId();

  if (!deviceId) {
    return;
  }

  const { error } = await supabase.rpc("disable_current_device_push_token", {
    p_device_id: deviceId,
    p_profile_id: profileId,
  });

  if (error) {
    throw new Error(
      `Notifications could not be disabled before sign out: ${error.message}`,
    );
  }
}
