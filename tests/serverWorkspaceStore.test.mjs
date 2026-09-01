import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createServerWorkspaceStore } from "../src/store/serverWorkspaceStore.ts";

const sourceDirectory = fileURLToPath(new URL("../src", import.meta.url));

async function collectTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const entryPath = `${directory}/${entry.name}`;

      return entry.isDirectory()
        ? collectTypeScriptFiles(entryPath)
        : Promise.resolve(/\.tsx?$/.test(entry.name) ? [entryPath] : []);
    }),
  );

  return nestedFiles.flat();
}

const profile = {
  authUserId: "auth-charge-1",
  createdAt: "2026-08-28T12:00:00.000Z",
  displayName: "Charge Nurse",
  id: "profile-charge-1",
  role: "charge_nurse",
  updatedAt: "2026-08-28T12:00:00.000Z",
};

const floorTemplate = {
  beds: [],
  doctorSides: [],
  id: "floor-1",
  name: "4 North",
  rooms: [],
};

const shift = {
  admittingDoctorSideId: "",
  bedStates: [],
  beds: [],
  doctorSides: [],
  flags: [],
  floorName: "4 North",
  floorTemplateId: floorTemplate.id,
  id: "shift-1",
  nurses: [],
  rooms: [],
  sideLoadLimits: {
    admitting: { max: 0, min: 0 },
    nonAdmitting: { max: 0, min: 0 },
  },
  status: "setup",
};

const activeShiftRecord = {
  chargeProfileId: profile.id,
  createdAt: "2026-08-28T12:00:00.000Z",
  floorTemplateId: floorTemplate.id,
  id: shift.id,
  shiftSnapshot: shift,
  status: "setup",
  updatedAt: "2026-08-28T12:00:00.000Z",
};

const readyWorkspace = {
  activeShift: activeShiftRecord,
  floorTemplates: [
    {
      createdAt: "2026-08-28T12:00:00.000Z",
      id: floorTemplate.id,
      name: floorTemplate.name,
      ownerProfileId: profile.id,
      templateSnapshot: floorTemplate,
      updatedAt: "2026-08-28T12:00:00.000Z",
    },
  ],
  previousShiftSnapshots: [],
  profile,
};

function createSignedInStore(dependencies = {}) {
  return createServerWorkspaceStore({
    getSupabaseClient: () => ({ client: "fake" }),
    dependencies: {
      ...dependencies,
    },
    getAuthState: () => ({ profile, status: "signed_in" }),
  });
}

test("starts with isolated empty workspace and connection state", () => {
  const firstStore = createSignedInStore();
  const secondStore = createSignedInStore();

  firstStore.getState().applyWorkspace(readyWorkspace);

  assert.equal(firstStore.getState().activeShift?.id, shift.id);
  assert.equal(firstStore.getState().workspaceState.status, "ready");
  assert.equal(secondStore.getState().activeShift, undefined);
  assert.equal(secondStore.getState().workspaceState.status, "idle");
  assert.equal(secondStore.getState().realtimeConnectionState, "disconnected");
});

test("applies workspace source data and derived view fields atomically", () => {
  const store = createSignedInStore();
  const observedStates = [];
  const unsubscribe = store.subscribe((state) => {
    observedStates.push(state);
  });

  store.getState().applyWorkspace(readyWorkspace);
  unsubscribe();

  assert.equal(observedStates.length, 1);
  assert.equal(observedStates[0].workspaceState.status, "ready");
  assert.equal(observedStates[0].activeShift, shift);
  assert.deepEqual(observedStates[0].floorTemplates, [floorTemplate]);
  assert.deepEqual(observedStates[0].activeParticipation, {
    shiftId: shift.id,
    type: "charge_shift",
  });
});

