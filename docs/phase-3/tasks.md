# Phase 3 Implementation Tasks

This task list builds local nurse view simulation in small, testable steps.

Phase 3 stays local-only. Do not add real auth, real nurse accounts, backend, server persistence, realtime collaboration, push notifications, deep links, invite links, multi-device nurse joins, offline sync queues, AI, break scheduling, drag-and-drop assignment override, board sharing, or tablet layout.

Each task should be small enough for one focused Codex session. Each task includes a manual validation check that should be tested before moving on.

Status legend:

- Done
- No marker means not done yet.

## Build Order Summary

1. Confirm Phase 3 scope guardrails.
2. Add local simulated role state.
3. Add simulated nurse picker.
4. Add simulated nurse assignment view.
5. Add local nurse request data types.
6. Add mock issue submission.
7. Add mock swap request submission.
8. Update charge nurse request review.
9. Accept or decline mock swap requests locally.
10. Run a full manual Phase 3 test pass.

## Setup Tasks

### Done Task 0.1: Create Phase 3 Planning Docs

Story coverage: US1, US2, US3, US4, US5, US6, US7

Build:

- Added Phase 3 planning docs for user stories, data model, mobile design, screens, and implementation tasks.
- Confirmed Phase 3 is local nurse view simulation only.
- Preserved Phase 1 charge nurse assignment behavior and Phase 2 local persistence behavior in the plan.

Validation check:

- You can point to `docs/phases.md` and `docs/phase-3/` and explain what Phase 3 includes and excludes before writing feature code.

### Done Task 0.2: Confirm Current App Compatibility

Story coverage: US7

Build:

- Reviewed current Phase 1 and Phase 2 routes, state, storage, and flag screens.
- Identified where simulated nurse screens can connect without changing assignment rules.
- Confirmed mock issue and swap request records should live on optional `activeShift.nurseRequests` in a later task.
- Added `docs/phase-3/setup-notes.md` with compatibility notes and likely future file touchpoints.

Validation check:

- You can explain which existing files will likely change before implementation starts, using `docs/phase-3/setup-notes.md`.
- No implementation code was written in this task.

## Local Role Simulation

### Done Task 1.1: Add Simulated Role State

Story coverage: US1, US7

Build:

- Added local state for the current simulated role: charge nurse or regular nurse.
- Added local state for selected simulated nurse ID.
- Kept this state separate from real auth and persisted user accounts.

Validation check:

- App starts in charge nurse mode.
- Selecting regular nurse mode does not require login or invite links.
- Clearing the selected nurse returns to charge nurse mode or nurse selection.

### Done Task 1.2: Clear Invalid Simulated Nurse Selection

Story coverage: US1, US7

Build:

- Detect when the selected simulated nurse no longer exists in the active shift.
- Clear the selection safely.
- Return to charge view when the active shift no longer supports regular nurse simulation, or keep regular nurse mode ready for the future nurse picker when only the selected nurse is invalid.

Validation check:

- Simulated nurse state clears safely if the active shift is missing or has no nurses.
- Invalid selected nurse IDs are cleared without crashing.

### Done Task 1.3: Add Floor Board Role Switch Entry

Story coverage: US1

Build:

- Added a compact `View as nurse` entry from the charge nurse Floor Board.
- Enabled it only when an active assigned shift has assignment results and nurses.
- Used local simulation language.

Validation check:

- On an assigned shift, `View as nurse` is available.
- During setup or before assignment, `View as nurse` is disabled with a clear local message.

## Simulated Nurse Picker

### Done Task 2.1: Add Simulated Nurse Picker Screen

Story coverage: US1, US2

Build:

- Added a screen listing active-shift nurses.
- Show nurse name, license type, experience, assigned bed count, and room coverage summary.
- Let the tester select one nurse to simulate.
- Kept the actual nurse assignment detail view for the next Phase 3 task.

Validation check:

- A shift with two nurses shows both nurses.
- Selecting one nurse marks that nurse as selected for local simulation.

### Done Task 2.2: Handle Picker Empty States

Story coverage: US1, US2

Build:

- Show clear local empty states for no active shift, no nurses, or missing assignment result.
- Route back to Floor Board when the picker cannot continue.

Validation check:

- Opening nurse simulation before assignment shows `Run assignment before opening nurse view.`
- Opening with no nurses shows `Add nurses before opening nurse view.`

## Simulated Nurse Assignment

### Done Task 3.1: Derive Selected Nurse Assignment Data

Story coverage: US2, US7

Build:

- Added a small helper that derives the selected nurse's view from active shift data.
- Filtered `assignmentResult.bedAssignments` by selected nurse ID.
- Joined assigned beds to rooms, doctor sides, bed states, patient info, and acuity.
- Derived room coverage from `assignmentResult.roomCoverage`.

