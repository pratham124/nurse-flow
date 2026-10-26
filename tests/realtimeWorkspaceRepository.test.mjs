import assert from "node:assert/strict";
import test from "node:test";

import {
  subscribeToChargeActiveShift,
  subscribeToJoinedNurseAssignmentView,
  subscribeToPrivateBroadcastChannels,
  subscribeToRequestThread,
} from "../src/services/realtimeWorkspaceRepository.ts";

test("scopes a private request broadcast and removes it when the screen leaves", async () => {
  const removedChannels = [];
  const connectionStates = [];
  const registrations = [];
  let channelOptions;
  let messageChangeCount = 0;
  let realtimeAuthCount = 0;
  let statusListener;

  const staleChannel = {
    topic: "realtime:nurseflow:request-thread:shift-1:request-1",
  };
  const unrelatedChannel = {
    topic: "realtime:nurseflow:request-thread:shift-2:request-2",
  };
  const channel = {
    topic: "",
    on(event, filter, listener) {
      registrations.push({ event, filter, listener });
      return this;
    },
    subscribe(listener) {
      statusListener = listener;
      return this;
    },
  };
  const supabase = {
    channel(topic, options) {
      channel.topic = `realtime:${topic}`;
      channelOptions = options;
      return channel;
    },
    getChannels() {
      return [staleChannel, unrelatedChannel];
    },
    removeChannel(channelToRemove) {
      removedChannels.push(channelToRemove);
      return Promise.resolve("ok");
    },
    realtime: {
      setAuth() {
        realtimeAuthCount += 1;
        return Promise.resolve();
      },
    },
  };

  const stop = subscribeToRequestThread({
    onConnectionStateChange(connectionState) {
      connectionStates.push(connectionState);
    },
    onMessageChanged() {
      messageChangeCount += 1;
    },
    requestId: "request-1",
    shiftId: "shift-1",
    supabase,
  });

  await Promise.resolve();

  assert.equal(realtimeAuthCount, 1);
  assert.deepEqual(channelOptions, { config: { private: true } });
  assert.equal(
    channel.topic,
    "realtime:nurseflow:request-thread:shift-1:request-1",
  );
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].event, "broadcast");
  assert.deepEqual(registrations[0].filter, {
    event: "request-message-inserted",
  });
  assert.deepEqual(removedChannels, [staleChannel]);

  statusListener("SUBSCRIBED");
  registrations[0].listener();

  assert.deepEqual(connectionStates, ["live"]);
  assert.equal(messageChangeCount, 1);

  stop();
  statusListener("CHANNEL_ERROR", new Error("late callback"));
  registrations[0].listener();

  assert.deepEqual(connectionStates, ["live"]);
  assert.equal(messageChangeCount, 1);
  assert.deepEqual(removedChannels, [staleChannel, channel]);
});

function createFakeSupabase() {
  const statusListeners = [];

  const supabase = {
    channel() {
      const channel = {
        on() {
          return channel;
        },
        subscribe(listener) {
          statusListeners.push(listener);
          return channel;
        },
      };

      return channel;
    },
    getChannels() {
      return [];
    },
    removeChannel() {
      return Promise.resolve("ok");
    },
    realtime: {
      setAuth() {
        return Promise.resolve();
      },
    },
  };

  return { statusListeners, supabase };
}

async function startChargeSubscription() {
  const { statusListeners, supabase } = createFakeSupabase();
  const counts = { reconnected: 0 };
  const stop = subscribeToChargeActiveShift({
    activeShiftId: "shift-1",
    onConnectionStateChange() {},
    onReconnected() {
      counts.reconnected += 1;
    },
    onShiftChanged() {},
    supabase,
  });

  await Promise.resolve();

  return { counts, statusListener: statusListeners[0], stop };
}

test("does not report a reconnect the first time a subscription goes live", async () => {
  const { counts, statusListener } = await startChargeSubscription();

  statusListener("SUBSCRIBED");
  statusListener("SUBSCRIBED");

  assert.equal(counts.reconnected, 0);
});

