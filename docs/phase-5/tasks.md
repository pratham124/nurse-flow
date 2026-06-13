# Phase 5 Implementation Tasks

This task list plans backend, auth, and server-side persistence in small, testable steps.

Phase 5 adds real accounts and server storage. Do not add realtime collaboration, nurse invite links, deep links, push notifications, offline write queues, drag-and-drop assignment override, board snapshot sharing, tablet layout, AI, organization admin, or hospital admin features.

Each task should be small enough for one focused Codex session. Each task includes a manual validation check that should be tested before moving on.

Status legend:

- Done
- No marker means not done yet.

## Build Order Summary

1. Confirm Phase 5 scope guardrails.
2. Choose and document backend approach.
3. Add auth/session model boundaries.
4. Add secure Supabase client session storage.
5. Add signup, login, session restore, and sign out.
6. Add server profile and role records.
7. Add server floor template persistence.
8. Add server active shift persistence.
9. Add server previous-shift snapshot persistence.
10. Add role-gated regular nurse access boundary.
11. Add authorization checks.
12. Run a full manual Phase 5 test pass.

## Setup Tasks

### Done Task 0.1: Create Phase 5 Planning Docs

Story coverage: US1, US2, US3, US4, US5, US6

Build:

- Added Phase 5 planning docs for user stories, data model, mobile design, screens, and implementation tasks.
- Confirmed Phase 5 is backend, auth, and server persistence based on `docs/phases.md`.
- Preserved Phase 1 assignment, Phase 2 local persistence and carry-over, Phase 3 local nurse simulation and requests, and Phase 4 local break scheduling in the plan.
- Kept realtime collaboration, nurse invite links, deep links, push notifications, offline sync queues, drag-and-drop, board sharing, tablet layout, and AI out of Phase 5.

Validation check:

- You can point to `docs/phases.md` and `docs/phase-5/` and explain what Phase 5 includes and excludes before writing feature code.

### Done Task 0.2: Choose Backend Approach

Story coverage: US1

Build:

- Added `docs/phase-5/backend-decision.md` as the Phase 5 backend decision note.
- Chose Supabase Auth for email/password auth and Supabase Postgres for server persistence.
- Documented the required client-safe environment variables.
- Documented why Supabase Realtime is not enabled in Phase 5.
- Documented the ID rule: normal backend records use one `id` field, and old local IDs are import-only metadata.
- Documented local setup and reset expectations for beginner-friendly testing.

Validation check:

- You can explain why the chosen backend is enough for auth and server persistence.
- You can explain which provider features are intentionally deferred to later phases.
- No app implementation code is written in this task.

### Done Task 0.3: Confirm Existing App Touchpoints

Story coverage: US6

Build:

- Added `docs/phase-5/app-touchpoints.md`.
- Reviewed current routes, screens, state, storage, and helper files before writing Phase 5 feature code.
- Identified where auth/session state should live.
- Identified where server service or repository functions should live.
- Identified which existing local persistence paths will be replaced by server persistence.
- Identified that a temporary legacy import helper is likely needed for old local data.

Validation check:

- You can list the likely implementation files before coding starts.
- Existing Phase 1-4 behavior is not changed in this task.

## Auth and Session

### Task 1.1: Add Auth and Profile Types

Story coverage: US2, US5

Build:

- Add types for auth status, user role, user profile, and server save status.
- Keep auth state separate from active shift state.
- Use named prop types for new React components when implementation begins.
- Do not add organization, hospital, MFA, social login, invite, or push notification fields.

Validation check:

- TypeScript compiles.
- Existing local shift, assignment, request, and break schedule types still compile.

### Task 1.2: Add Session Gate

Story coverage: US2, US5

Build:

- Add a simple session gate that checks whether a user is signed in.
- Add the Supabase client setup with secure native session storage.
- Store Supabase session tokens in Expo SecureStore on native iOS and Android when available.
- Avoid plain AsyncStorage for native auth tokens unless a documented platform limitation forces a fallback.
- Route signed-out users to auth screens.
- Route charge nurse users to the charge nurse workspace.
- Route regular nurse users to the regular nurse workspace.
- Show a setup error if backend configuration is missing.
- Show a safe signed-out or setup-recovery state if secure session storage cannot be read.

Validation check:

- Signed-out state opens Login.
- Signed-in charge nurse state opens the charge nurse workspace.
- Signed-in regular nurse state opens the regular nurse workspace.
- Missing setup shows a readable message instead of a crash.
- Secure storage read failure does not crash the app.

### Task 1.3: Add Signup Screen

Story coverage: US2, US5

Build:

- Add a beginner-friendly signup screen with display name, email, and password.
- Create the backend auth user.
- Create the matching app profile record.
- Default to charge nurse role unless manual regular-nurse role testing is explicitly needed.
- Show plain validation and backend error messages.

Validation check:

- A new charge nurse account can be created.
- Invalid email and weak password are handled.
- A profile record exists after signup.

### Task 1.4: Add Login Screen

Story coverage: US2

Build:

- Add email/password login.
- Show loading and error states.
- Load the app profile after login.
- Navigate by role after successful login.

