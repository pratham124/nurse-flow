import assert from "node:assert/strict";
import { AxiosError } from "axios";
import test, { afterEach, mock } from "node:test";

import {
  loadFloorTemplates,
  saveFloorTemplate,
  deleteFloorTemplate,
} from "../src/services/floorTemplateRepository.ts";
import { goApiClient } from "../src/services/goApiClient.ts";

afterEach(() => mock.restoreAll());

const savedID = "30000000-0000-4000-8000-000000000001";
const layout = {
  id: "floor-local", name: " Floor ",
  doctorSides: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
  rooms: [{ id: "room", doctorSideId: "a", label: "101", bedCount: 1 }],
  beds: [{ id: "bed", roomId: "room", label: "101-1", bedNumber: 1 }],
};

test("creates through Go with reusable fields and trusts the returned saved ID/name", async () => {
  const savedRow = { ...row, id: savedID };
  mock.method(goApiClient, "request", async (config) => {
    assert.equal(config.method, "POST");
    assert.equal(config.url, "/floor-templates");
    assert.deepEqual(config.data, { template_snapshot: { ...layout, name: "Floor" } });
    assert.deepEqual(config.headers, { Authorization: "Bearer current-token" });
    return { status: 201, data: { template: savedRow } };
  });
  const result = await saveFloorTemplate(client(), profileId, {
    ...layout,
    patients: ["must not send"],
    doctorSides: layout.doctorSides.map((side) => ({ ...side, extra: true })),
    rooms: layout.rooms.map((room) => ({ ...room, extra: true })),
    beds: layout.beds.map((bed) => ({ ...bed, extra: true })),
  });
  assert.deepEqual(result, {
    ...expectedTemplate,
    id: savedID,
    templateSnapshot: { ...expectedTemplate.templateSnapshot, id: savedID },
  });
});

test("updates saved UUIDs through PUT without owner/timestamps and validates saved identity", async () => {
  const savedLayout = { ...layout, id: savedID };
  mock.method(goApiClient, "request", async (config) => {
    assert.equal(config.method, "PUT");
    assert.equal(config.url, `/floor-templates/${savedID}`);
    assert.deepEqual(config.data, { template_snapshot: { ...savedLayout, name: "Floor" } });
    assert.equal(config.headers.Authorization, "Bearer current-token");
    return { status: 200, data: { template: { ...row, id: savedID } } };
  });
  assert.equal((await saveFloorTemplate(client(), profileId, savedLayout)).id, savedID);
});

test("rejects malformed save responses, wrong status, wrong owner, and wrong update ID", async () => {
  for (const response of [
    { status: 200, data: { template: { ...row, id: savedID } } },
    { status: 201, data: {} },
    { status: 201, data: { template: { ...row, id: "not-a-uuid" } } },
    { status: 201, data: { template: { ...row, id: savedID, owner_profile_id: "other" } } },
    { status: 201, data: { template: { ...row, id: savedID, template_snapshot: null } } },
  ]) {
    mock.method(goApiClient, "request", async () => response);
    await assert.rejects(saveFloorTemplate(client(), profileId, layout));
    mock.restoreAll();
  }
  mock.method(goApiClient, "request", async () => ({ status: 200, data: { template: { ...row, id: "40000000-0000-4000-8000-000000000001" } } }));
  await assert.rejects(saveFloorTemplate(client(), profileId, { ...layout, id: savedID }), /wrong account or template/);
});

test("save/delete use fresh session tokens and never send after session failure", async () => {
  mock.method(goApiClient, "request", async () => assert.fail("no token must not create"));
  mock.method(goApiClient, "delete", async () => assert.fail("no token must not delete"));
  for (const supabase of [client(null), client(null, new Error("private session"))]) {
    await assert.rejects(saveFloorTemplate(supabase, profileId, layout), /Sign in|session/);
    await assert.rejects(deleteFloorTemplate(supabase, savedID), /Sign in|session/);
  }
});

test("delete uses authenticated Go DELETE, requires saved ID and 204 success", async () => {
  let calls = 0;
  mock.method(goApiClient, "delete", async (path, config) => {
    calls++;
    assert.equal(path, `/floor-templates/${savedID}`);
    assert.equal(config.headers.Authorization, "Bearer current-token");
    return { status: 204, data: "" };
  });
  await deleteFloorTemplate(client(), savedID);
  await assert.rejects(deleteFloorTemplate(client(), "local-floor"), /Only saved/);
  assert.equal(calls, 1);
  goApiClient.delete.mock.mockImplementation(async () => ({ status: 200, data: {} }));
  await assert.rejects(deleteFloorTemplate(client(), savedID), /invalid response/);
});

