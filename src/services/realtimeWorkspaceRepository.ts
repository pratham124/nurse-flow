import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import type { RealtimeConnectionState } from "../types/models";

type ChargeActiveShiftSubscriptionOptions = {
  activeShiftId: string;
  onConnectionStateChange: (
    connectionState: RealtimeConnectionState,
    error?: Error,
  ) => void;
  onReconnected?: () => void;
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
  onReconnected?: () => void;
  onShiftChanged: () => void;
  shiftId: string;
  supabase: SupabaseClient;
};

type RequestThreadSubscriptionOptions = {
  onConnectionStateChange: (
    connectionState: RealtimeConnectionState,
    error?: Error,
  ) => void;
  onMessageChanged: () => void;
  onReconnected?: () => void;
  requestId: string;
  shiftId: string;
  supabase: SupabaseClient;
};

type PrivateBroadcastListener = {
  event: string;
  onMessage: () => void;
};

type PrivateBroadcastChannel = {
  listeners: PrivateBroadcastListener[];
  topic: string;
};

type PrivateBroadcastSubscriptionOptions = {
  channels: PrivateBroadcastChannel[];
  onConnectionStateChange: (
    connectionState: RealtimeConnectionState,
    error?: Error,
  ) => void;
  // Called once each time the subscription is live again after it was live
  // and then dropped. Broadcasts sent while it was down are never delivered,
  // so the caller should refetch.
  onReconnected?: () => void;
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

function removeStaleChannels(supabase: SupabaseClient, topicPrefix: string) {
  const realtimeTopicPrefix = `realtime:${topicPrefix}`;

  supabase
    .getChannels()
    .filter((channel) => channel.topic.startsWith(realtimeTopicPrefix))
    .forEach((channel) => {
      void supabase.removeChannel(channel);
    });
}

export function subscribeToPrivateBroadcastChannels({
  channels: channelDefinitions,
  onConnectionStateChange,
  onReconnected,
  supabase,
}: PrivateBroadcastSubscriptionOptions) {
  let isActive = true;
  let hasBeenLive = false;
  let hasLeftLiveSinceBeingLive = false;
  const activeChannels: RealtimeChannel[] = [];
  const connectionStateByTopic = new Map<string, RealtimeConnectionState>(
    channelDefinitions.map((channelDefinition) => [
      channelDefinition.topic,
      "disconnected",
    ]),
  );

  function reportCombinedConnectionState(error?: Error) {
    const connectionStates = Array.from(connectionStateByTopic.values());
    let combinedConnectionState: RealtimeConnectionState = "disconnected";

    if (connectionStates.some((state) => state === "error")) {
      combinedConnectionState = "error";
    } else if (connectionStates.some((state) => state === "reconnecting")) {
      combinedConnectionState = "reconnecting";
    } else if (connectionStates.every((state) => state === "live")) {
      combinedConnectionState = "live";
    }

    onConnectionStateChange(combinedConnectionState, error);

    if (combinedConnectionState !== "live") {
      hasLeftLiveSinceBeingLive = hasBeenLive;
      return;
    }

    hasBeenLive = true;

    if (hasLeftLiveSinceBeingLive) {
      hasLeftLiveSinceBeingLive = false;
      onReconnected?.();
    }
  }

  void supabase.realtime
    .setAuth()
    .then(() => {
      if (!isActive) {
        return;
      }

      channelDefinitions.forEach((channelDefinition) => {
        removeStaleChannels(supabase, channelDefinition.topic);

        let channel = supabase.channel(channelDefinition.topic, {
          config: { private: true },
        });

        channelDefinition.listeners.forEach((listener) => {
          channel = channel.on(
            "broadcast",
            { event: listener.event },
            () => {
              if (isActive) {
                listener.onMessage();
              }
            },
          );
        });

        channel = channel.subscribe((status, error) => {
          if (!isActive) {
            return;
          }

          connectionStateByTopic.set(
            channelDefinition.topic,
            getConnectionState(status),
          );
          reportCombinedConnectionState(error);
        });

        activeChannels.push(channel);
      });
    })
    .catch((error: unknown) => {
      if (!isActive) {
        return;
      }

      const authError = error instanceof Error
        ? error
        : new Error("Realtime authorization failed.");

      onConnectionStateChange("error", authError);
    });

  return () => {
    isActive = false;
    activeChannels.forEach((channel) => {
      void supabase.removeChannel(channel);
    });
  };
}

export function subscribeToChargeActiveShift({
  activeShiftId,
  onConnectionStateChange,
  onReconnected,
  onShiftChanged,
  supabase,
}: ChargeActiveShiftSubscriptionOptions) {
  return subscribeToPrivateBroadcastChannels({
    channels: [
      {
        listeners: [
          { event: "active-shift-changed", onMessage: onShiftChanged },
        ],
        topic: `nurseflow:active-shift:${activeShiftId}`,
      },
    ],
    onConnectionStateChange,
    onReconnected,
    supabase,
  });
}

export function subscribeToJoinedNurseAssignmentView({
  accessId,
  onConnectionStateChange,
  onNurseAccessChanged,
  onReconnected,
  onShiftChanged,
  shiftId,
  supabase,
}: JoinedNurseAssignmentSubscriptionOptions) {
  return subscribeToPrivateBroadcastChannels({
    channels: [
      {
        listeners: [
          {
            event: "active-shift-changed",
            onMessage: onShiftChanged,
          },
          {
            event: "nurse-access-changed",
            onMessage: onNurseAccessChanged,
          },
        ],
        topic: `nurseflow:nurse-access:${shiftId}:${accessId}`,
      },
    ],
    onConnectionStateChange,
    onReconnected,
    supabase,
  });
}

export function subscribeToRequestThread({
  onConnectionStateChange,
  onMessageChanged,
  onReconnected,
  requestId,
  shiftId,
  supabase,
}: RequestThreadSubscriptionOptions) {
  return subscribeToPrivateBroadcastChannels({
    channels: [
      {
        listeners: [
          {
            event: "request-message-inserted",
            onMessage: onMessageChanged,
          },
        ],
        topic: `nurseflow:request-thread:${shiftId}:${requestId}`,
      },
    ],
    onConnectionStateChange,
    onReconnected,
    supabase,
  });
}
