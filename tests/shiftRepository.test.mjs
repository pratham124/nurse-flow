import assert from "node:assert/strict";
import { AxiosError } from "axios";
import test, { afterEach, mock } from "node:test";

import { goApiClient } from "../src/services/goApiClient.ts";
import {
  createServerActiveShift,
  endServerActiveShift,
  loadPreviousShiftSnapshots,
  loadServerActiveShift,
  resetServerActiveShiftForEditing,
  saveServerActiveShift,
} from "../src/services/shiftRepository.ts";
import { loadServerWorkspace } from "../src/services/serverWorkspaceRepository.ts";
import {
  createServerWorkspaceStore,
  getWorkspaceView,
} from "../src/store/serverWorkspaceStore.ts";

afterEach(() => mock.restoreAll());
const id = "40000000-0000-4000-8000-000000000001";
const templateId = "30000000-0000-4000-8000-000000000001";
const revision = "2026-10-18T12:00:00.123456Z";
const profile = {
  id: "charge",
  authUserId: "auth",
  role: "charge_nurse",
  displayName: "Charge",
  createdAt: revision,
  updatedAt: revision,
};
const snapshot = {
  id,
  floorTemplateId: templateId,
  floorName: "Floor",
  startedAt: revision,
  status: "setup",
  admittingDoctorSideId: "a",
  doctorSides: [
    { id: "a", name: "East" },
    { id: "b", name: "West" },
  ],
  rooms: [{ id: "room", doctorSideId: "a", label: "101", bedCount: 1 }],
  beds: [{ id: "bed", roomId: "room", label: "101-1", bedNumber: 1 }],
  sideLoadLimits: {
    admitting: { min: 4, max: 5 },
    nonAdmitting: { min: 6, max: 7 },
  },
  nurses: [
    {
      id: "n1",
      name: "One",
      licenseType: "RN",
      experienceLevel: "mid",
      maxPatientLoad: 5,
    },
    {
      id: "n2",
      name: "Two",
      licenseType: "RN",
      experienceLevel: "mid",
      maxPatientLoad: 5,
    },
  ],
  bedStates: [
    {
      id: "state",
      bedId: "bed",
      patient: { initials: "AB" },
      acuity: "yellow",
    },
  ],
  flags: [],
  nurseRequests: [],
};
const row = {
  id,
  floor_template_id: templateId,
  charge_profile_id: profile.id,
  created_at: revision,
  updated_at: revision,
  ended_at: null,
  status: "setup",
  shift_snapshot: snapshot,
  active_assignment_overrides_by_bed_id: {},
};
const client = (token = "current-token") => ({
  auth: {
    getSession: async () => ({
      data: { session: token ? { access_token: token } : null },
    }),
  },
  from: () => assert.fail("migrated shifts must never use Supabase tables"),
  rpc: () => assert.fail("migrated shifts must never use an RPC fallback"),
});

test("current shift maps raw microsecond revision and effective overrides", async () => {
  const assigned = {
    ...row,
    status: "assigned",
    shift_snapshot: {
      ...snapshot,
      status: "assigned",
      assignmentResult: {
        id: "baseline",
        generatedTeams: [],
        roomCoverage: [],
        bedAssignments: [{ id: "assignment", bedId: "bed", nurseId: "n1" }],
      },
    },
    active_assignment_overrides_by_bed_id: {
      bed: {
        id: "override",
        shift_id: id,
        baseline_assignment_result_id: "baseline",
        bed_id: "bed",
        from_nurse_id: "n1",
        to_nurse_id: "n2",
        created_by_profile_id: profile.id,
        created_at: revision,
        status: "active",
        superseded_at: null,
        server_sequence: 1,
        related_swap_request_id: null,
        warning_acknowledgements: [],
      },
    },
  };
  mock.method(goApiClient, "get", async (path, config) => {
    assert.equal(path, "/active-shifts/current");
    assert.equal(config.headers.Authorization, "Bearer current-token");
    return { status: 200, data: { active_shift: assigned } };
  });
  const activeShift = await loadServerActiveShift(client(), profile);
  assert.equal(activeShift.shiftSnapshot.serverRevision, revision);
  assert.equal(
    activeShift.activeAssignmentOverridesByBedId.bed.toNurseId,
    "n2",
  );
  const view = getWorkspaceView({
    status: "ready",
    workspace: {
      activeShift,
      floorTemplates: [],
      previousShiftSnapshots: [],
      profile,
    },
  });
  assert.equal(view.effectiveAssignmentResult.bedAssignments[0].nurseId, "n2");
});

