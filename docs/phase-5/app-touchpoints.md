# Phase 5 App Touchpoints

Task: Phase 5 Task 0.3, Confirm Existing App Touchpoints

This note maps the current app before writing Phase 5 feature code. It is documentation only and should not change Phase 1-4 behavior.

## Current Route Shape

The app uses Expo Router under `src/app/`. Route files are intentionally thin and re-export screen files from `src/screens/`.

Current route files:

- `src/app/_layout.tsx`
- `src/app/index.tsx`
- `src/app/floor-details.tsx`
- `src/app/rooms-and-beds.tsx`
- `src/app/doctor-sides.tsx`
- `src/app/template-review.tsx`
- `src/app/carry-over-review.tsx`
- `src/app/start-shift.tsx`
- `src/app/nurses.tsx`
- `src/app/patients-and-acuity.tsx`
- `src/app/assignment-review.tsx`
- `src/app/floor-board.tsx`
- `src/app/flags.tsx`
- `src/app/simulated-nurse-picker.tsx`
- `src/app/simulated-nurse-assignment.tsx`
- `src/app/simulated-nurse-issue.tsx`
- `src/app/simulated-nurse-swap.tsx`
- `src/app/charge-request-detail.tsx`

Phase 5 should keep this pattern. New auth route files can be thin wrappers around `src/screens` files when implementation begins.

## Current State Boundary

The app's shared state currently lives in `src/store/LocalStateContext.tsx`.

Important current fields:

- `localState.floorTemplates`
- `localState.previousShiftSnapshots`
- `localState.draftFloorTemplate`
- `localState.activeShift`
- `simulatedSessionState`

`simulatedSessionState` is a local Phase 3 testing tool. It is not real auth and should not become the Phase 5 account session.

## Where Auth And Session State Should Live

Likely files for future auth/session implementation:

- `src/types/models.ts` or a new nearby auth type file for `AuthStatus`, `UserRole`, `UserProfile`, and `ServerSaveStatus`.
- `src/store/AuthSessionContext.tsx` for signed-out, checking, signed-in, profile, and setup-error state.
- `src/app/_layout.tsx` for wrapping the app with the auth/session provider and session gate.
- Future auth screens under `src/screens`, with thin matching routes under `src/app`.

Rules:

- Keep auth/session state separate from `LocalAppState`.
- Keep real `UserProfile.role` separate from `SimulatedSessionState.role`.
- Keep secure token storage inside the Supabase client/session setup, not in screen files.

## Current Local Persistence Boundary

Current local persistence files:

- `src/services/storageRepository.ts`
- `src/services/localStorageAdapters.ts`
- `src/store/LocalStateContext.tsx`

Current local storage key:

- `nurseflow.localAppState.v1`

Current persisted local state:

- `floorTemplates`
- `activeShift`
- `previousShiftSnapshots`

On native platforms, local app data is saved as a JSON file through Expo FileSystem. On web, it uses browser `localStorage`.

## Where Server Services Should Live

Likely files for future server work:

- `src/services/supabaseClient.ts` for the configured Supabase client and secure native session storage.
- `src/services/serverWorkspaceRepository.ts` for loading profile, floor templates, active shift, and previous-shift snapshots.
- Focused repository helpers in `src/services` as server behavior grows, such as template, active-shift, and profile helpers.

Rules:

- Screens should not call Supabase directly in many places.
- Prefer small service/repository functions that return typed app data.
- After a server mutation, refresh the relevant server-owned data before the next screen depends on it.

## Local Persistence Paths That Server Persistence Will Replace

Phase 5 should replace these local persistence responsibilities with server-backed state:

- `saveFloorTemplates` in `LocalStateContext` becomes server floor template create/update/list behavior for signed-in charge nurses.
- `saveActiveShift` in `LocalStateContext` becomes server active shift persistence after meaningful shift changes.
- `savePreviousShiftSnapshot` in `LocalStateContext` becomes server previous-shift snapshot persistence when ending a shift.
- `createShiftFromTemplate` in `src/helpers/shiftHelpers.ts` should eventually start from a server template record and create a server active shift record.
- `createPreviousShiftSnapshot` in `src/helpers/shiftHelpers.ts` remains useful for shaping carry-over data, but the save destination changes from local storage to the server.

The local storage repository and local storage-backed state context should be removed from Phase 5 runtime flows once the matching server-backed paths exist. The old local data was only for testing before the backend existed, so Phase 5 does not need to preserve or import it.

## Local Storage Removal

Old local testing data under `nurseflow.localAppState.v1` can be discarded when server persistence takes over.

Likely files to remove, shrink, or disconnect from runtime flows:

- `src/store/LocalStateContext.tsx`
- `src/services/storageRepository.ts`
- `src/services/localStorageAdapters.ts`
- Any runtime usage of the `nurseflow.localAppState.v1` key

Removal rules:

- Do not import old local testing data.
- Do not keep two sources of truth for templates, active shifts, snapshots, nurses, patients, or requests.
- Keep temporary form state local only until submit.
- Fetch server data after successful mutations and render from fetched server state.
- Sign out should clear in-memory server workspace state; it should not depend on local app-state storage.

## Current Workflow Touchpoints

Current screens that will need careful server-backed changes later:

- `src/screens/HomeScreen.tsx`: lists templates, starts shifts, ends shifts, and saves previous-shift snapshots.
- `src/screens/TemplateReviewScreen.tsx`: saves floor templates.
- `src/screens/StartShiftScreen.tsx`: sets shift-side and load-limit setup.
- `src/screens/NursesScreen.tsx`: edits active-shift nurses.
- `src/screens/PatientsAndAcuityScreen.tsx`: edits bed states, patients, and acuity.
- `src/screens/AssignmentReviewScreen.tsx`: writes assignment results and flags.
- `src/screens/ChargeNurseRequestDetailScreen.tsx`: resolves local swap requests.
- `src/screens/SimulatedNurseIssueScreen.tsx` and `src/screens/SimulatedNurseSwapScreen.tsx`: append local nurse requests to the active shift.

These screens should keep their existing behavior until each matching Phase 5 task replaces one persistence path, then the old local storage path should be removed instead of kept as a fallback.

## Scope Guardrail

Task 0.3 does not add auth, Supabase dependencies, tables, RLS policies, server calls, realtime subscriptions, invite links, deep links, push notifications, offline queues, drag-and-drop behavior, tablet layout, or AI.
