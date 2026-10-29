import assert from "node:assert/strict";
import { AxiosError } from "axios";
import test, { afterEach, mock } from "node:test";

import {
  confirmManualAssignmentOverride,
  loadJoinedNurseAssignmentView,
  resolveShiftNurseSwapRequest,
  submitJoinedNurseIssueRequest,
  submitJoinedNurseSwapRequest,
  updateShiftNurseIssueStatus,
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

const moveInput = {
  baselineAssignmentResultId: "baseline", bedId: "bed", clientMutationId: "mutation-1",
  fromNurseId: "one", shiftId: "shift-1", toNurseId: "two",
  warningAcknowledgements: [{ id: "w", warningType: "over_max_load", message: "m" }],
};

// Go supplies the data; Supabase only supplies the token and must never be called.
function client() {
  return {
    auth: { async getSession() { return { data: { session: { access_token: "tok" } }, error: null }; } },
    rpc() { assert.fail("must not fall back to Supabase RPC"); },
  };
}

function goPosts(data, status = 200) {
  const calls = [];
  mock.method(goApiClient, "post", async (url, body, config) => {
    calls.push({ url, body, headers: config.headers });
    return { status, data };
  });
  return calls;
}

function postFails(status, data) {
  mock.method(goApiClient, "post", async () => {
    throw new AxiosError("failed", "ERR_BAD_RESPONSE", {}, {}, { status, data });
  });
}

function confirm(data) {
  mock.restoreAll();
  goPosts(data);
  return confirmManualAssignmentOverride(client(), moveInput);
}

test("posts the move with a snake_case body and auth header", async () => {
  const calls = goPosts({ status: "saved", override, activeAssignmentOverridesByBedId: { bed: override } });
  await confirmManualAssignmentOverride(client(), moveInput);
  assert.equal(calls[0].url, "/shifts/shift-1/assignment-moves");
  assert.deepEqual(calls[0].body, {
    baseline_assignment_result_id: "baseline", bed_id: "bed", client_mutation_id: "mutation-1",
    from_nurse_id: "one", related_swap_request_id: null, to_nurse_id: "two",
    warning_acknowledgements: moveInput.warningAcknowledgements,
  });
  assert.equal(calls[0].headers.Authorization, "Bearer tok");
  mock.restoreAll();
  const linked = goPosts({ status: "stale", message: "x" });
  await confirmManualAssignmentOverride(client(), { ...moveInput, relatedSwapRequestId: "swap-1" });
  assert.equal(linked[0].body.related_swap_request_id, "swap-1");
});

test("surfaces move failures: server message, 401, and network", async () => {
  postFails(422, { error: { code: "invalid_move", message: "Acknowledge the max-load warning before confirming." } });
  await assert.rejects(confirmManualAssignmentOverride(client(), moveInput), /Acknowledge the max-load warning/);
  mock.restoreAll();
  postFails(401, { error: { code: "unauthorized", message: "no" } });
  await assert.rejects(confirmManualAssignmentOverride(client(), moveInput), /session expired/);
  mock.restoreAll();
  mock.method(goApiClient, "post", async () => { throw new AxiosError("down", "ERR_NETWORK"); });
  await assert.rejects(confirmManualAssignmentOverride(client(), moveInput), /Could not reach/);
});

test("parses saved override and projection, including nullable RPC fields", async () => {
  const value = { ...override, supersededAt: null, relatedSwapRequestId: null, futureField: "keep" };
  const result = await confirm({
    status: "saved", override: value,
    activeAssignmentOverridesByBedId: { bed: value },
  });
  assert.equal(result.status, "saved");
  assert.equal(result.override.id, override.id);
  assert.equal(result.override.futureField, "keep");
  assert.equal(result.override.supersededAt, undefined);
  assert.equal(result.override.relatedSwapRequestId, undefined);
  assert.deepEqual(result.override.warningAcknowledgements, []);
  assert.deepEqual(result.activeAssignmentOverridesByBedId.bed, result.override);
});

test("retains stale outcomes and empty projections", async () => {
  const result = await confirm({
    status: "stale", message: "Reload", currentEffectiveNurseId: null,
  });
  assert.equal(result.status, "stale");
  assert.equal(result.message, "Reload");
  assert.deepEqual(result.activeAssignmentOverridesByBedId, {});
});

test("rejects malformed override fields, projections, and warning entries", async () => {
  for (const change of [
    { id: 42 }, { serverSequence: "1" }, { toNurseId: "" },
    { warningAcknowledgements: [{}] },
  ]) {
    await assert.rejects(confirm({
      status: "saved", activeAssignmentOverridesByBedId: { bed: { ...override, ...change } },
    }), /manual assignment override has an invalid server shape/);
  }
  await assert.rejects(confirm({ status: "unknown" }),
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

const nurseRequest = {
  id: "nurse-request-abc", type: "issue", status: "pending", requestingNurseId: "n1",
  requestingNurseName: "Ada", message: "Help", createdAt: "2026-10-24T10:00:00Z", futureField: 1,
};

test("submits joined issue and swap requests to the Go routes", async () => {
  let calls = goPosts({ request: nurseRequest }, 201);
  await submitJoinedNurseIssueRequest(client(), { message: "  Help  " });
  assert.equal(calls[0].url, "/joined-workspace/issue-requests");
  assert.deepEqual(calls[0].body, { message: "Help" });
  assert.equal(calls[0].headers.Authorization, "Bearer tok");
  mock.restoreAll();
  calls = goPosts({ request: { ...nurseRequest, type: "swap", sourceBedId: "bed" } }, 201);
  await submitJoinedNurseSwapRequest(client(), { message: " Swap ", sourceBedId: "bed" });
  assert.equal(calls[0].url, "/joined-workspace/swap-requests");
  assert.deepEqual(calls[0].body, { message: "Swap", source_bed_id: "bed" });
});

test("keeps local validation messages and sends nothing", async () => {
  mock.method(goApiClient, "post", async () => assert.fail("no request expected"));
  await assert.rejects(submitJoinedNurseIssueRequest(client(), { message: " " }), /Add issue details/);
  await assert.rejects(submitJoinedNurseSwapRequest(client(), { message: "x", sourceBedId: "" }), /Choose the assigned bed/);
  await assert.rejects(submitJoinedNurseSwapRequest(client(), { message: " ", sourceBedId: "b" }), /Add swap details/);
});

test("submission failures show the server message, 401, and bad shapes", async () => {
  postFails(409, { error: { code: "request_pending", message: "This issue is already pending." } });
  await assert.rejects(submitJoinedNurseIssueRequest(client(), { message: "x" }), /already pending/);
  mock.restoreAll();
  postFails(401, { error: { code: "unauthorized", message: "no" } });
  await assert.rejects(submitJoinedNurseSwapRequest(client(), { message: "x", sourceBedId: "b" }), /session expired/);
  mock.restoreAll();
  goPosts({ request: { id: "r" } }, 201);
  await assert.rejects(submitJoinedNurseIssueRequest(client(), { message: "x" }), /invalid server shape/);
  mock.restoreAll();
  goPosts({ request: nurseRequest }, 200);
  await assert.rejects(submitJoinedNurseIssueRequest(client(), { message: "x" }), /invalid server shape/);
});

test("charge review posts to shift-scoped, URL-encoded routes", async () => {
  let calls = goPosts({ request: nurseRequest });
  await resolveShiftNurseSwapRequest(client(), { nextStatus: "accepted", requestId: "nurse-request-a/b", shiftId: "shift-1" });
  assert.equal(calls[0].url, "/shifts/shift-1/requests/nurse-request-a%2Fb/swap-resolution");
  assert.deepEqual(calls[0].body, { status: "accepted" });
  mock.restoreAll();
  calls = goPosts({ request: nurseRequest });
  await updateShiftNurseIssueStatus(client(), { nextStatus: "reviewed", requestId: "nurse-request-abc", shiftId: "shift-1" });
  assert.equal(calls[0].url, "/shifts/shift-1/requests/nurse-request-abc/issue-status");
  assert.deepEqual(calls[0].body, { status: "reviewed" });
  assert.equal(calls[0].headers.Authorization, "Bearer tok");
  mock.restoreAll();
  postFails(409, { error: { code: "invalid_transition", message: "That issue status change is not allowed." } });
  await assert.rejects(updateShiftNurseIssueStatus(client(), { nextStatus: "open", requestId: "r", shiftId: "s" }), /not allowed/);
  mock.restoreAll();
  postFails(404, {});
  await assert.rejects(resolveShiftNurseSwapRequest(client(), { nextStatus: "declined", requestId: "r", shiftId: "s" }), /could not be resolved/);
});
