import assert from "node:assert/strict";
import { AxiosError } from "axios";
import test, { afterEach, mock } from "node:test";

import { goApiClient } from "../src/services/goApiClient.ts";
import {
  appendRequestMessage,
  listRequestMessages,
} from "../src/services/requestMessageRepository.ts";

afterEach(() => mock.restoreAll());

const thread = { requestId: "nurse-request-abc", shiftId: "shift-1" };
const message = {
  id: "m1", shiftId: "shift-1", requestId: "nurse-request-abc",
  authorProfileId: "p1", body: "Hello", createdAt: "2026-10-24T10:00:00Z",
  clientMutationId: null,
};

function client() {
  return {
    auth: { async getSession() { return { data: { session: { access_token: "tok" } }, error: null }; } },
    rpc() { assert.fail("threads must not fall back to Supabase RPC"); },
  };
}

function fail(method, status, data) {
  mock.method(goApiClient, method, async () => {
    throw new AxiosError("failed", "ERR_BAD_RESPONSE", {}, {}, { status, data });
  });
}

test("lists messages with a GET and maps null mutation ids to undefined", async () => {
  mock.method(goApiClient, "get", async (url, config) => {
    assert.equal(url, "/shifts/shift-1/requests/nurse-request-abc/messages");
    assert.equal(config.headers.Authorization, "Bearer tok");
    return { status: 200, data: { messages: [message, { ...message, id: "m2", clientMutationId: "c" }] } };
  });
  const result = await listRequestMessages(client(), thread);
  assert.equal(result.length, 2);
  assert.equal(result[0].clientMutationId, undefined);
  assert.equal(result[1].clientMutationId, "c");
});

test("URL-encodes path segments", async () => {
  mock.method(goApiClient, "get", async (url) => {
    assert.equal(url, "/shifts/a%2Fb/requests/c%20d/messages");
    return { status: 200, data: { messages: [] } };
  });
  assert.deepEqual(await listRequestMessages(client(), { requestId: " c d ", shiftId: "a/b" }), []);
});

test("rejects invalid list shapes and keeps input validation", async () => {
  for (const data of [{}, { messages: [{ ...message, body: "" }] }, { messages: [{ ...message, id: undefined }] }]) {
    mock.restoreAll();
    mock.method(goApiClient, "get", async () => ({ status: 200, data }));
    await assert.rejects(listRequestMessages(client(), thread), /invalid server shape/);
  }
  await assert.rejects(listRequestMessages(client(), { requestId: " ", shiftId: "s" }), /Choose a nurse request/);
});

test("appends a trimmed body and parses saved and duplicate results", async () => {
  for (const [status, httpStatus] of [["saved", 201], ["duplicate", 200]]) {
    mock.restoreAll();
    mock.method(goApiClient, "post", async (url, body, config) => {
      assert.equal(url, "/shifts/shift-1/requests/nurse-request-abc/messages");
      assert.deepEqual(body, { body: "Hello", client_mutation_id: "c1" });
      assert.equal(config.headers.Authorization, "Bearer tok");
      return { status: httpStatus, data: { status, message } };
    });
    const result = await appendRequestMessage(client(), { ...thread, body: " Hello ", clientMutationId: " c1 " });
    assert.equal(result.status, status);
    assert.equal(result.message.id, "m1");
  }
});

test("omits the mutation id when absent and validates locally", async () => {
  mock.method(goApiClient, "post", async (_url, body) => {
    assert.deepEqual(body, { body: "Hi" });
    return { status: 201, data: { status: "saved", message } };
  });
  await appendRequestMessage(client(), { ...thread, body: "Hi" });
  await assert.rejects(appendRequestMessage(client(), { ...thread, body: " " }), /Write a message/);
  await assert.rejects(appendRequestMessage(client(), { ...thread, body: "x".repeat(1001) }), /1000 characters/);
  await assert.rejects(appendRequestMessage(client(), { ...thread, body: "x", clientMutationId: "y".repeat(121) }), /120 characters/);
});

test("surfaces server messages, session expiry, and invalid results", async () => {
  fail("post", 409, { error: { code: "mutation_id_reused", message: "That message retry identifier was already used." } });
  await assert.rejects(appendRequestMessage(client(), { ...thread, body: "x" }), /already used/);
  mock.restoreAll();
  fail("get", 401, { error: { code: "unauthorized", message: "no" } });
  await assert.rejects(listRequestMessages(client(), thread), /session expired/);
  mock.restoreAll();
  fail("get", 404, { error: { code: "thread_not_found", message: "You do not have access to this request thread." } });
  await assert.rejects(listRequestMessages(client(), thread), /do not have access/);
  mock.restoreAll();
  mock.method(goApiClient, "post", async () => ({ status: 201, data: { status: "weird", message } }));
  await assert.rejects(appendRequestMessage(client(), { ...thread, body: "x" }), /invalid server result/);
  mock.restoreAll();
  mock.method(goApiClient, "post", async () => ({ status: 201, data: { status: "saved", message: { ...message, createdAt: "" } } }));
  await assert.rejects(appendRequestMessage(client(), { ...thread, body: "x" }), /invalid server result/);
});

test("reports a missing network connection", async () => {
  mock.method(goApiClient, "get", async () => { throw new AxiosError("down", "ERR_NETWORK"); });
  await assert.rejects(listRequestMessages(client(), thread), /Could not reach/);
});
