import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { router, type Href } from "expo-router";
import * as Notifications from "expo-notifications";

import {
  loadJoinedNurseNotificationTargetState,
  loadServerActiveShift,
} from "../services/serverWorkspaceRepository";
import { getSupabaseClient } from "../services/supabaseClient";
import {
  parseNotificationTapPayload,
  type NotificationTapPayload,
} from "../utils/notificationTap";
import { useAuthSession } from "./AuthSessionContext";
import { useServerWorkspace } from "./ServerWorkspaceContext";

export type NotificationTapRecoveryReason =
  | "idle"
  | "loading"
  | "signed_out"
  | "shift_ended"
  | "access_removed"
  | "request_missing"
  | "malformed"
  | "refresh_failed";

type NotificationTapContextValue = {
  recoveryReason: NotificationTapRecoveryReason;
  retryNotificationTap: () => void;
};

type NotificationTapProviderProps = PropsWithChildren;

const NotificationTapContext = createContext<
  NotificationTapContextValue | undefined
>(undefined);

const notificationRecoveryRoute = "/notification-recovery" as Href;

function getNotificationData(response: Notifications.NotificationResponse) {
  return response.notification.request.content.data;
}

export function NotificationTapProvider({
  children,
}: NotificationTapProviderProps) {
  const { authState } = useAuthSession();
  const { retryLoadJoinedNurseAccess, retryLoadWorkspace } =
    useServerWorkspace();
  const [pendingPayload, setPendingPayload] =
    useState<NotificationTapPayload>();
  const [retryCount, setRetryCount] = useState(0);
  const [recoveryReason, setRecoveryReason] =
    useState<NotificationTapRecoveryReason>("idle");
  const handledResponseId = useRef<string | undefined>(undefined);

  const receiveNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const responseId = response.notification.request.identifier;

      if (handledResponseId.current === responseId) {
        return;
      }

      handledResponseId.current = responseId;
      try {
        Notifications.clearLastNotificationResponse();
      } catch {
        // A platform without native notification response storage has nothing to clear.
      }
      const payload = parseNotificationTapPayload(
        getNotificationData(response),
      );

      if (!payload) {
        setPendingPayload(undefined);
        setRecoveryReason("malformed");
        router.replace(notificationRecoveryRoute);
        return;
      }

      setPendingPayload(payload);
      setRecoveryReason("loading");
      router.replace(notificationRecoveryRoute);
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    try {
      const response = Notifications.getLastNotificationResponse();

      if (isMounted && response) {
        receiveNotificationResponse(response);
      }
    } catch {
      // Web and unsupported native builds can continue without tap routing.
    }

    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        receiveNotificationResponse,
      );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [receiveNotificationResponse]);

  useEffect(() => {
    if (!pendingPayload || authState.status === "checking") {
      return;
    }

    if (authState.status !== "signed_in") {
      setRecoveryReason("signed_out");
      return;
    }

    const payload = pendingPayload;
    const profile = authState.profile;
    let shouldFinish = true;

    async function openCurrentNotificationTarget() {
      const supabase = getSupabaseClient();

      setRecoveryReason("loading");
      router.replace(notificationRecoveryRoute);

      if (!supabase) {
        setRecoveryReason("refresh_failed");
        return;
      }

      try {
        if (
          payload.targetRoute === "joinedNurseAssignment" ||
          (payload.targetRoute === "requestDetail" &&
            Boolean(payload.recipientAccessId))
        ) {
          const targetState = await loadJoinedNurseNotificationTargetState(
            supabase,
            profile,
            {
              accessId: payload.recipientAccessId!,
              shiftId: payload.shiftId,
            },
          );

          if (!shouldFinish) {
            return;
          }

          if (targetState.status !== "ready") {
            setRecoveryReason(targetState.status);
            return;
          }

          if (
            payload.targetRoute === "requestDetail" &&
            !targetState.assignmentView.requestHistory.some(
              (request) => request.id === payload.relatedRequestId,
            )
          ) {
            setRecoveryReason("request_missing");
            return;
          }

          await retryLoadJoinedNurseAccess();

          if (shouldFinish) {
            setPendingPayload(undefined);
            setRecoveryReason("idle");
            if (payload.targetRoute === "requestDetail") {
              router.replace({
                pathname: "/joined-request-detail",
                params: { requestId: payload.relatedRequestId! },
              });
            } else {
              router.replace("/regular-nurse-workspace");
            }
          }
          return;
        }

        const activeShift = await loadServerActiveShift(
          supabase,
          profile,
        );

        if (!shouldFinish) {
          return;
        }

        if (!activeShift || activeShift.id !== payload.shiftId) {
          setRecoveryReason("shift_ended");
          return;
        }

        if (
          payload.targetRoute === "requestDetail" &&
          !activeShift.shiftSnapshot.nurseRequests?.some(
            (request) => request.id === payload.relatedRequestId,
          )
        ) {
          setRecoveryReason("request_missing");
          return;
        }

        await retryLoadWorkspace();

        if (!shouldFinish) {
          return;
        }

        setPendingPayload(undefined);
        setRecoveryReason("idle");

        if (payload.targetRoute === "requestDetail") {
          router.replace({
            pathname: "/charge-request-detail",
            params: { requestId: payload.relatedRequestId! },
          });
        } else if (
          payload.targetRoute === "flags" ||
          payload.targetRoute === "requestsList"
        ) {
          router.replace("/flags");
        } else {
          router.replace("/floor-board");
        }
      } catch {
        if (shouldFinish) {
          setRecoveryReason("refresh_failed");
        }
      }
    }

    void openCurrentNotificationTarget();

    return () => {
      shouldFinish = false;
    };
  }, [
    authState,
    pendingPayload,
    retryCount,
    retryLoadJoinedNurseAccess,
    retryLoadWorkspace,
  ]);

  const retryNotificationTap = useCallback(() => {
    if (pendingPayload) {
      setRetryCount((currentCount) => currentCount + 1);
    }
  }, [pendingPayload]);

  const value = useMemo(
    () => ({ recoveryReason, retryNotificationTap }),
    [recoveryReason, retryNotificationTap],
  );

  return (
    <NotificationTapContext.Provider value={value}>
      {children}
    </NotificationTapContext.Provider>
  );
}

export function useNotificationTap() {
  const context = useContext(NotificationTapContext);

  if (!context) {
    throw new Error(
      "useNotificationTap must be used inside NotificationTapProvider.",
    );
  }

  return context;
}