Validation check:

- Valid credentials sign in.
- Wrong password shows a readable error.
- The correct workspace opens after login.

### Task 1.5: Add Session Restore and Sign Out

Story coverage: US2

Build:

- Restore an existing session when the app opens.
- Keep the user signed in across app restarts.
- Add sign out from account workspace screens.
- Delete the stored Supabase session from secure storage on sign out.
- Clear account-specific in-memory state on sign out.
- Never store raw passwords, Supabase secret keys, or service role keys in app storage.

Validation check:

- Close and reopen the app after login.
- Confirm the session restores.
- Sign out and confirm protected screens return to Login.
- Sign out, close and reopen the app, and confirm the session does not restore.
- Review the Supabase client setup and confirm native token storage uses SecureStore, not plain AsyncStorage.

## Server Workspace

### Task 2.1: Add Server Workspace Loader

Story coverage: US3, US4, US6

Build:

- Add a small workspace-loading boundary for the signed-in charge nurse.
- Load profile, server floor templates, active shift, and previous-shift snapshots.
- Show loading, empty, and error states.
- Keep screen code from calling backend APIs directly in many places.

Validation check:

- A new account shows an empty workspace.
- A load failure shows retry.
- Existing local-only helpers are not rewritten.

### Task 2.2: Add Server Floor Template Save

Story coverage: US3, US6

Build:

- Save created and edited floor templates to the server.
- Store reusable template structure only.
- Use backend `id` fields in fetched template records.
- Show save status and retry on failure.

Validation check:

- Create a template, reload the app, and confirm the template returns from the server.
- Edit a template outside an active shift and confirm the server copy updates.
- Confirm patient, nurse, assignment, request, and break data are not stored on the template.

### Task 2.3: Add Server Floor Template List and Empty State

Story coverage: US3

Build:

- Show the signed-in charge nurse's server floor templates.
- Show an empty state for a new account.
- Prevent regular nurse users from listing charge nurse templates.

Validation check:

- Charge nurse sees only their templates.
- Regular nurse does not see template management.
- Empty account state is clear and usable.

## Server Active Shift Persistence

### Task 3.1: Start Shift From Server Template

Story coverage: US4, US6

Build:

- Start a shift from a server floor template.
- Create a server active shift record.
- Preserve the existing copied floor structure inside the active shift snapshot, using fetched backend IDs.
- Keep local assignment inputs and validation behavior unchanged.

Validation check:

- Start a shift from a server template.
- Confirm the shift opens through the existing setup flow.
- Confirm the server active shift can be loaded again.

### Task 3.2: Save Active Shift Changes

Story coverage: US4, US6

Build:

- Save meaningful active shift changes to the server.
- Include nurses, bed states, assignment result, flags, nurse requests, and break schedule when present.
- Use the general mutation pattern: submit the focused server request, then refresh the relevant active-shift data from the backend before the next screen depends on it.
- Show `Saving`, `Saved to account`, and `Save failed` states.
- Add retry for failed saves.

Validation check:

- Add nurses, go to the next screen, and confirm the UI shows nurses fetched for the current server shift.
- Add nurses and patients, reload, and confirm they restore.
- Run assignment, reload, and confirm assignment result and flags restore.
- Submit local requests and generate breaks, reload, and confirm they restore.

### Task 3.2a: Add Server-Backed Nurse Save and Refresh

Story coverage: US4, US6

Build:

- When the charge nurse finishes adding nurses for the current shift, send the nurse changes to the backend for that shift.
- After the request succeeds, fetch the current shift's nurses or refreshed active shift snapshot.
- Fill the next screen from the fetched server data.
- Keep temporary form state local only until submit.
- Show a readable retry state if the nurse save fails.

Validation check:

- Add one nurse, continue, and confirm the next screen shows that nurse from the fetched current shift.
- Add multiple nurses, continue, and confirm the fetched list matches the backend.
- Force or simulate a failed save and confirm the app does not navigate as if the nurses were saved.

### Task 3.3: Restore Server Active Shift on App Open

Story coverage: US2, US4, US6

Build:

- After session restore, load the active shift from the server.
- Return the charge nurse to the right workspace state.
- Show recovery if the active shift references missing or invalid data.

Validation check:

- Close and reopen the app during setup state.
- Close and reopen the app after assignment.
- Confirm the app does not lose the active shift.

### Task 3.4: Save Previous-Shift Snapshot to Server

Story coverage: US4, US6

Build:

- When ending a shift, save the carry-over snapshot to the server.
- Preserve existing nurse and patient suggestion behavior.
- Keep only the most recent useful snapshot per floor template unless a later task decides otherwise.

Validation check:

- End a shift and start another shift on the same template.
- Confirm nurse and patient carry-over suggestions appear from server data.
- Confirm request history and break schedules are not treated as carry-over suggestions.

## Roles and Authorization

### Task 4.1: Add Role-Gated Charge Nurse Workspace

Story coverage: US5

Build:

- Protect charge nurse workspace screens with a charge nurse role check.
- Show access recovery if a regular nurse reaches a charge nurse route.
- Keep checks simple and visible in the navigation/session boundary.

