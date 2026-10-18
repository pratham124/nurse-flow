import assert from "node:assert/strict";
import { AxiosError } from "axios";
import test, { afterEach, mock } from "node:test";

import {
  loadFloorTemplates,
  mapTemplateRow,
} from "../src/services/floorTemplateRepository.ts";
import { goApiClient } from "../src/services/goApiClient.ts";

afterEach(() => mock.restoreAll());

const profileId = "profile-charge";
const row = {
  id: "floor-current",
  owner_profile_id: profileId,
  name: "Current name",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-17T12:00:00.123456Z",
  template_snapshot: {
    id: "stale-id",
    name: "Stale name",
    doctorSides: [{ id: "side-1", extra: true }],
    rooms: [{ id: "room-1", number: "101" }],
    beds: [{ id: "bed-1", extra: "kept" }],
    futureField: "discarded",
  },
};

function client(session = { access_token: "current-token" }, error = null) {
  return {
    auth: { async getSession() { return { data: { session }, error }; } },
    from() { assert.fail("template loading must not fall back to Supabase"); },
  };
}

function respondWith(body, status = 200) {
  const implementation = async () => {
    const response = { data: body, status };
    if (status < 200 || status >= 300) {
      throw new AxiosError("private HTTP detail", "ERR_BAD_RESPONSE", undefined, undefined, response);
    }
    return response;
  };
  if (goApiClient.get.mock) {
    goApiClient.get.mock.mockImplementation(implementation);
  } else {
    mock.method(goApiClient, "get", implementation);
  }
}

async function loadResponse(body, status = 200) {
  respondWith(body, status);
  return loadFloorTemplates(client(), profileId);
}

test("uses the current token on every relative endpoint request", async () => {
  let token = "token-first";
  let captured;
  const supabase = client();
  supabase.auth.getSession = async () => ({
    data: { session: { access_token: token } }, error: null,
  });
  mock.method(goApiClient, "get", async (path, config) => {
    captured = { path, config };
    return { data: { templates: [row] }, status: 200 };
  });
  const result = await loadFloorTemplates(supabase, profileId);
  assert.equal(captured.path, "/floor-templates");
  assert.deepEqual(captured.config, {
    headers: { Authorization: "Bearer token-first" },
  });
  assert.deepEqual(result, [mapTemplateRow(row)]);
  token = "token-refreshed";
  await loadFloorTemplates(supabase, profileId);
  assert.equal(captured.config.headers.Authorization, "Bearer token-refreshed");
  assert.equal(goApiClient.defaults.headers.common.Authorization, undefined);
});

test("keeps row names, timestamps, server ordering, and the existing snapshot mapping", async () => {
  const second = { ...row, id: "floor-second", updated_at: "2026-10-16T00:00:00Z" };
  const result = await loadResponse({ templates: [row, second] });
  assert.deepEqual(result.map((template) => template.id), [row.id, second.id]);
  assert.equal(result[0].updatedAt, row.updated_at);
  assert.equal(result[0].createdAt, row.created_at);
  assert.deepEqual(result[0].templateSnapshot, {
    id: row.id,
    name: row.name,
    beds: row.template_snapshot.beds,
    doctorSides: row.template_snapshot.doctorSides,
    rooms: row.template_snapshot.rooms,
  });
  assert.notEqual(result[0].templateSnapshot.beds[0], row.template_snapshot.beds[0]);
  assert.equal(result[0].templateSnapshot.beds[0].extra, "kept");
  assert.equal("futureField" in result[0].templateSnapshot, false);
  assert.equal(mapTemplateRow({
    ...row, template_snapshot: { beds: [{ extra: 1 }], rooms: [], doctorSides: [] },
  }).templateSnapshot.beds[0].extra, 1);
});

test("empty lists preserve the existing empty-state input", async () => {
  assert.deepEqual(await loadResponse({ templates: [] }), []);
});

test("one malformed snapshot or wrong owner rejects the whole list", async () => {
  for (const badSnapshot of [null, {}, { beds: [], rooms: [], doctorSides: "invalid" }]) {
    await assert.rejects(loadResponse({
      templates: [row, { ...row, template_snapshot: badSnapshot }],
    }), /invalid server shape/);
  }
  await assert.rejects(loadResponse({
    templates: [row, { ...row, owner_profile_id: "other-profile" }],
  }), /wrong account/);
});

test("rejects malformed envelopes and row fields instead of silently dropping data", async () => {
  for (const body of [
    null, [], {}, { templates: null }, { templates: {} }, { templates: [null] },
    { templates: [row, { ...row, owner_profile_id: 42 }] },
    { templates: [{ ...row, created_at: null }] },
    { templates: [{ ...row, id: undefined }] },
    "<html>bad gateway</html>",
  ]) {
    await assert.rejects(loadResponse(body), /invalid response/);
  }
  await assert.rejects(loadResponse({ templates: [] }, 202), /invalid response/);
});

test("authentication, authorization, database, and unexpected HTTP failures are controlled", async () => {
  for (const [status, message] of [
    [401, /session expired/],
    [403, /cannot load charge nurse/],
    [503, /temporarily unavailable/],
    [500, /could not load floor templates/],
    [404, /could not load floor templates/],
  ]) {
    await assert.rejects(loadResponse({
      error: { message: "private database detail" }, templates: [row],
    }, status), (error) => message.test(error.message) && !error.message.includes("private"));
  }
});

test("missing session and failed session lookup never send an API request", async () => {
  mock.method(goApiClient, "get", () => assert.fail("unauthenticated request sent"));
  await assert.rejects(loadFloorTemplates(client(null), profileId), /Sign in before/);
  await assert.rejects(
    loadFloorTemplates(client(null, new Error("private auth detail")), profileId),
    /session could not be loaded/,
  );
});

test("network errors remain controlled", async () => {
  mock.method(goApiClient, "get", async () => {
    throw new AxiosError("private network detail", "ERR_NETWORK");
  });
  await assert.rejects(loadFloorTemplates(client(), profileId), /Could not reach the template service/);
});

test("Axios timeout errors retain the existing timeout message", async () => {
  for (const code of ["ETIMEDOUT", "ECONNABORTED"]) {
    const implementation = async () => { throw new AxiosError("private detail", code); };
    if (goApiClient.get.mock) goApiClient.get.mock.mockImplementation(implementation);
    else mock.method(goApiClient, "get", implementation);
    await assert.rejects(loadFloorTemplates(client(), profileId), /took too long/);
  }
});

test("all six row fields are required, including the unknown snapshot field", async () => {
  for (const field of Object.keys(row)) {
    const incompleteRow = { ...row };
    delete incompleteRow[field];
    await assert.rejects(
      loadResponse({ templates: [row, incompleteRow] }),
      (error) => error.message === "The template service returned an invalid response.",
    );
  }
});

test("extra response and row fields retain the existing mapped result", async () => {
  const result = await loadResponse({
    templates: [{ ...row, future_row_field: { extra: true } }],
    future_envelope_field: "ignored",
  });
  assert.deepEqual(result, [mapTemplateRow(row)]);
});
