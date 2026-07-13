import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  getPermissionsAsync,
  IosAuthorizationStatus,
  type NotificationPermissionsStatus,
} from "expo-notifications";

import type {
  DevicePushRegistrationState,
  NotificationPermissionStatus,
} from "../types/models";
import { registerDevicePushToken } from "../services/devicePushTokenRepository";
import { getSupabaseClient } from "../services/supabaseClient";
import { useAuthSession } from "./AuthSessionContext";

type NotificationPermissionContextValue = {
  permissionStatus: NotificationPermissionStatus;
  registrationState: DevicePushRegistrationState;
  retryRegistration: () => Promise<void>;
};

type NotificationPermissionProviderProps = PropsWithChildren;

const NotificationPermissionContext = createContext<
  NotificationPermissionContextValue | undefined
>(undefined);

function normalizePermissionStatus(
  permission: NotificationPermissionsStatus,
): NotificationPermissionStatus {
  const iosStatus = permission.ios?.status;

  if (
    iosStatus === IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === IosAuthorizationStatus.EPHEMERAL
  ) {
    return "provisional";
  }

  if (iosStatus === IosAuthorizationStatus.AUTHORIZED || permission.granted) {
    return "granted";
  }

  if (
    iosStatus === IosAuthorizationStatus.DENIED ||
    permission.status === "denied"
  ) {
    return "denied";
  }

  return "unknown";
}

export function NotificationPermissionProvider({
  children,
}: NotificationPermissionProviderProps) {
  const { authState } = useAuthSession();
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus>("unknown");
  const [registrationState, setRegistrationState] =
    useState<DevicePushRegistrationState>({ status: "idle" });
  const signedInProfileId =
    authState.status === "signed_in" ? authState.profile.id : undefined;

  useEffect(() => {
    let shouldUpdateState = true;

    if (!signedInProfileId) {
      setPermissionStatus("unknown");
      return () => {
        shouldUpdateState = false;
      };
    }

    async function loadPermissionStatus() {
      try {
        const permission = await getPermissionsAsync();

        if (shouldUpdateState) {
          setPermissionStatus(normalizePermissionStatus(permission));
        }
      } catch {
        if (shouldUpdateState) {
          setPermissionStatus("unavailable");
        }
      }
    }

    setPermissionStatus("unknown");
    void loadPermissionStatus();

    return () => {
      shouldUpdateState = false;
    };
  }, [signedInProfileId]);

  const registerCurrentDevice = useCallback(async () => {
    if (
      !signedInProfileId ||
      (permissionStatus !== "granted" && permissionStatus !== "provisional")
    ) {
      setRegistrationState({ status: "idle" });
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setRegistrationState({
        errorMessage: "Notifications need a configured server connection.",
        status: "error",
      });
      return;
    }

    setRegistrationState({ status: "registering" });

    try {
      const result = await registerDevicePushToken(supabase, {
        permissionStatus,
        profileId: signedInProfileId,
      });

      setRegistrationState({
        registeredAt: result.registeredAt,
        status: "registered",
      });
    } catch (error) {
      setRegistrationState({
        errorMessage:
          error instanceof Error
            ? error.message
            : "Notifications could not be registered on this device.",
        status: "error",
      });
    }
  }, [permissionStatus, signedInProfileId]);

  useEffect(() => {
    void registerCurrentDevice();
  }, [registerCurrentDevice]);

  const retryRegistration = useCallback(async () => {
    if (registrationState.status !== "error") {
      return;
    }

    await registerCurrentDevice();
  }, [registerCurrentDevice, registrationState.status]);

  const value = useMemo(
    () => ({ permissionStatus, registrationState, retryRegistration }),
    [permissionStatus, registrationState, retryRegistration],
  );

  return (
    <NotificationPermissionContext.Provider value={value}>
      {children}
    </NotificationPermissionContext.Provider>
  );
}

export function useNotificationPermission() {
  const context = useContext(NotificationPermissionContext);

  if (!context) {
    throw new Error(
      "useNotificationPermission must be used inside NotificationPermissionProvider.",
    );
  }

  return context;
}
