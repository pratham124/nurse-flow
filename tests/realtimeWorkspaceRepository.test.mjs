import assert from "node:assert/strict";
import test from "node:test";

import { subscribeToRequestThread } from "../src/services/realtimeWorkspaceRepository.ts";

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
