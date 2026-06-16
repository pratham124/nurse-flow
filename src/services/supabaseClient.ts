import "react-native-url-polyfill/auto";

import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseConfigStatus =
  | { status: "ready"; publishableKey: string; url: string }
  | { status: "missing_config"; message: string };

const missingConfigMessage =
  "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY before using account features.";

const secureStoreSessionStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
};

let supabaseClient: SupabaseClient | undefined;
let hasRegisteredAutoRefresh = false;

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return {
      message: missingConfigMessage,
      status: "missing_config",
    };
  }

  return {
    publishableKey,
    status: "ready",
    url,
  };
}

export async function canUseNativeSecureSessionStorage() {
  if (Platform.OS === "web") {
    return true;
  }

  return SecureStore.isAvailableAsync();
}

export function getSupabaseClient() {
  const configStatus = getSupabaseConfigStatus();

  if (configStatus.status === "missing_config") {
    return undefined;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(configStatus.url, configStatus.publishableKey, {
      auth: {
        ...(Platform.OS !== "web" ? { storage: secureStoreSessionStorage } : {}),
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
      },
    });
  }

  if (Platform.OS !== "web" && !hasRegisteredAutoRefresh) {
    hasRegisteredAutoRefresh = true;

    AppState.addEventListener("change", (state) => {
      if (!supabaseClient) {
        return;
      }

      if (state === "active") {
        supabaseClient.auth.startAutoRefresh();
        return;
      }

      supabaseClient.auth.stopAutoRefresh();
    });
  }

  return supabaseClient;
}