test("empty shift and previous collections preserve empty workspace semantics", async () => {
  mock.method(goApiClient, "get", async (path) => ({
    status: 200,
    data:
      path === "/floor-templates"
        ? { templates: [] }
        : path === "/active-shifts/current"
          ? { active_shift: null }
          : { snapshots: [] },
  }));
  const workspace = await loadServerWorkspace(client(), profile);
  assert.equal(workspace.activeShift, undefined);
  assert.deepEqual(workspace.previousShiftSnapshots, []);
  assert.deepEqual(workspace.floorTemplates, []);
});

test("one failed migrated read still fails the whole workspace without fallback", async () => {
  mock.method(goApiClient, "get", async (path) => {
    if (path === "/active-shifts/current")
      throw new AxiosError(
        "private SQL",
        "ERR_BAD_RESPONSE",
        undefined,
        undefined,
        { status: 503 },
      );
    return {
      status: 200,
      data: path === "/floor-templates" ? { templates: [] } : { snapshots: [] },
    };
  });
  await assert.rejects(
    loadServerWorkspace(client(), profile),
    /temporarily unavailable/,
  );
});

test("carry-over validates owner and maps existing suggestion normalization", async () => {
  let owner = profile.id;
  mock.method(goApiClient, "get", async () => ({
    status: 200,
    data: {
      snapshots: [
        {
          id: "previous",
          charge_profile_id: owner,
          floor_template_id: templateId,
          completed_at: revision,
          nurse_suggestions: null,
          patient_suggestions: [],
        },
      ],
    },
  }));
  assert.deepEqual(
    (await loadPreviousShiftSnapshots(client(), profile))[0].nurseSuggestions,
    [],
  );
  owner = "foreign";
  await assert.rejects(
    loadPreviousShiftSnapshots(client(), profile),
    /wrong account/,
  );
});

test("start sends only an owned template reference and accepts authoritative snapshot", async () => {
  mock.method(goApiClient, "post", async (path, body, config) => {
    assert.equal(path, "/active-shifts");
    assert.deepEqual(body, { floor_template_id: templateId });
    assert.equal(config.headers.Authorization, "Bearer current-token");
    return { status: 201, data: { active_shift: row } };
  });
  const result = await createServerActiveShift(client(), profile, {
    ...snapshot,
    id: "local",
    chargeProfileId: "spoof",
    floorName: "spoof",
  });
  assert.equal(result.id, id);
  assert.equal(result.shiftSnapshot.floorName, "Floor");
});

test("setup sends the draft's original revision and only mutable fields", async () => {
  const draft = {
    ...snapshot,
    serverRevision: revision,
    assignmentResult: { id: "forged" },
    floorName: "forged",
    nurseRequests: [{ id: "forged" }],
    nurses: snapshot.nurses.map((n) => ({ ...n, private: "do not send" })),
    bedStates: snapshot.bedStates.map((s) => ({
      ...s,
      private: true,
      patient: { ...s.patient, private: true },
    })),
  };
  mock.method(goApiClient, "put", async (path, body) => {
    assert.equal(path, `/active-shifts/${id}/setup`);
    assert.equal(body.expected_updated_at, revision);
    assert.deepEqual(
      Object.keys(body.setup).sort(),
      [
        "admittingDoctorSideId",
        "bedStates",
        "carryOverReviewedAt",
        "nurses",
        "sideLoadLimits",
      ].sort(),
    );
    assert.equal(body.setup.nurses[0].private, undefined);
    assert.equal(body.setup.bedStates[0].patient.private, undefined);
    return {
      status: 200,
      data: { active_shift: { ...row, updated_at: "2026-10-18T12:01:00Z" } },
    };
  });
  const saved = await saveServerActiveShift(client(), profile, draft);
  assert.equal(draft.serverRevision, revision);
  assert.equal(saved.shiftSnapshot.serverRevision, "2026-10-18T12:01:00Z");
  await assert.rejects(
    saveServerActiveShift(client(), profile, snapshot),
    /Reload/,
  );
});

test("reopen preserves saved/stale contract and uses baseline check", async () => {
  let result = { status: "stale", message: "Review current board." };
  mock.method(goApiClient, "post", async (path, body) => {
    assert.equal(path, `/active-shifts/${id}/reopen`);
    assert.deepEqual(body, {
      expected_baseline_assignment_result_id: "baseline",
    });
    return { status: 200, data: result };
  });
  assert.equal(
    (await resetServerActiveShiftForEditing(client(), profile, id, "baseline"))
      .status,
    "stale",
  );
  result = { status: "saved", shiftSnapshot: snapshot };
  const reopened = await resetServerActiveShiftForEditing(
    client(),
    profile,
    id,
    "baseline",
  );
  assert.deepEqual(reopened.activeAssignmentOverridesByBedId, {});
});