Validation check:

- Charge nurse can open the workspace.
- Regular nurse cannot open the charge nurse board or template management screens.

### Task 4.2: Add Regular Nurse Workspace Empty State

Story coverage: US5

Build:

- Add a regular nurse workspace for signed-in regular nurse accounts.
- Show `No shift access yet` when no access record is linked.
- Keep the message clear that invite/join behavior comes later.

Validation check:

- Regular nurse login opens the regular nurse workspace.
- With no linked access, no charge nurse data is visible.
- No invite link or deep link UI appears.

### Task 4.3: Add Shift Nurse Access Records

Story coverage: US5

Build:

- Add a minimal server access record that links a regular nurse profile to one nurse inside one shift snapshot.
- Keep this as an authorization preparation step, not an invite flow.
- Allow manual test setup if needed.

Validation check:

- A linked regular nurse can load only their own assignment view.
- A regular nurse cannot load another nurse's assignment by changing a backend `nurseId`.
- A removed or stale access record shows a safe recovery state.

### Task 4.4: Add Server Authorization Checks

Story coverage: US3, US4, US5

Build:

- Enforce ownership checks for charge nurse templates and shifts.
- Enforce nurse-scoped reads for regular nurse assignment views.
- Treat server authorization failures as safe UI states.

Validation check:

- Charge Nurse A cannot see Charge Nurse B's templates or shifts.
- Regular nurse cannot read a full active shift snapshot.
- Signed-out user cannot read or write server data.

## Local-to-Server Compatibility

### Task 5.1: Add Manual Import Path for Existing Local Data

Story coverage: US6

Build:

- If local Phase 1-4 data exists after login, offer a clear manual import path.
- Import floor templates, active shift, and previous-shift snapshots only after the charge nurse confirms.
- Convert old local IDs into normal backend `id` fields during import.
- Keep any old-to-new ID mapping inside the import helper only.
- Do not silently delete local data.

Validation check:

- Existing local data is detected.
- Declining import leaves local data untouched.
- Confirming import creates server records that can be loaded after app restart.

### Task 5.2: Review Previous Phase Workflows

Story coverage: US6

Build:

- Manually walk through Phase 1-4 core flows against server-backed state.
- Fix only compatibility issues that block the existing flow.
- Avoid refactors unrelated to server persistence.

Validation check:

- Create/edit template works.
- Start shift and carry-over works.
- Assignment and flags work.
- Simulated nurse requests work.
- Break schedule works.

## Manual Testing Pass

### Task 6.1: Auth Manual Test

Build:

- No new feature work.
- Manually test signup, login, session restore, and sign out.

Validation check:

- Signup creates a profile.
- Login restores the correct role.
- App reopen keeps the session.
- Sign out protects workspace screens.

### Task 6.2: Server Template Manual Test

Build:

- No new feature work.
- Manually test server floor template persistence.

Validation check:

- Create a template.
- Restart the app.
- Confirm the template loads from the server.
- Confirm regular nurse role cannot manage templates.

### Task 6.3: Server Active Shift Manual Test

Build:

- No new feature work.
- Manually test server active shift persistence.

Validation check:

- Start a shift.
- Add nurses, patients, and acuity.
- Run assignment.
- Restart the app.
- Confirm shift, assignment, flags, requests, and breaks restore.

### Task 6.4: Role Authorization Manual Test

Build:

- No new feature work.
- Manually test charge nurse and regular nurse boundaries.

Validation check:

- Charge nurse sees full workspace.
- Regular nurse does not see the full board.
- Linked regular nurse sees only their own assignment view.
- Unlinked regular nurse sees `No shift access yet`.

### Task 6.5: Previous Phase Compatibility Test

Build:

- No new feature work.
- Manually test Phase 1-4 behavior after Phase 5 changes.

Validation check:

- Template setup still works.
- Carry-over still works.
- Assignment still works.
- Local request flow still works.
- Break scheduling still works.

### Task 6.6: Phase 5 Scope Test

Build:

- No new feature work.
- Review implementation for scope leaks.

Validation check:

- There are no Phase 5 screens, dependencies, data fields, or service calls for realtime collaboration, nurse invite links, deep links, push notifications, offline write queues, drag-and-drop assignment override, board snapshot sharing, tablet layout, or AI.

### Task 6.7: Beginner Readability Pass

Build:

- Refactor only if needed for clarity.
- Keep auth, profile loading, server template saving, active shift saving, and role checks explainable.
- Remove abstractions that make the first backend phase harder to understand.

Validation check:

- A beginner can explain how login leads to a profile, how templates are saved, how active shifts are saved, and why regular nurses cannot see the charge nurse board.

## Later, Not Phase 5

Save these for future phases:

- Realtime collaboration.
- Nurse invite links.
- Deep link handling.
- Push notifications.
- Offline write queue and conflict handling.
- Drag-and-drop assignment override.
- Board snapshot sharing.
- Tablet layout.
- AI-assisted staffing or acuity suggestions.
- Hospital or organization admin tools.
