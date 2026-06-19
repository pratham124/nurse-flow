# NurseFlow Phase 5 User Stories

These user stories cover Phase 5 only: backend, auth, and server-side persistence after the local Phase 1-4 workflows are proven.

Phase source note: `docs/phases.md` defines Phase 5 as Backend, Auth, and Server Persistence. Realtime collaboration, nurse invite links, and deep linking belong to Phase 6 in that file, so they are intentionally excluded here.

Phase 5 preserves the Phase 1 charge nurse assignment workflow, Phase 2 carry-over behavior through server snapshots, Phase 3 simulated nurse view and local request behavior, and Phase 4 local break scheduling. It adds real accounts and server storage without making the app feel realtime yet.

## Story 1: Choose and Document the Backend Approach

As a learner building NurseFlow, I want the backend choice documented before implementation so I understand what service stores accounts and shift data.

### Acceptance Criteria

- The project has a short backend decision note before backend code is added.
- The decision explains why the backend is appropriate for email/password auth and server persistence.
- The decision explains what is not being enabled yet: realtime channels, invite links, deep links, push notifications, offline write queues, and AI.
- The decision identifies the smallest set of environment variables and setup steps needed for local development.
- The decision preserves the existing TypeScript model boundaries where possible.

### Validation and Edge Cases

- If the chosen backend supports realtime, Phase 5 still uses normal request/response reads and writes only.
- If local setup is missing environment variables, the app should show a clear setup message instead of crashing.
- Do not add backend features just because the provider offers them.

## Story 2: Create and Restore a Charge Nurse Session

As a charge nurse, I want to sign up, log in, and stay logged in so my server-backed floor templates and shifts belong to my account.

### Acceptance Criteria

- A charge nurse can create an account with email and password.
- A charge nurse can log in with email and password.
- Session state survives closing and reopening the app.
- The app can show a signed-out state, loading session state, signed-in state, and sign-out action.
- Auth errors are shown in plain language.
- Existing local screens remain protected from unauthenticated server writes.

### Validation and Edge Cases

- Invalid email, weak password, wrong password, and network failure each show readable messages.
- A signed-out user cannot save server floor templates or active shifts.
- A restored session should load the account workspace without asking the user to log in again.
- Do not add social login, password reset, MFA, organization admin, or hospital admin flows in Phase 5.

## Story 3: Save Floor Templates to the Server

As a charge nurse, I want my reusable floor templates saved to my account so I can reuse them on another app install or device after logging in.

### Acceptance Criteria

- A signed-in charge nurse can create and edit floor templates using the existing Phase 1-2 template flow.
- Floor templates are saved to the server under the charge nurse account.
- The app loads the signed-in charge nurse's server floor templates after login.
- Template structure remains separate from shift-specific patient, acuity, nurse, assignment, request, and break data.
- Existing local template validation still applies.

### Validation and Edge Cases

- A charge nurse sees only their own templates.
- A regular nurse cannot create, edit, or list charge nurse floor templates.
- A save failure keeps the local screen usable and shows a retry path.
- Server templates should not store invite tokens, realtime channel IDs, push tokens, offline queue records, or drag-and-drop override history.

## Story 4: Save Active Shifts to the Server

As a charge nurse, I want active shift setup, assignment, requests, and break schedule data saved on the server so the shift is not trapped in one local app install.

### Acceptance Criteria

- A signed-in charge nurse can start a shift from a server floor template.
- Active shift data is saved to the server after meaningful changes.
- Server-backed changes use a request-then-refresh pattern: submit the change, then reload the relevant active-shift data before the next screen depends on it.
- Server active shift data includes the current Phase 1-4 shift shape: copied floor structure, nurses, bed states, assignment result, flags, local nurse requests, and break schedule.
- The charge nurse can reopen the app and restore the current active shift from the server.
- Ending a shift stores enough previous-shift snapshot data for carry-over suggestions.

### Validation and Edge Cases

- If a server save fails, the app shows an unsaved state and lets the charge nurse retry.
- If adding nurses succeeds, the next screen should show nurses fetched from the current server shift, not only the pre-submit local form array.
- If a restored active shift references a missing template, the app shows a recovery state.
- Existing assignment, local request, and break scheduling behavior still works after server persistence is added.
- Do not add realtime refresh, offline write queueing, conflict resolution, or push notifications in Phase 5.

## Story 5: Add Shift Access Boundaries

As a product owner, I want signed-in accounts to have safe shift-specific nurse access so later phases can safely add multi-device collaboration.

### Acceptance Criteria

- Each authenticated profile is charge-capable in Phase 5.
- Charge nurses can access the full charge nurse workspace for their own templates and shifts.
- A signed-in account can be linked to one nurse inside one active shift through a server access record.
- Joined nurse access can reach only nurse-facing assignment data for that linked nurse.
- If no shift access exists, the user sees a clear empty state from the joined nurse view.
- A signed-in account should have at most one active shift participation at a time. A joined user should leave before starting a charge shift or joining another shift.

### Validation and Edge Cases

- A joined user cannot load another nurse's full assignment by changing a backend `nurseId`.
- A charge nurse cannot accidentally create nurse-facing access without a future join-code flow.
- Shift access checks should happen at both the app UI boundary and the server authorization boundary.
- Do not add nurse invite links, deep link joins, realtime presence, or push notifications in Phase 5.

## Story 6: Replace Local Storage With Server Truth

As a learner, I want Phase 5 to remove the old local storage state path so the app has one clear source of truth after connecting to the server.

### Acceptance Criteria

- Phase 1 floor setup, assignment, board, census, imbalance flags, and unassigned-bed flags still work.
- Phase 2 reusable templates, active shift restore, and carry-over suggestions are backed by server storage instead of local app-state storage.
- Phase 3 nurse-facing assignment derivation and request records still use the active shift as their source of truth.
- Phase 4 break schedules still belong to the active shift.
- Fetched server data uses normal backend `id` fields for templates, shifts, nurses, rooms, beds, and relationships.
- Old local testing data does not need to be imported.
- The old local storage repository and local storage-backed state context are removed or bypassed for Phase 5 runtime flows.

### Validation and Edge Cases

- Existing locally saved testing data may be discarded because it was only used before server persistence.
- A new account with no server data should show an empty workspace state.
- A server account with templates but no active shift should still let the charge nurse start a shift.
- Phase 5 should not force a large rewrite of assignment, break scheduling, or nurse request logic.