test("end sends no snapshot/carry-over and refreshes participation after one write", async () => {
  let calls = 0;
  mock.method(goApiClient, "post", async (path, body) => {
    calls++;
    assert.equal(path, `/active-shifts/${id}/end`);
    assert.deepEqual(body, {});
    return {
      status: 200,
      data: { active_shift: { ...row, ended_at: "2026-10-18T12:02:00Z" } },
    };
  });
  const store = createServerWorkspaceStore({
    getAuthState: () => ({ status: "signed_in", profile }),
    getSupabaseClient: () => client(),
    dependencies: {
      endServerActiveShift,
      loadServerWorkspace: async () => ({
        profile,
        floorTemplates: [],
        previousShiftSnapshots: [],
        activeShift: undefined,
      }),
    },
  });
  store
    .getState()
    .applyWorkspace({
      profile,
      floorTemplates: [],
      previousShiftSnapshots: [],
      activeShift: { id, shiftSnapshot: snapshot },
    });
  assert.equal(store.getState().activeParticipation.type, "charge_shift");
  await store.getState().endActiveShift(snapshot);
  assert.equal(calls, 1);
  assert.equal(store.getState().activeParticipation.type, "none");
});

test("invalid status, malformed shape, foreign owner and mismatched snapshot are rejected", async () => {
  for (const response of [
    { status: 201, data: { active_shift: row } },
    { status: 200, data: {} },
    {
      status: 200,
      data: { active_shift: { ...row, charge_profile_id: "foreign" } },
    },
    {
      status: 200,
      data: {
        active_shift: {
          ...row,
          shift_snapshot: { ...snapshot, id: "foreign" },
        },
      },
    },
    {
      status: 200,
      data: {
        active_shift: {
          ...row,
          shift_snapshot: { ...snapshot, status: "assigned" },
        },
      },
    },
    { status: 200, data: { active_shift: { ...row, updated_at: "invalid" } } },
    {
      status: 200,
      data: {
        active_shift: { ...row, active_assignment_overrides_by_bed_id: null },
      },
    },
  ]) {
    mock.method(goApiClient, "get", async () => response);
    await assert.rejects(loadServerActiveShift(client(), profile));
    mock.restoreAll();
  }
});

test("missing sessions and forbidden roles never send migrated requests", async () => {
  mock.method(goApiClient, "get", async () =>
    assert.fail("no request allowed"),
  );
  mock.method(goApiClient, "post", async () =>
    assert.fail("no request allowed"),
  );
  await assert.rejects(loadServerActiveShift(client(null), profile), /session/);
  await assert.rejects(
    endServerActiveShift(client(null), profile, snapshot),
    /session/,
  );
  await assert.rejects(
    loadServerActiveShift(client(), { ...profile, role: "regular_nurse" }),
    /charge nurse/,
  );
});

test("controlled errors preserve stale and assigned messages without server details", async () => {
  for (const [status, code, expected] of [
    [400, "invalid_shift", /incomplete/],
    [401, "unauthenticated", /expired/],
    [403, "forbidden", /cannot manage/],
    [404, "shift_not_found", /no longer available/],
    [409, "shift_stale", /shift changed/],
    [409, "shift_assigned", /Reopen/],
    [409, "shift_already_open", /already exists/],
    [413, "shift_too_large", /too large/],
    [503, "database_unavailable", /temporarily unavailable/],
  ]) {
    mock.method(goApiClient, "put", async () => {
      throw new AxiosError(
        "private SQL",
        "ERR_BAD_RESPONSE",
        undefined,
        undefined,
        { status, data: { error: { code, message: "private password" } } },
      );
    });
    await assert.rejects(
      saveServerActiveShift(client(), profile, {
        ...snapshot,
        serverRevision: revision,
      }),
      expected,
    );
    mock.restoreAll();
  }
  for (const [code, expected] of [
    ["ECONNABORTED", /too long/],
    ["ERR_NETWORK", /Could not reach/],
  ]) {
    mock.method(goApiClient, "get", async () => {
      throw new AxiosError("private", code);
    });
    await assert.rejects(loadServerActiveShift(client(), profile), expected);
    mock.restoreAll();
  }
});