test("does not notify an active-shift selector for unrelated state changes", () => {
  const store = createSignedInStore();
  store.getState().applyWorkspace(readyWorkspace);

  let activeShiftNotificationCount = 0;
  const unsubscribe = store.subscribe(
    (state) => state.activeShift,
    () => {
      activeShiftNotificationCount += 1;
    },
  );

  store.getState().setRealtimeConnectionState("live");
  store.getState().setJoinedNurseAccessState({ status: "empty" });
  unsubscribe();

  assert.equal(activeShiftNotificationCount, 0);
});

test("refreshes workspace after a successful save", async () => {
  const store = createSignedInStore({
    loadServerWorkspace: async () => readyWorkspace,
    saveServerActiveShift: async () => activeShiftRecord,
  });

  const savedShift = await store.getState().saveActiveShift(shift);

  assert.equal(savedShift, shift);
  assert.equal(store.getState().activeShift, shift);
});

test("preserves the previous workspace and rethrows a failed save", async () => {
  const store = createSignedInStore({
    saveServerActiveShift: async () => {
      throw new Error("server rejected save");
    },
  });
  store.getState().applyWorkspace(readyWorkspace);

  await assert.rejects(
    store.getState().saveActiveShift({ ...shift, floorName: "Changed" }),
    /server rejected save/,
  );

  assert.equal(store.getState().activeShift, shift);
});

test("does not publish screen-level pending state while a save is running", async () => {
  let finishSave;
  const saveRequest = new Promise((resolve) => {
    finishSave = resolve;
  });
  const store = createSignedInStore({
    loadServerWorkspace: async () => readyWorkspace,
    saveServerActiveShift: async () => saveRequest,
  });
  store.getState().applyWorkspace(readyWorkspace);

  let storeNotificationCount = 0;
  const unsubscribe = store.subscribe(() => {
    storeNotificationCount += 1;
  });
  const pendingSave = store.getState().saveActiveShift(shift);

  await Promise.resolve();
  assert.equal(storeNotificationCount, 0);

  finishSave(activeShiftRecord);
  await pendingSave;
  unsubscribe();

  assert.equal(storeNotificationCount, 1);
});

test("clears charge and joined workspace views after sign-out", async () => {
  let authState = { profile, status: "signed_in" };
  const store = createServerWorkspaceStore({
    dependencies: {},
    getAuthState: () => authState,
    getSupabaseClient: () => ({ client: "fake" }),
  });
  store.getState().applyWorkspace(readyWorkspace);
  store.getState().setJoinedNurseAccessState({ status: "empty" });

  authState = { status: "signed_out" };
  await store.getState().retryLoadWorkspace();
  await store.getState().retryLoadJoinedNurseAccess();

  assert.equal(store.getState().workspaceState.status, "idle");
  assert.equal(store.getState().activeShift, undefined);
  assert.equal(store.getState().joinedNurseAccessState.status, "idle");
  assert.deepEqual(store.getState().activeParticipation, { type: "none" });
});

test("requires every server workspace consumer to select state explicitly", async () => {
  const sourceFiles = await collectTypeScriptFiles(sourceDirectory);
  const zeroArgumentConsumers = [];

  for (const sourceFile of sourceFiles) {
    const source = await readFile(sourceFile, "utf8");

    if (/useServerWorkspace\s*\(\s*\)/.test(source)) {
      zeroArgumentConsumers.push(sourceFile);
    }
  }

  assert.deepEqual(zeroArgumentConsumers, []);
});

test("keeps screen-level mutation status out of the shared source state", async () => {
  const sourceFiles = await collectTypeScriptFiles(sourceDirectory);
  const legacyMutationStateReferences = [];

  for (const sourceFile of sourceFiles) {
    const source = await readFile(sourceFile, "utf8");

    if (/\b(?:saveStatus|saveErrorMessage|ServerSaveStatus)\b/.test(source)) {
      legacyMutationStateReferences.push(sourceFile);
    }
  }

  assert.deepEqual(legacyMutationStateReferences, []);
});
