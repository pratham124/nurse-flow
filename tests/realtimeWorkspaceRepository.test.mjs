import assert from "node:assert/strict";
import test from "node:test";

import { subscribeToRequestThread } from "../src/services/realtimeWorkspaceRepository.ts";

test("scopes a request listener and removes it when the screen leaves", () => {
  const removedChannels = [];
  const connectionStates = [];
  const registrations = [];
  let messageChangeCount = 0;
  let statusListener;

  const staleChannel = { topic: "realtime:request-thread:request-1:old" };
  const unrelatedChannel = { topic: "realtime:request-thread:request-2:open" };
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
    channel(topic) {
      channel.topic = `realtime:${topic}`;
      return channel;
    },
    getChannels() {
      return [staleChannel, unrelatedChannel];
    },
    removeChannel(channelToRemove) {
      removedChannels.push(channelToRemove);
      return Promise.resolve("ok");
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
    supabase,
  });

  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].event, "postgres_changes");
  assert.deepEqual(registrations[0].filter, {
    event: "INSERT",
    filter: "request_id=eq.request-1",
    schema: "public",
    table: "nurse_request_messages",
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
