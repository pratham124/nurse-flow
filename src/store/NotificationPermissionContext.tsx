import {
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

import type { NotificationPermissionStatus } from "../types/models";
import { useAuthSession } from "./AuthSessionContext";

type NotificationPermissionContextValue = {
  permissionStatus: NotificationPermissionStatus;
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

  const value = useMemo(
    () => ({ permissionStatus }),
    [permissionStatus],
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