Validation check:

- For a known assignment, the selected nurse sees only their own assigned beds.
- Other nurses' assigned beds are not shown.

### Done Task 3.2: Add Simulated Nurse Assignment Screen

Story coverage: US2

Build:

- Added the regular nurse assignment screen.
- Show selected nurse summary, room coverage, assigned beds, patient info, and acuity.
- Included disabled `Flag issue` and `Request swap` actions as placeholders for later Phase 3 request-form tasks.

Validation check:

- Select a nurse and confirm the screen shows name, license, experience, rooms, beds, patient info, and acuity.
- Empty assigned beds display safely as empty.

### Done Task 3.3: Add Nurse Assignment Empty and Recovery States

Story coverage: US2, US7

Build:

- Handled selected nurse with no assigned beds.
- Handled missing active shift, missing assignment result, and missing selected nurse.
- Skipped invalid bed references safely and surfaced a local warning count.

Validation check:

- A nurse with no assigned beds sees `No assigned beds for this nurse yet.`
- Invalid or missing assignment data does not crash the screen.

## Local Request Model

### Done Task 4.1: Add Local Nurse Request Types

Story coverage: US3, US4, US5, US6, US7

Build:

- Added TypeScript types for request status, request type, and nurse request records.
- Kept request records local and serializable.
- Stored requester ID, requester name, message, created timestamp, status, and optional bed context.
- Avoided account IDs, invite tokens, push tokens, server IDs, sync metadata, and offline queue fields.

Validation check:

- TypeScript compiles.
- No account IDs, invite tokens, push tokens, server IDs, sync metadata, or offline queue fields are added.

### Done Task 4.2: Store Nurse Requests on Active Shift

Story coverage: US3, US4, US5, US7

Build:

- Added an optional nurse requests array to active shift state.
- Defaulted missing request arrays to empty in helper logic.
- Initialized new active shifts with an empty local request list.
- Kept active shift persistence on the existing local JSON save and restore path.

Validation check:

- A restored Phase 2 shift with no nurse requests still loads.
- Creating a request and reopening the app restores the active shift request locally if active shift persistence is enabled.

## Mock Issue Flags

### Done Task 5.1: Add Mock Issue Form

Story coverage: US3

Build:

- Added a form for selected nurse issue messages.
- Allowed optional bed context from that nurse's assigned beds.
- Blocked blank messages with `Add a short issue description.`

Validation check:

- Submitting an issue with a message succeeds.
- Blank message shows `Add a short issue description.`

### Done Task 5.2: Save Mock Issue Requests Locally

Story coverage: US3, US5

Build:

- Converted submitted issue forms into local nurse request records with `type: 'issue'`.
- Stored requesting nurse ID, requester name, message, timestamp, status, and optional source bed.
- Returned to the simulated nurse assignment screen after submit.
- Added selected nurse local issue history on the simulated nurse assignment screen.

Validation check:

- Submit an issue from one nurse.
- Return to the same nurse view and confirm the request appears in local request history.

### Done Task 5.3: Prevent Issue Requests for Other Nurses' Beds

Story coverage: US3, US7

Build:

- Limited issue bed selection to the selected nurse's assigned beds.
- Validated the selected bed before saving.

Validation check:

- A nurse cannot submit an issue for another nurse's assigned bed.

## Mock Swap Requests

### Done Task 6.1: Add Mock Swap Form

Story coverage: US4

Build:

- Add a form for selected nurse swap requests.
- Require source bed from the selected nurse's assigned beds.
- Require a short reason.
- Keep optional target selection simple or defer it.

Validation check:

- Missing source bed shows `Choose the bed you want to swap.`
- Blank reason shows `Add a short reason for the request.`

### Done Task 6.2: Save Mock Swap Requests Locally

Story coverage: US4, US5

Build:

- Convert submitted swap forms into local nurse request records with `type: 'swap'`.
- Set new swap requests to `status: 'pending'`.
- Return to the simulated nurse assignment screen after submit.

Validation check:

- Submit a swap request and confirm it appears as pending in the nurse's local request history.

### Done Task 6.3: Prevent Swap Requests for Other Nurses' Beds

Story coverage: US4, US7

Build:

- Limit source bed selection to the selected nurse's assigned beds.
- Validate the selected source bed before saving.

Validation check:

- A nurse cannot request a swap for another nurse's assigned bed.

## Charge Nurse Request Review

### Done Task 7.1: Update Flags Screen for Local Requests

Story coverage: US3, US4, US5

Build:

