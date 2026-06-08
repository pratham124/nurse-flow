# Phase 2 Setup Notes

Phase 2 adds local persistence to the existing local charge nurse prototype. It should make the Phase 1 workflow reusable across app launches and across shifts without changing the assignment workflow or adding later-phase infrastructure.

## Scope Guardrails

Phase 2 includes setup needed for:

- saving completed floor templates locally
- loading saved floor templates when the app opens
- starting shifts from saved templates
- editing saved templates only outside an active shift
- saving and restoring the active shift locally
- storing the most recent previous-shift snapshot for each floor template
- showing nurse and patient carry-over suggestions from the most recent ended shift that used the same floor template

Phase 2 does not include planned screens or implementation for:

- login, signup, auth, or user accounts
- backend or server persistence
- realtime status or multi-device collaboration
- push notifications or notification inboxes
- deep links or nurse invite links
- regular nurse join flows or role switching
- offline write queues or sync conflict handling
- AI suggestions or assignment services
- break scheduling
- drag-and-drop assignment override
- board snapshot sharing
- tablet-specific layout

These guardrails match `docs/phases.md`, `docs/phase-2/user-stories.md`, `docs/phase-2/screens.md`, and `docs/phase-2/tasks.md`.

## Current Phase 1 Compatibility Review

The current app already has a Phase 1 local state shape in `src/types/models.ts`:

- `floorTemplates`
- `draftFloorTemplate`
- `activeShift`

For Phase 2 persistence, the state that should be saved is:

- `floorTemplates`, because templates are reusable floor structure
- `activeShift`, because the current shift should restore after app close
- `activeShift.assignmentResult`, because an assigned board should reopen as assigned
- `activeShift.flags`, because restored assignment warnings should remain visible
- `previousShiftSnapshots`, added in Phase 2, because carry-over suggestions need the most recent ended shift per floor template

The state that should stay temporary is:

- `draftFloorTemplate`, because it is an in-progress editing object

The current app routes in `src/app` are still the Phase 1 charge nurse screens:

- Local Workspace
- Floor Details
- Rooms and Beds
- Doctor Sides
- Template Review
- Start Shift
- Nurses
- Patients and Acuity
- Assignment Review
- Floor Board
- Flags

Phase 2 should extend this set only where the Phase 2 docs require it, such as adding Carry-Over Review and Local Recovery later. It should not add future-phase account, nurse invite, realtime, notification, offline sync, break, drag-and-drop, sharing, or tablet screens.

## Assignment Compatibility

Phase 2 should not change assignment rules.

The existing Phase 1 assignment utilities should continue to receive the same kind of `Shift` data:

- doctor sides
- rooms
- beds
- side load limits
- nurses
- bed states
- acuity
- assignment result
- flags

Persistence should restore the inputs and outputs around assignment. It should not rebalance differently, add AI, call a backend, create nurse accounts, or introduce server-side assignment IDs.

## Manual Validation Notes

Before writing Phase 2 feature code, the setup tasks are considered complete when:

- The Phase 2 scope can be explained from `docs/phases.md` and this setup note.
- Current app routes are confirmed to be Phase 1 charge nurse routes only.
- The Phase 1 state that needs persistence is identified.
- Temporary draft state is separated from persisted product state.
- Assignment behavior is explicitly preserved.
