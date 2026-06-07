# Phase 2 Implementation Tasks

This task list builds local persistence and reuse in small, testable steps.

Phase 2 stays local-only. Do not add backend, auth, realtime collaboration, push notifications, deep links, regular nurse invite flow, multi-device collaboration, offline write queue/sync, AI, break scheduling, drag-and-drop assignment override, board sharing, or tablet layout.

Each task should be small enough for one focused Codex session. Each task includes a manual validation check that should be tested before moving on.

Status legend:

- Done
- No marker means not done yet.

## Build Order Summary

1. Confirm Phase 2 scope guardrails.
2. Add a small local storage boundary.
3. Persist and restore floor templates.
4. Reuse and edit saved templates.
5. Persist and restore active shifts.
6. Store previous-shift snapshots on end shift, keyed by floor template.
7. Review nurse and patient carry-over suggestions.
8. Run a full manual Phase 2 test pass.

## Setup Tasks

### Done Task 0.1: Confirm Phase 2 Scope Guardrails

Story coverage: US8

Build:

- Added `docs/phase-2/setup-notes.md` with a short implementation note that Phase 2 is local persistence only.
- Confirmed the current app routes remain Phase 1 charge nurse routes and have no planned screens for login, backend, sync status, invite links, regular nurse join, notifications, offline queue, AI, breaks, drag-and-drop, board sharing, or tablet layout.

Validation check:

- You can point to `docs/phases.md` and `docs/phase-2/setup-notes.md` and explain what Phase 2 includes and excludes before writing feature code.

### Done Task 0.2: Confirm Phase 1 Compatibility

Story coverage: US8

Build:

- Reviewed the existing Phase 1 local data model and screens.
- Identified which Phase 1 state needs to become persisted: floor templates, active shift, assignment result, and flags.
- Documented that `draftFloorTemplate` and `isEditingActiveShiftTemplate` should stay temporary workflow state.
- Confirmed Phase 2 persistence should not change assignment rules.

Validation check:

- You can explain which Phase 1 behaviors should work the same after persistence is added, using `docs/phase-2/setup-notes.md`.

## Local Storage Foundation

### Done Task 1.1: Add Phase 2 Persisted State Types

Story coverage: US1, US4, US5, US8

Build:

- Added TypeScript types for `PersistedLocalAppState`, `PreviousShiftSnapshot`, `NurseCarryOverSuggestion`, and `PatientCarryOverSuggestion`.
- Reused Phase 1 types for templates, shifts, nurses, patients, acuity, assignment results, and flags.
- Added a simple `storageVersion`.

Validation check:

- The app compiles with the new types.
- No backend, auth, sync, invite, or notification fields are introduced.

### Done Task 1.2: Add Local Storage Repository

Story coverage: US1, US4, US8

Build:

- Added one small storage boundary for loading and saving persisted app state.
- Kept serialization and parsing inside this boundary.
- Returned a safe empty state when no saved data exists.

Validation check:

- A manual or temporary debug call can load an empty persisted state without crashing.
- The storage helper can be explained as `load saved local state` and `save local state`.

### Done Task 1.3: Handle Invalid Saved Data Safely

Story coverage: US1, US4, US8

Build:

- Added a local recovery path for invalid or unreadable saved data.
- Avoided crashing if saved top-level app state is malformed.
- Kept the recovery message local and beginner-readable.

Validation check:

- Simulating invalid saved data resets safely to an empty persisted state.
- No server, account, sync, or conflict language appears.

## Floor Template Persistence

### Done Task 2.1: Save Completed Floor Templates

Story coverage: US1

Build:

- Save completed floor templates to local storage after creation.
- Save only reusable template structure.
- Keep Phase 1 validation before save.

Validation check:

- Create floor `4 North`, close and reopen the app, and confirm the template is still visible.
- Patient, nurse, acuity, assignment, and flag data are not stored on the template.

### Done Task 2.2: Load Saved Templates on App Start

Story coverage: US1

Build:

- Load saved floor templates when the app opens.
- Populate Local Workspace from persisted state.
- Keep the no-template empty state when none exist.

Validation check:

- Reopening the app shows saved templates.
- A fresh install or cleared local data still shows `No local floor yet`.

### Done Task 2.3: Prevent Duplicate Names Against Saved Templates

