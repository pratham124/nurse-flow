import assert from "node:assert/strict";
import { AxiosError } from "axios";
import test, { afterEach, mock } from "node:test";

import {
  confirmManualAssignmentOverride,
  loadJoinedNurseAssignmentView,
} from "../src/services/serverWorkspaceRepository.ts";
import { goApiClient } from "../src/services/goApiClient.ts";

afterEach(() => mock.restoreAll());

const profile = { id: "nurse-profile" };
const override = {
  id: "override", shiftId: "shift", baselineAssignmentResultId: "baseline",
  bedId: "bed", fromNurseId: "one", toNurseId: "two",
  createdByProfileId: "charge", createdAt: "2026-10-19T12:00:00Z",
  status: "active", serverSequence: 1,
};
const assignedBed = {
  bed: { id: "bed", roomId: "room", label: "101-1", bedNumber: 1, futureField: true },
  bedState: { id: "state", bedId: "bed", patient: { initials: "AB" }, acuity: "yellow" },
  doctorSide: { id: "side", name: "East" },
  room: { id: "room", doctorSideId: "side", label: "101", bedCount: 1 },
};
const view = {
  shiftId: "shift", floorName: "Floor", nurseName: "Nurse",
  assignedBeds: [assignedBed],
  access: { id: "access", status: "linked", nurseProfileId: profile.id },
};

function client(data, error = null) {
  return { rpc: async () => ({ data, error }) };
}

test("parses saved override and projection, including nullable RPC fields", async () => {
  const value = { ...override, supersededAt: null, relatedSwapRequestId: null, futureField: "keep" };
  const result = await confirmManualAssignmentOverride(client({
    status: "saved", override: value,
    activeAssignmentOverridesByBedId: { bed: value },
  }), {});
  assert.equal(result.status, "saved");
  assert.equal(result.override.id, override.id);
  assert.equal(result.override.futureField, "keep");
  assert.equal(result.override.supersededAt, undefined);
  assert.equal(result.override.relatedSwapRequestId, undefined);
  assert.deepEqual(result.override.warningAcknowledgements, []);
  assert.deepEqual(result.activeAssignmentOverridesByBedId.bed, result.override);
});

test("retains stale outcomes and empty projections", async () => {
  const result = await confirmManualAssignmentOverride(client({
    status: "stale", message: "Reload", currentEffectiveNurseId: null,
  }), {});
  assert.equal(result.status, "stale");
  assert.equal(result.message, "Reload");
  assert.deepEqual(result.activeAssignmentOverridesByBedId, {});
});

test("rejects malformed override fields, projections, and warning entries", async () => {
  for (const change of [
    { id: 42 }, { serverSequence: "1" }, { toNurseId: "" },
    { warningAcknowledgements: [{}] },
  ]) {
    await assert.rejects(confirmManualAssignmentOverride(client({
      status: "saved", activeAssignmentOverridesByBedId: { bed: { ...override, ...change } },
    }), {}), /manual assignment override has an invalid server shape/);
  }
  await assert.rejects(confirmManualAssignmentOverride(client({ status: "unknown" }), {}),
    /manual assignment override returned an invalid result/);
});

// The joined workspace now comes from the Go API; Supabase only supplies the token.
function joinedClient() {
  return {
    auth: { async getSession() { return { data: { session: { access_token: "joined-token" } }, error: null }; } },
    rpc() { assert.fail("joined workspace must not fall back to Supabase RPC"); },
  };
}

function goReturns(assignment, status = 200) {
  const calls = [];
  mock.method(goApiClient, "get", async (url, config) => {
    calls.push({ url, ...config });
    return { status, data: { assignment } };
  });
  return calls;
}

function goFails(status, data) {
  mock.method(goApiClient, "get", async () => {
    throw new AxiosError("failed", "ERR_BAD_RESPONSE", {}, {}, { status, data });
  });
}

test("parses joined nurse nested data and preserves future layout fields", async () => {
  const calls = goReturns(view);
  const result = await loadJoinedNurseAssignmentView(joinedClient(), profile);
  assert.deepEqual(result.assignedBeds, view.assignedBeds);
  assert.deepEqual(result.requestHistory, []);
  assert.equal(result.access.nurseProfileId, profile.id);
  assert.equal(calls[0].url, "/joined-workspace");
  assert.equal(calls[0].headers.Authorization, "Bearer joined-token");
});

test("supports legacy snake_case fields and null bed states", async () => {
  goReturns({
    shiftId: null, floorName: null, nurseName: null,
    shift_id: "shift", floor_name: "Floor", nurse_name: "Nurse",
    assigned_beds: [{ ...assignedBed, bedState: null }],
    request_history: null,
    access: { id: "access", status: "linked", nurseProfileId: null, nurse_profile_id: profile.id, nurse_email: null },
  });
  const result = await loadJoinedNurseAssignmentView(joinedClient(), profile);
  assert.equal(result.shiftId, "shift");
  assert.equal(result.assignedBeds[0].bedState, undefined);
  assert.equal(result.access.nurseEmail, undefined);
  assert.deepEqual(result.requestHistory, []);
});

test("preserves ownership and linked-access checks", async () => {
  for (const [access, message] of [
    [{ status: "linked", nurseProfileId: "someone-else" }, /does not belong/],
    [{ status: "removed" }, /No shift access yet/],
    [{ status: "pending_link" }, /No shift access yet/],
    [{ status: "unknown" }, /unsupported status/],
  ]) {
    mock.restoreAll();
    goReturns({ ...view, access });
    await assert.rejects(loadJoinedNurseAssignmentView(joinedClient(), profile), message);
  }
});

test("rejects incomplete nested records and malformed history at the boundary", async () => {
  for (const data of [
    { ...view, assignedBeds: [{ ...assignedBed, bed: { id: "bed" } }] },
    { ...view, assignedBeds: [null] },
    { ...view, assignedBeds: "beds" },
    { ...view, requestHistory: [{}] },
    { ...view, floorName: 42 },
  ]) {
    mock.restoreAll();
    goReturns(data);
    await assert.rejects(loadJoinedNurseAssignmentView(joinedClient(), profile), /nurse assignment view/);
  }
});

test("keeps no-active-assignment (null) and server failures distinct", async () => {
  goReturns(null);
  assert.equal(await loadJoinedNurseAssignmentView(joinedClient(), profile), undefined);
  mock.restoreAll();
  goFails(503, { error: { code: "database_unavailable", message: "Database is unavailable." } });
  await assert.rejects(loadJoinedNurseAssignmentView(joinedClient(), profile), /Database is unavailable/);
  mock.restoreAll();
  goFails(401, { error: { code: "unauthorized", message: "no" } });
  await assert.rejects(loadJoinedNurseAssignmentView(joinedClient(), profile), /session expired/);
  mock.restoreAll();
  goReturns(undefined);
  await assert.rejects(loadJoinedNurseAssignmentView(joinedClient(), profile), /invalid server shape/);
});
