import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import type { RealtimeConnectionState } from "../types/models";

type ChargeActiveShiftSubscriptionOptions = {
  activeShiftId: string;
  onConnectionStateChange: (
    connectionState: RealtimeConnectionState,
    error?: Error,
  ) => void;
  onShiftChanged: () => void;
  supabase: SupabaseClient;
};

type JoinedNurseAssignmentSubscriptionOptions = {
  accessId: string;
  onConnectionStateChange: (
    connectionState: RealtimeConnectionState,
    error?: Error,
  ) => void;
  onNurseAccessChanged: () => void;
  onShiftChanged: () => void;
  shiftId: string;
  supabase: SupabaseClient;
};

function getConnectionState(
  status: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR",
): RealtimeConnectionState {
  if (status === "SUBSCRIBED") {
    return "live";
  }

  if (status === "TIMED_OUT") {
    return "reconnecting";
  }

  if (status === "CHANNEL_ERROR") {
    return "error";
  }

  return "disconnected";
}

export function subscribeToChargeActiveShift({
  activeShiftId,
  onConnectionStateChange,
  onShiftChanged,
  supabase,
}: ChargeActiveShiftSubscriptionOptions) {
  let isActive = true;

  const channel: RealtimeChannel = supabase
    .channel(`charge-active-shift:${activeShiftId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        filter: `id=eq.${activeShiftId}`,
        schema: "public",
        table: "active_shifts",
      },
      () => {
        if (isActive) {
          onShiftChanged();
        }
      },
    )
    .subscribe((status, error) => {
      if (isActive) {
        onConnectionStateChange(getConnectionState(status), error);
      }
    });

  return () => {
    isActive = false;
    void supabase.removeChannel(channel);
  };
}

export function subscribeToJoinedNurseAssignmentView({
  accessId,
  onConnectionStateChange,
  onNurseAccessChanged,
  onShiftChanged,
  shiftId,
  supabase,
}: JoinedNurseAssignmentSubscriptionOptions) {
  let isActive = true;

  const channel: RealtimeChannel = supabase
    .channel(`joined-nurse-assignment:${shiftId}:${accessId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        filter: `id=eq.${shiftId}`,
        schema: "public",
        table: "active_shifts",
      },
      () => {
        if (isActive) {
          onShiftChanged();
        }
      },
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        filter: `id=eq.${accessId}`,
        schema: "public",
        table: "shift_nurse_access",
      },
      () => {
        if (isActive) {
          onNurseAccessChanged();
        }
      },
    )
    .subscribe((status, error) => {
      if (isActive) {
        onConnectionStateChange(getConnectionState(status), error);
      }
    });

  return () => {
    isActive = false;
    void supabase.removeChannel(channel);
  };
}