Story coverage: US1

Build:

- Update duplicate floor name validation to check saved templates.
- Compare trimmed names.

Validation check:

- If saved `4 North` exists, creating another `4 North` or ` 4 North ` shows duplicate validation.

## Template Reuse and Editing

### Done Task 3.1: Start Shift From a Saved Template

Story coverage: US2

Build:

- Let the charge nurse start a new shift from a saved template.
- Copy the template's doctor sides, rooms, and beds into active shift state.
- Keep the saved template unchanged.

Validation check:

- Starting a shift from `4 North` creates bed states for its saved beds.
- Editing patients or acuity in the shift does not change the saved template.

### Task 3.2: Add Template Edit Entry Point

Story coverage: US3

Build:

- Add an `Edit` action on saved template rows.
- Hide or disable editing while an active shift exists.
- Route to existing Phase 1 template setup screens in edit mode.

Validation check:

- With no active shift, a saved template can be opened for editing.
- With an active shift, editing is blocked with `End the active shift before editing templates.`

### Task 3.3: Save Template Edits Locally

Story coverage: US3

Build:

- Save edited template name, rooms, bed counts, doctor side names, and room-to-side assignments.
- Preserve existing Phase 1 validation.
- Allow cancel/back without changing the saved template.

Validation check:

- Rename a template, reopen the app, and confirm the new name persists.
- Cancel an edit and confirm the old template remains unchanged.

### Task 3.4: Validate Edited Templates Before Shift Start

Story coverage: US2, US3

Build:

- Block shift start if a saved template is incomplete or invalid.
- Route the charge nurse to review/fix the template when possible.

Validation check:

- A template with no rooms or missing doctor side assignment cannot start a shift.

## Active Shift Persistence

### Task 4.1: Save Active Shift Changes

Story coverage: US4

Build:

- Save active shift state after meaningful setup and board changes.
- Include shift status, admitting side, side load limits, nurses, bed states, assignment result, and flags.
- Keep persistence local to this device.

Validation check:

- Start a shift, add nurses and patients, close and reopen the app, and confirm the active shift is still available.

### Task 4.2: Restore Active Shift on App Start

Story coverage: US4

Build:

- Load the most recent active shift when the app opens.
- Show an active shift resume row on Local Workspace.
- Route setup shifts and assigned shifts to the appropriate screen.

Validation check:

- Reopening during setup resumes setup.
- Reopening after assignment resumes the board with assignment results visible.

### Task 4.3: Handle Missing Template for Restored Shift

Story coverage: US4, US8

Build:

- Detect when a restored active shift references a missing saved template.
- Show a local recovery message instead of crashing.

Validation check:

- Simulating a missing template shows a clear recovery path.

### Task 4.4: Keep End Shift Local While Preserving Templates

Story coverage: US5

Build:

- Keep the existing end-shift behavior local.
- Ensure ending a shift clears active shift state.
- Ensure saved floor templates remain available.

Validation check:

- End an active shift and confirm the active shift row disappears.
- Saved templates still appear on Local Workspace.

## Previous Shift Snapshot

### Task 5.1: Create Previous-Shift Snapshot on End Shift

Story coverage: US5

Build:

- Before clearing active shift, create a previous-shift snapshot for the active shift's template.
- Store nurse profile suggestions.
- Store occupied patient suggestions with previous bed and acuity.

Validation check:

- End a shift with nurses and occupied beds.
- Inspect the next shift setup and confirm suggestions are available only for the same template.

### Task 5.2: Keep One Snapshot Per Template

Story coverage: US5

Build:

- Replace the existing previous-shift snapshot for that template when a newer shift using the same template ends.
- Do not build a shift history list.
- Do not use snapshots from a different floor template for carry-over.

Validation check:

- End two shifts from the same template and confirm only the latest shift feeds carry-over suggestions.
- Start a shift from a different template and confirm it does not show those suggestions.

### Task 5.3: Allow Empty Previous-Shift Snapshots

Story coverage: US5

Build:

- Allow ending and snapshotting a shift even if it has no nurses or no patients.
- Show empty carry-over states later.

Validation check:

- End a shift with no patients and confirm the next shift does not crash or create fake patient suggestions.

## Carry-Over Review

