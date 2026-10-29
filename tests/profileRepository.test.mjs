import assert from "node:assert/strict";
import { AxiosError } from "axios";
import test, { afterEach, mock } from "node:test";

import { goApiClient } from "../src/services/goApiClient.ts";
import {
  loadOrCreateUserProfile,
  loadUserProfile,
} from "../src/services/profileRepository.ts";

afterEach(() => mock.restoreAll());

const row = {
  id: "profile-1",
  auth_user_id: "auth-1",
  display_name: "Charge Nurse",
  role: "charge_nurse",
  created_at: "2026-10-24T10:00:00Z",
  updated_at: "2026-10-24T10:00:00Z",
};

function failWith(method, status, data) {
  mock.method(goApiClient, method, async () => {
    throw new AxiosError("failed", "ERR_BAD_RESPONSE", {}, {}, { status, data });
  });
}

test("GET /profile maps the profile row with the bearer token", async () => {
  mock.method(goApiClient, "get", async (url, config) => {
    assert.equal(url, "/profile");
    assert.deepEqual(config.headers, { Authorization: "Bearer token-1" });
    return { status: 200, data: { profile: row } };
  });
  assert.deepEqual(await loadUserProfile("token-1"), {
    authUserId: "auth-1",
    createdAt: row.created_at,
    displayName: "Charge Nurse",
    id: "profile-1",
    role: "charge_nurse",
    updatedAt: row.updated_at,
  });
});

test("404 profile_missing becomes undefined so recovery state still works", async () => {
  failWith("get", 404, { error: { code: "profile_missing", message: "No profile." } });
  assert.equal(await loadUserProfile("token-1"), undefined);
});

test("other GET failures surface the server message or a session message", async () => {
  failWith("get", 503, { error: { code: "database_unavailable", message: "Database is unavailable." } });
  await assert.rejects(loadUserProfile("token-1"), /Database is unavailable/);
  mock.restoreAll();
  failWith("get", 401, { error: { code: "unauthorized", message: "bad token" } });
  await assert.rejects(loadUserProfile("token-1"), /session expired/);
  mock.restoreAll();
  failWith("get", 404, { error: { code: "route_missing", message: "Nope." } });
  await assert.rejects(loadUserProfile("token-1"), /Nope/);
});

test("rejects unsupported roles and malformed bodies", async () => {
  mock.method(goApiClient, "get", async () => ({
    status: 200,
    data: { profile: { ...row, role: "regular_nurse" } },
  }));
  await assert.rejects(loadUserProfile("t"), /unsupported role/);
  mock.restoreAll();
  mock.method(goApiClient, "get", async () => ({ status: 200, data: { profile: { id: 1 } } }));
  await assert.rejects(loadUserProfile("t"), /invalid response/);
});

test("PUT /profile sends no body and returns the profile", async () => {
  mock.method(goApiClient, "put", async (url, body, config) => {
    assert.equal(url, "/profile");
    assert.equal(body, undefined);
    assert.equal(config.headers.Authorization, "Bearer token-2");
    return { status: 200, data: { profile: row } };
  });
  assert.equal((await loadOrCreateUserProfile("token-2")).id, "profile-1");
});

test("PUT /profile rejects unsupported roles and surfaces errors", async () => {
  mock.method(goApiClient, "put", async () => ({
    status: 200,
    data: { profile: { ...row, role: "admin" } },
  }));
  await assert.rejects(loadOrCreateUserProfile("t"), /unsupported role/);
  mock.restoreAll();
  failWith("put", 503, { error: { code: "database_unavailable", message: "Database is unavailable." } });
  await assert.rejects(loadOrCreateUserProfile("t"), /Database is unavailable/);
});
