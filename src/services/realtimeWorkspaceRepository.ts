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
