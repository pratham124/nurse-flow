import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmManualAssignmentOverride,
  loadJoinedNurseAssignmentView,
} from "../src/services/serverWorkspaceRepository.ts";

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

test("parses joined nurse nested data and preserves future layout fields", async () => {
  const result = await loadJoinedNurseAssignmentView(client(view), profile);
  assert.deepEqual(result.assignedBeds, view.assignedBeds);
  assert.deepEqual(result.requestHistory, []);
  assert.equal(result.access.nurseProfileId, profile.id);
});

test("supports legacy snake_case fields and null bed states", async () => {
  const result = await loadJoinedNurseAssignmentView(client({
    shiftId: null, floorName: null, nurseName: null,
    shift_id: "shift", floor_name: "Floor", nurse_name: "Nurse",
    assigned_beds: [{ ...assignedBed, bedState: null }],
    request_history: null,
    access: { id: "access", status: "linked", nurseProfileId: null, nurse_profile_id: profile.id, nurse_email: null },
  }), profile);
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
    await assert.rejects(loadJoinedNurseAssignmentView(client({ ...view, access }), profile), message);
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
    await assert.rejects(loadJoinedNurseAssignmentView(client(data), profile), /nurse assignment view/);
  }
});

test("keeps no-active-assignment and RPC failures distinct", async () => {
  assert.equal(await loadJoinedNurseAssignmentView(client(null), profile), undefined);
  await assert.rejects(loadJoinedNurseAssignmentView(client(null, { message: "RPC unavailable" }), profile),
    /RPC unavailable/);
});
