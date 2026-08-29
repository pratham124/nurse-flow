import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type PropsWithChildren,
} from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";

import { loadServerActiveShift } from "../services/serverWorkspaceRepository";
import {
  subscribeToChargeActiveShift,
  subscribeToJoinedNurseAssignmentView,
} from "../services/realtimeWorkspaceRepository";
import { getSupabaseClient } from "../services/supabaseClient";
import { useAuthSession } from "./AuthSessionContext";
import { serverWorkspaceDependencies } from "./serverWorkspaceDependencies";
import {
  createServerWorkspaceStore,
  type ServerWorkspaceStore,
} from "./serverWorkspaceStore";

type ServerWorkspaceProviderProps = PropsWithChildren;

const ServerWorkspaceContext = createContext<
  StoreApi<ServerWorkspaceStore> | undefined
>(undefined);

export function ServerWorkspaceProvider({
  children,
}: ServerWorkspaceProviderProps) {
  const { authState } = useAuthSession();
  const authStateRef = useRef(authState);
  authStateRef.current = authState;

  const storeRef = useRef<StoreApi<ServerWorkspaceStore> | undefined>(
    undefined,
  );

  if (!storeRef.current) {
    storeRef.current = createServerWorkspaceStore({
      dependencies: serverWorkspaceDependencies,
      getAuthState: () => authStateRef.current,
      getSupabaseClient,
    });
  }

  const store = storeRef.current;
  const workspaceState = useStore(store, (state) => state.workspaceState);
  const joinedNurseAccessState = useStore(
    store,
    (state) => state.joinedNurseAccessState,
  );
  const retryLoadWorkspace = store.getState().retryLoadWorkspace;
  const retryLoadJoinedNurseAccess =
    store.getState().retryLoadJoinedNurseAccess;

  useEffect(() => {
    void retryLoadWorkspace();
  }, [authState, retryLoadWorkspace]);

  const activeShiftId =
    workspaceState.status === "ready" || workspaceState.status === "empty"
      ? workspaceState.workspace.activeShift?.id
      : undefined;
  const chargeProfileId =
    authState.status === "signed_in" &&
    authState.profile.role === "charge_nurse"
      ? authState.profile.id
      : undefined;

  useEffect(() => {
    const {
      replaceActiveShiftFromRealtime,
      setRealtimeConnectionState,
    } = store.getState();

    if (!chargeProfileId || !activeShiftId) {
      setRealtimeConnectionState("disconnected");
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setRealtimeConnectionState("error");
      console.error("[Realtime] Supabase is not configured.");
      return;
    }

    const activeSupabase = supabase;
    const subscribedActiveShiftId = activeShiftId;
    const subscribedChargeProfileId = chargeProfileId;
    let isCurrentSubscription = true;

    async function refreshActiveShiftFromServer() {
      console.info(
        `[Realtime] Active shift ${subscribedActiveShiftId} changed; refreshing server state.`,
      );

      try {
        const activeShift = await loadServerActiveShift(activeSupabase, {
          id: subscribedChargeProfileId,
          role: "charge_nurse",
        });

        if (isCurrentSubscription) {
          replaceActiveShiftFromRealtime(activeShift);
        }
      } catch (error: unknown) {
        if (!isCurrentSubscription) {
          return;
        }

        setRealtimeConnectionState("error");
        console.error("[Realtime] Active shift refresh failed.", error);
      }
    }

    setRealtimeConnectionState("connecting");
    console.info(
      `[Realtime] Starting charge active shift listener for ${subscribedActiveShiftId}.`,
    );

    const stopSubscription = subscribeToChargeActiveShift({
      activeShiftId: subscribedActiveShiftId,
      onConnectionStateChange: (connectionState, error) => {
        setRealtimeConnectionState(connectionState);

        if (error) {
          console.error(
            `[Realtime] Charge active shift listener ${connectionState}.`,
            error,
          );
          return;
        }

        console.info(
          `[Realtime] Charge active shift listener ${connectionState}.`,
        );
      },
      onShiftChanged: () => {
        void refreshActiveShiftFromServer();
      },
      supabase: activeSupabase,
    });

    return () => {
      isCurrentSubscription = false;
      console.info(
        `[Realtime] Stopping charge active shift listener for ${subscribedActiveShiftId}.`,
      );
      stopSubscription();
      setRealtimeConnectionState("disconnected");
    };
  }, [activeShiftId, chargeProfileId, store]);

  useEffect(() => {
    void retryLoadJoinedNurseAccess();
  }, [authState, retryLoadJoinedNurseAccess, workspaceState]);

  const joinedNurseProfileId =
    authState.status === "signed_in" ? authState.profile.id : undefined;
  const joinedNurseAccessId =
    joinedNurseAccessState.status === "ready"
      ? joinedNurseAccessState.assignmentView.access.id
      : undefined;
  const joinedNurseShiftId =
    joinedNurseAccessState.status === "ready"
      ? joinedNurseAccessState.assignmentView.shiftId
      : undefined;

  useEffect(() => {
    const { setJoinedNurseRealtimeConnectionState } = store.getState();

    if (!joinedNurseProfileId || !joinedNurseAccessId || !joinedNurseShiftId) {
      setJoinedNurseRealtimeConnectionState("disconnected");
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setJoinedNurseRealtimeConnectionState("error");
      console.error("[Realtime] Supabase is not configured.");
      return;
    }

    const subscribedAccessId = joinedNurseAccessId;
    const subscribedShiftId = joinedNurseShiftId;
    let isCurrentSubscription = true;

    async function refreshJoinedNurseAccess(
      reason: "shift_changed" | "access_changed",
    ) {
      console.info(
        `[Realtime] Joined nurse view for shift ${subscribedShiftId} changed; refreshing nurse-scoped view.`,
      );

      if (isCurrentSubscription) {
        await retryLoadJoinedNurseAccess(reason);
      }
    }

    setJoinedNurseRealtimeConnectionState("connecting");
    console.info(
      `[Realtime] Starting joined nurse listener for shift ${subscribedShiftId}.`,
    );

    const stopSubscription = subscribeToJoinedNurseAssignmentView({
      accessId: subscribedAccessId,
      onConnectionStateChange: (connectionState, error) => {
        setJoinedNurseRealtimeConnectionState(connectionState);

        if (error) {
          console.error(
            `[Realtime] Joined nurse listener ${connectionState}.`,
            error,
          );
          return;
        }

        console.info(`[Realtime] Joined nurse listener ${connectionState}.`);
      },
      onNurseAccessChanged: () => {
        void refreshJoinedNurseAccess("access_changed");
      },
      onShiftChanged: () => {
        void refreshJoinedNurseAccess("shift_changed");
      },
      shiftId: subscribedShiftId,
      supabase,
    });

    return () => {
      isCurrentSubscription = false;
      console.info(
        `[Realtime] Stopping joined nurse listener for shift ${subscribedShiftId}.`,
      );
      stopSubscription();
      setJoinedNurseRealtimeConnectionState("disconnected");
    };
  }, [
    joinedNurseAccessId,
    joinedNurseProfileId,
    joinedNurseShiftId,
    retryLoadJoinedNurseAccess,
    store,
  ]);

  return (
    <ServerWorkspaceContext.Provider value={store}>
      {children}
    </ServerWorkspaceContext.Provider>
  );
}

export function useServerWorkspace<T>(
  selector: (state: ServerWorkspaceStore) => T,
) {
  const store = useContext(ServerWorkspaceContext);

  if (!store) {
    throw new Error(
      "useServerWorkspace must be used inside ServerWorkspaceProvider.",
    );
  }

  return useStore(store, selector);
}