- Update the existing Flags screen or add a closely related local request section.
- Show assignment-generated flags separately from mock nurse requests.
- Show mock issues and mock swaps with type and status chips.

Validation check:

- Existing imbalance and unassigned-bed flags still appear.
- Mock issue and swap requests appear without replacing existing flags.

### Done Task 7.2: Add Request Empty States

Story coverage: US5

Build:

- Show `No flags or local requests yet` when there are no assignment flags and no nurse requests.
- Show local-only labels for mock requests.

Validation check:

- A clean assigned shift with no flags or requests shows the empty state.
- No notification, invite, sync, or server language appears.

### Task 7.3: Add Request Detail View If Needed

Story coverage: US5, US6

Build:

- Add a small detail view only if rows become too dense.
- Show requester, bed context, message, timestamp, and status.
- Keep actions available only for pending swap requests.

Validation check:

- Opening a request detail shows the correct local request data.
- Already resolved requests do not show active decision controls.

## Mock Swap Decisions

### Task 8.1: Decline Mock Swap Request

Story coverage: US6

Build:

- Add a decline action for pending mock swap requests.
- Set status to `declined`.
- Store a local resolved timestamp.

Validation check:

- Declining a pending swap updates the status to declined.
- Declined requests cannot be declined again.

### Task 8.2: Accept Mock Swap Request Without Reassignment

Story coverage: US6, US7

Build:

- Add an accept action for pending mock swap requests.
- Set status to `accepted`.
- Store a local resolved timestamp.
- Do not move bed assignments yet unless a later task explicitly adds a simple deterministic reassignment.

Validation check:

- Accepting a pending swap updates the status to accepted.
- Bed assignments remain unchanged and understandable.

### Task 8.3: Show Request Status to Simulated Nurse

Story coverage: US6

Build:

- Show accepted or declined status in the selected nurse's local request history.
- Keep pending requests visible.

Validation check:

- Submit a swap as a nurse, accept it as charge nurse, return to the nurse view, and confirm status is accepted.
- Repeat with decline and confirm status is declined.

## Manual Testing Pass

### Task 9.1: Role Switching Test

Build:

- No new feature work.
- Manually test switching between charge nurse and simulated regular nurse views.

Validation check:

- Start from an assigned floor board.
- Open `View as nurse`.
- Select a nurse.
- Return to charge nurse view.

### Task 9.2: Nurse Assignment Visibility Test

Build:

- No new feature work.
- Manually test that selected nurses see only their own assignment.

Validation check:

- Use at least two nurses with different assigned beds.
- Confirm Nurse A cannot see Nurse B's assigned beds.
- Confirm Nurse B cannot see Nurse A's assigned beds.

### Task 9.3: Mock Issue Test

Build:

- No new feature work.
- Manually test mock issue submission and charge nurse review.

Validation check:

- Submit an issue from the simulated nurse view.
- Return to charge nurse view.
- Confirm the issue appears in local request review.

### Task 9.4: Mock Swap Request Test

Build:

- No new feature work.
- Manually test mock swap submission and status updates.

Validation check:

- Submit a pending swap request.
- Accept one swap request and confirm status changes to accepted.
- Submit another swap request, decline it, and confirm status changes to declined.

### Task 9.5: Previous Phase Compatibility Test

Build:

- No new feature work.
- Manually test Phase 1 and Phase 2 behavior after Phase 3 changes.

Validation check:

- Create or reuse a saved template.
- Start a shift.
- Accept carry-over suggestions if available.
- Run assignment.
- View Floor Board and existing assignment flags.
- End shift and confirm local persistence behavior still works.

### Task 9.6: Local-Only Scope Test

Build:

- No new feature work.
- Review implementation for scope leaks.

Validation check:

- There are no Phase 3 screens, dependencies, or data fields for auth, backend, realtime, push notifications, deep links, invite links, multi-device joins, offline sync queues, AI, breaks, drag-and-drop, board sharing, or tablet layout.

### Task 9.7: Beginner Readability Pass

Build:

- Refactor only if needed for clarity.
- Keep role simulation, nurse assignment derivation, and request state easy to explain.
- Remove abstractions that make the local simulation harder to understand.

Validation check:

- A beginner can explain how the app chooses a simulated nurse, filters assignments, stores mock requests, and updates request status.

## Later, Not Phase 3

Save these for future phases:

- Break scheduling.
- Real backend and auth.
- Server persistence.
- Real charge nurse and regular nurse roles.
- Realtime collaboration.
- Nurse invite links and deep links.
- Push notifications.
- Offline sync queue.
- Drag-and-drop assignment override.
- Board snapshot sharing.
- Tablet layout.
- AI or external assignment services.
