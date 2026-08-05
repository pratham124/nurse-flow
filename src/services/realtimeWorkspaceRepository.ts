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

type RequestThreadSubscriptionOptions = {
  onConnectionStateChange: (
    connectionState: RealtimeConnectionState,
    error?: Error,
  ) => void;
  onMessageChanged: () => void;
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

function subscribeToPrivateBroadcastChannels({
  channels: channelDefinitions,
  onConnectionStateChange,
  supabase,
}: PrivateBroadcastSubscriptionOptions) {
  let isActive = true;
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
    supabase,
  });
}

export function subscribeToJoinedNurseAssignmentView({
  accessId,
  onConnectionStateChange,
  onNurseAccessChanged,
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
    supabase,
  });
}

export function subscribeToRequestThread({
  onConnectionStateChange,
  onMessageChanged,
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
    supabase,
  });
}