### Task 6.1: Add Carry-Over Review Screen

Story coverage: US6, US7

Build:

- Add a screen that appears after Start Shift when a previous-shift snapshot exists.
- Show nurse suggestions and patient suggestions in separate sections.
- Default suggestions to pending review.

Validation check:

- Starting a new shift from a template with its own previous snapshot shows Carry-Over Review.
- Starting from a template with no snapshot skips Carry-Over Review or shows a small empty state.

### Task 6.2: Accept and Dismiss Nurse Suggestions

Story coverage: US6

Build:

- Let the charge nurse accept or dismiss each nurse suggestion.
- Convert accepted nurse suggestions into active shift nurses.
- Keep max patient load fresh for the new shift.

Validation check:

- Accept one nurse and dismiss another.
- Only the accepted nurse appears on Nurses.
- The accepted nurse still needs max patient load before assignment.

### Task 6.3: Accept and Dismiss Patient Suggestions

Story coverage: US7

Build:

- Let the charge nurse accept or dismiss each patient suggestion.
- Convert accepted patient suggestions into active shift bed states when the previous bed still exists.
- Keep patient info and acuity editable.

Validation check:

- Accept one patient and dismiss another.
- Only the accepted patient appears on Patients and Acuity.
- The accepted patient's acuity is editable before assignment.

### Task 6.4: Handle Carry-Over Patient Missing Previous Bed

Story coverage: US7

Build:

- If an accepted patient's previous bed no longer exists, mark the patient as needing a bed.
- Require bed selection or dismissal before assignment.

Validation check:

- Edit a template to remove a previous bed, then start a new shift.
- Accepted patient shows `Needs bed` and cannot reach assignment until resolved or dismissed.

### Task 6.5: Preserve Manual Add Flows

Story coverage: US6, US7

Build:

- Keep the existing Phase 1 manual nurse and patient add flows.
- Make accepted carry-over entries behave like normal editable shift data.

Validation check:

- After accepting suggestions, add a new nurse and new patient manually.
- Assignment uses both carried-over and manually added data.

## Manual Testing Pass

### Task 7.1: Floor Template Persistence Test

Build:

- No new feature work.
- Manually test saving, app restart, loading, editing, and reusing templates.

Validation check:

- Create a template.
- Reopen the app.
- Edit the template.
- Start a shift from the edited template.

### Task 7.2: Active Shift Restore Test

Build:

- No new feature work.
- Manually test restoring setup and assigned shifts.

Validation check:

- Reopen during setup and resume the setup.
- Reopen after assignment and resume the board.

### Task 7.3: Carry-Over Happy Path Test

Build:

- No new feature work.
- Manually test end shift and start next shift from the same template.

Validation check:

- Previous nurses appear as suggestions.
- Previous patients appear as suggestions.
- Accepted suggestions become editable shift data.
- Dismissed suggestions are not added.

### Task 7.4: Carry-Over Edge Case Test

Build:

- No new feature work.
- Manually test missing previous bed and empty previous-shift snapshots.

Validation check:

- A patient whose previous bed was removed shows `Needs bed`.
- Ending a shift with no nurses or patients does not crash the next setup.

### Task 7.5: Local-Only Scope Test

Build:

- No new feature work.
- Review implementation for scope leaks.

Validation check:

- There are no Phase 2 screens, dependencies, or data fields for backend, auth, realtime, push notifications, deep links, invite links, regular nurse devices, offline sync queues, AI, breaks, drag-and-drop, board sharing, or tablet layout.

### Task 7.6: Beginner Readability Pass

Build:

- Refactor only if needed for clarity.
- Keep storage and carry-over names close to the Phase 2 data model.
- Remove abstractions that make local persistence hard to explain.

Validation check:

- A beginner can explain where saved templates, active shift state, and previous-shift snapshots live.

## Later, Not Phase 2

Save these for future phases:

- Simulated regular nurse view.
- Role switching.
- Mock issue flags and swap requests.
- Break scheduling.
- Backend and auth.
- Server persistence.
- Realtime collaboration.
- Nurse invite links and deep links.
- Push notifications.
- Offline sync queue.
- Drag-and-drop assignment override.
- Board snapshot sharing.
- Tablet layout.
- AI or external assignment services.
