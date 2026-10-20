// Launched by TestShiftLifecycleHTTPDemo with synthetic JWTs and local Postgres.
// Never point this script at a live project or supply real user credentials.
import assert from "node:assert/strict";
import { loadServerWorkspace } from "../src/services/serverWorkspaceRepository.ts";
import {
  createServerActiveShift,
  endServerActiveShift,
  loadServerActiveShift,
  resetServerActiveShiftForEditing,
  saveServerActiveShift,
} from "../src/services/shiftRepository.ts";
import { createServerWorkspaceStore } from "../src/store/serverWorkspaceStore.ts";

const profile = JSON.parse(process.env.NURSEFLOW_DEMO_PROFILE);
const client = (token) => ({
  auth: {
    getSession: async () => ({ data: { session: { access_token: token } } }),
  },
});
const alpha = client(process.env.NURSEFLOW_DEMO_ALPHA_TOKEN);

if (process.argv[2] === "outage") {
  await assert.rejects(
    loadServerActiveShift(alpha, profile),
    /Could not reach/,
  );
  console.log(
    "Stopped Go API: actual client returned controlled connection error without fallback.",
  );
} else {
  const store = createServerWorkspaceStore({
    getAuthState: () => ({ status: "signed_in", profile }),
    getSupabaseClient: () => alpha,
    dependencies: {
      createServerActiveShift,
      endServerActiveShift,
      loadServerWorkspace,
      resetServerActiveShiftForEditing,
      saveServerActiveShift,
    },
  });
  await store.getState().retryLoadWorkspace();
  assert.equal(store.getState().workspaceState.status, "ready");
  const template = store
    .getState()
    .floorTemplates.find(
      (t) => t.id === process.env.NURSEFLOW_DEMO_TEMPLATE_ID,
    );
  assert.ok(template);
  // Go constructs the snapshot; the repository sends only this reference.
  const started = await store
    .getState()
    .startActiveShift({ floorTemplateId: template.id });
  assert.ok(started.serverRevision);
  assert.equal(store.getState().activeParticipation.type, "charge_shift");
  const draft = {
    ...started,
    admittingDoctorSideId: "a",
    nurses: [
      {
        id: "nurse",
        name: "Demo Nurse",
        licenseType: "RN",
        experienceLevel: "mid",
        maxPatientLoad: 5,
      },
    ],
    bedStates: started.bedStates.map((state) => ({
      ...state,
      patient: { initials: "AB" },
      acuity: "yellow",
    })),
    carryOverReviewedAt: new Date().toISOString(),
  };
  const saved = await store.getState().saveActiveShift(draft);
  assert.notEqual(saved.serverRevision, started.serverRevision);
  await assert.rejects(
    store.getState().saveActiveShift(draft),
    /shift changed/,
  );
  await store.getState().retryLoadWorkspace();
  assert.equal(
    store.getState().activeShift.bedStates[0].patient.initials,
    "AB",
  );
  await assert.rejects(
    store.getState().resetActiveShiftForEditing("old-baseline"),
    /assignment changed/,
  );
  const reopened = await store.getState().resetActiveShiftForEditing("");
  assert.ok(reopened.serverRevision); // authoritative reload also versions no-op resets
  const betaProfile = {
    ...profile,
    id: process.env.NURSEFLOW_DEMO_BETA_PROFILE_ID,
  };
  const betaWorkspace = await loadServerWorkspace(
    client(process.env.NURSEFLOW_DEMO_BETA_TOKEN),
    betaProfile,
  );
  assert.equal(betaWorkspace.activeShift, undefined);
  assert.deepEqual(betaWorkspace.previousShiftSnapshots, []);
  await assert.rejects(
    loadServerActiveShift(
      client(process.env.NURSEFLOW_DEMO_REGULAR_TOKEN),
      profile,
    ),
    /cannot manage/,
  );
  await store.getState().endActiveShift(store.getState().activeShift);
  assert.equal(store.getState().activeShift, undefined);
  assert.equal(store.getState().activeParticipation.type, "none");
  const previous = store
    .getState()
    .previousShiftSnapshots.find((s) => s.floorTemplateId === template.id);
  assert.equal(previous.nurseSuggestions[0].name, "Demo Nurse");
  assert.equal(previous.patientSuggestions[0].patient.initials, "AB");
  const next = await store
    .getState()
    .startActiveShift({ floorTemplateId: template.id });
  assert.notEqual(next.id, started.id);
  assert.equal(store.getState().previousShiftSnapshots.length, 1);
  await store.getState().endActiveShift(next);
  assert.deepEqual(store.getState().previousShiftSnapshots, []);
  console.log(
    "Actual Axios/Zod/store → Go HTTP/JWT/role checks → limited-role Postgres workflow passed: start, save, stale rejection, reload, reopen contract, isolation, end, carry-over, empty replacement, participation refresh.",
  );
}