test("write errors are visible and do not expose server details or fall back", async () => {
  for (const [status, message] of [[400, /incomplete or inconsistent/], [401, /session expired/], [403, /cannot save/], [404, /no longer available/], [413, /too large/], [503, /temporarily unavailable/], [500, /could not save/]]) {
    mock.method(goApiClient, "request", async () => { throw new AxiosError("private", "ERR_BAD_RESPONSE", undefined, undefined, { status, data: { error: { message: "SQL password" } } }); });
    await assert.rejects(saveFloorTemplate(client(), profileId, layout), message);
    mock.restoreAll();
  }
  mock.method(goApiClient, "delete", async () => { throw new AxiosError("private", "ERR_BAD_RESPONSE", undefined, undefined, { status: 404 }); });
  await assert.rejects(deleteFloorTemplate(client(), savedID), /no longer available/);
});

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
    doctorSides: [{ id: "side-1", name: "East", extra: true }],
    rooms: [{ id: "room-1", doctorSideId: "side-1", label: "101", bedCount: 1, number: "101" }],
    beds: [{ id: "bed-1", roomId: "room-1", label: "101-1", bedNumber: 1, extra: "kept" }],
    futureField: "discarded",
  },
};

const expectedTemplate = {
  id: "floor-current",
  ownerProfileId: profileId,
  name: "Current name",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-17T12:00:00.123456Z",
  templateSnapshot: {
    id: "floor-current",
    name: "Current name",
    doctorSides: row.template_snapshot.doctorSides,
    rooms: row.template_snapshot.rooms,
    beds: row.template_snapshot.beds,
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
  assert.deepEqual(result, [expectedTemplate]);
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
  const [withExtra] = await loadResponse({ templates: [{
    ...row,
    template_snapshot: {
      beds: [{ ...row.template_snapshot.beds[0], extra: 1 }],
      rooms: [],
      doctorSides: [],
    },
  }] });
  assert.equal(withExtra.templateSnapshot.beds[0].extra, 1);
});

test("empty lists preserve the existing empty-state input", async () => {
  assert.deepEqual(await loadResponse({ templates: [] }), []);
});

test("one malformed snapshot or wrong owner rejects the whole list", async () => {
  for (const badSnapshot of [null, {}, { beds: [], rooms: [], doctorSides: "invalid" }]) {
    await assert.rejects(loadResponse({
      templates: [row, { ...row, template_snapshot: badSnapshot }],
    }), /invalid response/);
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

test("all six row fields are required, including the typed snapshot field", async () => {
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
  assert.deepEqual(result, [expectedTemplate]);
});

test("row identity and name remain authoritative when snapshot metadata is missing", async () => {
  const { id, name, ...snapshot } = row.template_snapshot;
  const [template] = await loadResponse({ templates: [{ ...row, template_snapshot: snapshot }] });
  assert.equal(template.templateSnapshot.id, row.id);
  assert.equal(template.templateSnapshot.name, row.name);
});

test("Zod rejects malformed nested layout fields in both list and save responses", async () => {
  const invalidSnapshots = [];
  for (const collection of ["doctorSides", "rooms", "beds"]) {
    for (const field of Object.keys(layout[collection][0])) {
      const missing = structuredClone(row.template_snapshot);
      delete missing[collection][0][field];
      invalidSnapshots.push(missing);
      const wrongType = structuredClone(row.template_snapshot);
      wrongType[collection][0][field] =
        typeof layout[collection][0][field] === "number" ? "1" : 42;
      invalidSnapshots.push(wrongType);
    }
    for (const element of [null, "invalid", []]) {
      invalidSnapshots.push({ ...row.template_snapshot, [collection]: [element] });
    }
  }
  for (const snapshot of invalidSnapshots) {
    await assert.rejects(loadResponse({
      templates: [row, { ...row, template_snapshot: snapshot }],
    }), /^Error: The template service returned an invalid response\.$/);
    mock.method(goApiClient, "request", async () => ({
      status: 201,
      data: { template: { ...row, id: savedID, template_snapshot: snapshot } },
    }));
    await assert.rejects(saveFloorTemplate(client(), profileId, layout),
      /^Error: The template service returned an invalid response\.$/);
    mock.restoreAll();
  }
});

test("invalid snapshot fields fail before sending a save request", async () => {
  mock.method(goApiClient, "request", async () => assert.fail("invalid snapshot must not send"));
  await assert.rejects(saveFloorTemplate(client(), profileId, {
    ...layout,
    beds: [{ ...layout.beds[0], bedNumber: "1" }],
  }), /incomplete or inconsistent/);
});