test("reports one reconnect when a live subscription drops and recovers", async () => {
  for (const droppedStatus of ["TIMED_OUT", "CHANNEL_ERROR", "CLOSED"]) {
    const { counts, statusListener } = await startChargeSubscription();

    statusListener("SUBSCRIBED");
    statusListener(droppedStatus);
    assert.equal(counts.reconnected, 0);

    statusListener("SUBSCRIBED");
    statusListener("SUBSCRIBED");
    assert.equal(counts.reconnected, 1, droppedStatus);
  }
});

test("reports one reconnect per recovery after repeated drops", async () => {
  const { counts, statusListener } = await startChargeSubscription();

  statusListener("SUBSCRIBED");
  statusListener("CLOSED");
  statusListener("TIMED_OUT");
  statusListener("SUBSCRIBED");
  statusListener("CHANNEL_ERROR");
  statusListener("SUBSCRIBED");

  assert.equal(counts.reconnected, 2);
});

test("does not count a drop before the first live as a reconnect", async () => {
  const { counts, statusListener } = await startChargeSubscription();

  statusListener("CHANNEL_ERROR");
  statusListener("SUBSCRIBED");

  assert.equal(counts.reconnected, 0);
});

test("tracks reconnects separately for each subscription instance", async () => {
  const first = await startChargeSubscription();

  first.statusListener("SUBSCRIBED");
  first.statusListener("CLOSED");
  first.stop();

  const second = await startChargeSubscription();

  second.statusListener("SUBSCRIBED");

  assert.equal(second.counts.reconnected, 0);
});

test("waits for every channel before reporting a reconnect", async () => {
  const { statusListeners, supabase } = createFakeSupabase();
  let reconnectedCount = 0;

  subscribeToPrivateBroadcastChannels({
    channels: [
      { listeners: [], topic: "topic-a" },
      { listeners: [], topic: "topic-b" },
    ],
    onConnectionStateChange() {},
    onReconnected() {
      reconnectedCount += 1;
    },
    supabase,
  });
  await Promise.resolve();

  const [statusA, statusB] = statusListeners;

  statusA("SUBSCRIBED");
  statusB("SUBSCRIBED");
  statusB("TIMED_OUT");
  statusA("CLOSED");
  statusB("SUBSCRIBED");
  assert.equal(reconnectedCount, 0);

  statusA("SUBSCRIBED");
  assert.equal(reconnectedCount, 1);
});

test("does not report a reconnect after the subscription is stopped", async () => {
  const { counts, statusListener, stop } = await startChargeSubscription();

  statusListener("SUBSCRIBED");
  statusListener("CLOSED");
  stop();
  statusListener("SUBSCRIBED");

  assert.equal(counts.reconnected, 0);
});

test("passes onReconnected through the joined nurse and request thread subscriptions", async () => {
  const joined = createFakeSupabase();
  const thread = createFakeSupabase();
  const reconnects = [];

  subscribeToJoinedNurseAssignmentView({
    accessId: "access-1",
    onConnectionStateChange() {},
    onNurseAccessChanged() {},
    onReconnected() {
      reconnects.push("joined");
    },
    onShiftChanged() {},
    shiftId: "shift-1",
    supabase: joined.supabase,
  });
  subscribeToRequestThread({
    onConnectionStateChange() {},
    onMessageChanged() {},
    onReconnected() {
      reconnects.push("thread");
    },
    requestId: "request-1",
    shiftId: "shift-1",
    supabase: thread.supabase,
  });
  await Promise.resolve();

  for (const fake of [joined, thread]) {
    fake.statusListeners[0]("SUBSCRIBED");
    fake.statusListeners[0]("CLOSED");
    fake.statusListeners[0]("SUBSCRIBED");
  }

  assert.deepEqual(reconnects, ["joined", "thread"]);
});
