import assert from "node:assert/strict";
import { AxiosError } from "axios";
import test, { afterEach, mock } from "node:test";

import { goApiClient } from "../src/services/goApiClient.ts";
import {
  acceptShiftNurseInviteCode,
  generateShiftNurseInviteCode,
  loadShiftNurseInvitesAndAccess,
  regenerateShiftNurseInviteCode,
  validateShiftNurseInviteCode,
} from "../src/services/shiftInviteRepository.ts";

afterEach(() => mock.restoreAll());

const shiftId = "30000000-0000-4000-8000-000000000001";
const profile = { id: "charge-1", role: "charge_nurse" };
const activeShift = { id: shiftId, chargeProfileId: "charge-1" };
const inviteRow = {
  id: "invite-1", shift_id: shiftId, nurse_id: "nurse-1",
  created_by_profile_id: "charge-1", status: "active",
  created_at: "2026-10-24T10:00:00Z", expires_at: "2099-10-25T10:00:00Z",
  used_at: null, used_by_profile_id: null, revoked_at: null,
};
const accessRow = {
  id: "access-1", shift_id: shiftId, nurse_id: "nurse-1", nurse_name: "Ada",
  nurse_profile_id: null, nurse_email: null, status: "pending_link",
  created_at: "2026-10-24T10:00:00Z", updated_at: "2026-10-24T10:00:00Z",
};

function client() {
  return {
    auth: { async getSession() { return { data: { session: { access_token: "tok" } }, error: null }; } },
    from() { assert.fail("invites must not fall back to Supabase tables"); },
    rpc() { assert.fail("invites must not fall back to Supabase RPC"); },
  };
}

function fail(method, status, data) {
  mock.method(goApiClient, method, async () => {
    throw new AxiosError("failed", "ERR_BAD_RESPONSE", {}, {}, { status, data });
  });
}

test("loads invites and access with one GET and maps rows without tokenHash", async () => {
  mock.method(goApiClient, "get", async (url, config) => {
    assert.equal(url, `/shifts/${shiftId}/invites`);
    assert.equal(config.headers.Authorization, "Bearer tok");
    return { status: 200, data: { invites: [inviteRow], access: [accessRow] } };
  });
  const { invites, access } = await loadShiftNurseInvitesAndAccess(client(), profile, activeShift);
  assert.equal(invites[0].id, "invite-1");
  assert.equal(invites[0].revokedAt, undefined);
  assert.equal("tokenHash" in invites[0], false);
  assert.equal(access[0].nurseProfileId, undefined);
  assert.equal(access[0].status, "pending_link");
});

test("rejects malformed lists and unsupported statuses", async () => {
  mock.method(goApiClient, "get", async () => ({ status: 200, data: { invites: [{ ...inviteRow, status: "weird" }], access: [] } }));
  await assert.rejects(loadShiftNurseInvitesAndAccess(client(), profile, activeShift), /invalid response/);
  mock.restoreAll();
  mock.method(goApiClient, "get", async () => ({ status: 200, data: { invites: [] } }));
  await assert.rejects(loadShiftNurseInvitesAndAccess(client(), profile, activeShift), /invalid response/);
});

test("client guards still stop foreign or ended shifts before any request", async () => {
  mock.method(goApiClient, "get", async () => assert.fail("no request expected"));
  await assert.rejects(loadShiftNurseInvitesAndAccess(client(), profile, { ...activeShift, chargeProfileId: "other" }), /own active shift/);
  await assert.rejects(loadShiftNurseInvitesAndAccess(client(), profile, { ...activeShift, endedAt: "x" }), /active shift/);
});

test("generate and regenerate POST the nurse id and return code plus invite", async () => {
  for (const [fn, path] of [
    [generateShiftNurseInviteCode, "invites"],
    [regenerateShiftNurseInviteCode, "invites/regenerate"],
  ]) {
    mock.method(goApiClient, "post", async (url, body, config) => {
      assert.equal(url, `/shifts/${shiftId}/${path}`);
      assert.deepEqual(body, { nurse_id: "nurse-1" });
      assert.equal(config.headers.Authorization, "Bearer tok");
      return { status: 201, data: { code: "K7QX2M", invite: inviteRow } };
    });
    const result = await fn(client(), profile, { activeShift, nurseId: "nurse-1" });
    assert.equal(result.code, "K7QX2M");
    assert.equal(result.invite.nurseId, "nurse-1");
    assert.equal("tokenHash" in result.invite, false);
    mock.restoreAll();
  }
});

test("surfaces server error messages such as 409 invite_exists", async () => {
  fail("post", 409, { error: { code: "invite_exists", message: "This nurse already has an active invite for this shift." } });
  await assert.rejects(
    generateShiftNurseInviteCode(client(), profile, { activeShift, nurseId: "nurse-1" }),
    /already has an active invite/,
  );
  mock.restoreAll();
  fail("post", 422, { error: { code: "nurse_unassigned", message: "Assign at least one patient to this nurse before generating a code." } });
  await assert.rejects(
    regenerateShiftNurseInviteCode(client(), profile, { activeShift, nurseId: "nurse-1" }),
    /Assign at least one patient/,
  );
});

test("rejects a response for a different nurse", async () => {
  mock.method(goApiClient, "post", async () => ({ status: 201, data: { code: "K7QX2M", invite: { ...inviteRow, nurse_id: "other" } } }));
  await assert.rejects(generateShiftNurseInviteCode(client(), profile, { activeShift, nurseId: "nurse-1" }), /invalid response/);
});

test("invalid format short-circuits without a request", async () => {
  mock.method(goApiClient, "post", async () => assert.fail("no request expected"));
  for (const fn of [validateShiftNurseInviteCode, acceptShiftNurseInviteCode]) {
    const result = await fn(client(), "ab");
    assert.deepEqual(result, { message: "That code needs 6 characters.", reason: "invalid_format", status: "blocked" });
  }
  assert.equal((await validateShiftNurseInviteCode(client(), "")).reason, "invalid_format");
  assert.match((await acceptShiftNurseInviteCode(client(), "ABCDE0")).message, /6 letters or numbers/);
});

test("validate sends the normalized code and maps a valid result", async () => {
  mock.method(goApiClient, "post", async (url, body) => {
    assert.equal(url, "/invites/validate");
    assert.deepEqual(body, { code: "K7QX2M" });
    return {
      status: 200,
      data: { status: "valid", invite_id: "i", shift_id: "s", nurse_id: "n", nurse_name: "Ada", floor_name: "4 West", expires_at: "2099-01-01T00:00:00Z" },
    };
  });
  assert.deepEqual(await validateShiftNurseInviteCode(client(), " k7q-x2m "), {
    expiresAt: "2099-01-01T00:00:00Z", floorName: "4 West", inviteId: "i",
    nurseId: "n", nurseName: "Ada", shiftId: "s", status: "valid",
  });
});

test("validate keeps the client-side expiry check", async () => {
  mock.method(goApiClient, "post", async () => ({
    status: 200,
    data: { status: "valid", invite_id: "i", shift_id: "s", nurse_id: "n", nurse_name: "Ada", floor_name: "F", expires_at: "2000-01-01T00:00:00Z" },
  }));
  const result = await validateShiftNurseInviteCode(client(), "K7QX2M");
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "expired");
});

const reasonMessages = {
  invalid_format: /6-character code/,
  not_found: /not valid/,
  expired: /expired/,
  revoked: /no longer active/,
  already_used: /already been used/,
  ended_shift: /shift has ended/,
  stale_nurse: /no longer on this shift/,
  participation_conflict: /already connected to another active shift/,
};

test("validate and accept map every blocked reason to its message", async () => {
  for (const [reason, pattern] of Object.entries(reasonMessages)) {
    for (const fn of [validateShiftNurseInviteCode, acceptShiftNurseInviteCode]) {
      mock.method(goApiClient, "post", async () => ({ status: 200, data: { status: "blocked", reason } }));
      const result = await fn(client(), "K7QX2M");
      assert.equal(result.status, "blocked");
      assert.equal(result.reason, reason);
      assert.match(result.message, pattern);
      mock.restoreAll();
    }
  }
});

test("accept maps the joined result and rejects unknown shapes", async () => {
  mock.method(goApiClient, "post", async (url, body) => {
    assert.equal(url, "/invites/accept");
    assert.deepEqual(body, { code: "K7QX2M" });
    return { status: 200, data: { status: "joined", access_id: "a", shift_id: "s", nurse_id: "n", nurse_name: "Ada", floor_name: "F" } };
  });
  assert.deepEqual(await acceptShiftNurseInviteCode(client(), "K7QX2M"), {
    accessId: "a", floorName: "F", nurseId: "n", nurseName: "Ada", shiftId: "s", status: "joined",
  });
  mock.restoreAll();
  mock.method(goApiClient, "post", async () => ({ status: 200, data: { status: "blocked", reason: "mystery" } }));
  await assert.rejects(acceptShiftNurseInviteCode(client(), "K7QX2M"), /invalid response/);
  mock.restoreAll();
  mock.method(goApiClient, "post", async () => ({ status: 200, data: { status: "joined" } }));
  await assert.rejects(acceptShiftNurseInviteCode(client(), "K7QX2M"), /invalid response/);
});

test("join request failures surface server messages and 401 text", async () => {
  fail("post", 503, { error: { code: "database_unavailable", message: "Database is unavailable." } });
  await assert.rejects(acceptShiftNurseInviteCode(client(), "K7QX2M"), /Database is unavailable/);
  mock.restoreAll();
  fail("post", 401, { error: { code: "unauthorized", message: "x" } });
  await assert.rejects(validateShiftNurseInviteCode(client(), "K7QX2M"), /session expired/);
});

test("join requests use join wording and treat a missing profile as not_found", async () => {
  for (const fn of [validateShiftNurseInviteCode, acceptShiftNurseInviteCode]) {
    fail("post", 401, { error: { code: "unauthorized", message: "x" } });
    await assert.rejects(fn(client(), "K7QX2M"), (error) => {
      assert.match(error.message, /session expired/);
      assert.doesNotMatch(error.message, /manage/);
      return true;
    });
    mock.restoreAll();
    fail("post", 403, { error: { code: "profile_missing", message: "No profile." } });
    const result = await fn(client(), "K7QX2M");
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "not_found");
    assert.match(result.message, /not valid/);
    mock.restoreAll();
  }
});
