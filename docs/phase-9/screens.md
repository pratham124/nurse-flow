# Phase 9 Screens and Flows

This document maps the production optimizer onto the existing NurseFlow routes.
It describes screens and states only; it does not prescribe implementation code.

## Navigation Summary

```text
Assignment Review
  -> Run assignment
  -> Authenticated Python optimizer request
  -> Supabase prepare -> OR-Tools solve -> atomic finalization
  -> Existing Charge Floor Board

Assignment Review with an existing baseline
  -> Rerun assignment
  -> Existing clear-moves confirmation when needed
  -> Authenticated Python optimizer request
  -> Supabase prepare -> OR-Tools solve -> atomic finalization
  -> Existing Charge Floor Board

Backend stale or failure result
  -> Refresh current shift
  -> Remain on Assignment Review
```

No optimizer settings route, run-history route, report route, or joined-nurse
optimizer route is added.

## 1. Assignment Review

### Purpose

Let the charge nurse verify current shift inputs, resolve validation blockers,
and request the first production assignment or a safe rerun.

### Existing Content Preserved

- Current floor and census.
- Admitting doctor side and side-based load limits.
- Nurse list with license, experience, and max patient load.
- Assignment need summary and validation blockers.
- `Run assignment` or `Rerun assignment` primary action.
- Warning when active manual moves would be cleared by a successful rerun.

### Phase 9 Changes

- The primary action invokes the authenticated backend optimizer instead of
  generating `nextShift.assignmentResult` on the phone.
- The mobile screen talks only to the Python service's typed action endpoint; it
  does not call OR-Tools or the protected finalization action directly.
- The screen owns one in-flight request state and prevents duplicate presses.
- The screen handles saved, stale, invalid-input, timeout, unavailable, and
  failed service outcomes.
- Current server state reloads before retrying a stale run.
- The screen routes to the existing board only after the committed shift has
  been refreshed.

### States

- No active shift: use existing recovery navigation.
- Setup incomplete: show existing blockers; do not invoke the optimizer.
- Ready for initial assignment.
- Ready for rerun with no active moves.
- Rerun requires clear-moves confirmation.
- Calculating and saving.
- Saved and refreshing current server state.
- Stale input; refreshed review required.
- Timed out; nothing saved.
- Optimizer unavailable; nothing saved.
- Unexpected failure or invalid server output; nothing saved.
- Disconnected or reconnecting; action disabled under existing connection rules.

### Actions

- Review or return to earlier setup inputs.
- Run assignment.
- Rerun assignment.
- Retry after current state is refreshed.
- Cancel the active-moves confirmation.

There is no cancel-in-flight requirement in Phase 9. Closing a screen must not
make an already committed server result disappear; returning later reloads the
authoritative shift.

### Manual Checks

- First assignment reaches the existing floor board with a new server result ID.
- Double-tapping creates one run and one baseline.
- A normal mobile session cannot bypass the Python service and finalize a
  self-authored assignment result.
- Disconnection disables the action with readable copy.
- A stale response refreshes the review screen and does not route to an older
  result.
- Timeout and service failure preserve the prior baseline when rerunning.
- Dynamic type and screen reader announce ready, busy, error, and retry states.

## 2. Rerun and Clear-Moves Confirmation

### Purpose

Make the consequence of replacing the generated baseline clear without clearing
manual work before the replacement succeeds.

### Content

- Existing baseline context.
- Count of currently active manual moves.
- Explanation that successful rerun creates a new baseline and clears those
  active moves.
- `Cancel` and `Rerun and clear moves` actions.

### Phase 9 Rules

- Confirm starts the same backend optimizer used by the first run.
- Confirm does not immediately clear override rows.
- One in-flight request disables repeated confirmation.
- Failure, timeout, or stale finalization leaves the prior effective assignment
  and active moves unchanged.
- Successful finalization supersedes active moves atomically, refreshes current
  state, and opens the board.

### Manual Checks

- Cancel leaves the baseline and active moves unchanged.
- Successful rerun changes the result ID and removes the active projection.
- Failed rerun retains the same result ID and active projection.
- A stale manual-move dialog opened before rerun cannot save afterward.

## 3. Charge Nurse Floor Board

### Purpose

Continue to show the effective server assignment after the optimizer commits.

### Existing Behavior Preserved

- Generated baseline plus Phase 8 active manual overrides.
- Compact phone and expanded tablet layouts.
- Doctor-side, nurse, room, bed, patient, acuity, load, and flag hierarchy.
- Swipe/tap assignment move flow.
- Realtime updates and Phase 7 stale-copy behavior.
- Links to flags, requests, and nurse invites.

### Phase 9 Behavior

- The board consumes the unchanged `AssignmentResult` contract.
- A successful first run or rerun appears through the existing workspace refresh
  and realtime boundary.
- A successful rerun starts with no active manual override projection.
- Unassigned beds and other risks continue to appear through established flags.
- No optimizer details or controls are added to the board.

### Manual Checks

- Teams, room coverage, assignments, loads, and flags agree after a complex run.
- Every assigned bed's nurse covers the bed's room.
- Red beds never display under LPNs.
- A manual move after the optimizer run uses the new baseline ID.
- Phone and tablet layouts remain unchanged except for assignment data.

## 4. Flags and Requests

### Purpose

Continue to separate assignment safety flags from nurse issue and swap request
lifecycles.

### Phase 9 Behavior

- Assignment flags describe the newly committed generated baseline.
- Unassigned, RN-required, no-coverage, understaffed, side-limit, and team
  imbalance behavior remains compatible.
- Request messages and lifecycle states are not recalculated by the optimizer.
- A successful rerun may change assignment-derived flags but must not erase
  request threads or completed swap history.
- No optimizer failure log or run history is shown here.

### Manual Checks

- An infeasible red bed produces the expected visible flags.
- A fully feasible scenario has no unassigned-bed flag.
- Existing issue and swap requests survive rerun.
- Assignment flags refresh in connected sessions without exposing optimizer
  metadata.

## 5. Joined Nurse Assignment

### Purpose

Continue to show only the signed-in nurse's authorized current assignment.

### Phase 9 Behavior

- No new action or route is added.
- A successful optimizer commit refreshes the existing nurse-scoped response.
- Only beds assigned to that nurse after the generated baseline and active
  overrides are applied are returned.
- Existing patient, acuity, coverage, request, notification, and offline
  stale-copy behavior remains.
- The nurse cannot read run status, objective values, other nurses, full room
  coverage, or optimizer metadata.

### Manual Checks

- Two joined nurses receive only their new scoped assignments after a run.
- A nurse with no assigned bed sees the established empty-assignment state.
- A disconnected nurse keeps the existing cached view until reconnect.
- Reconnect refreshes to the committed assignment.

## 6. Notification Recovery

### Purpose

Preserve safe routing when an assignment-update notification is opened.

### Phase 9 Behavior

- Reuse existing generic assignment-update event types and routes.
- Reload current authorized charge or nurse-scoped state before navigation.
- Do not include optimizer input, objective values, patient details, or run
  errors in push payloads.
- A failed or stale optimizer run creates no assignment-updated notification.

### Manual Checks

- Open a successful update notification in charge and nurse roles and confirm
  each route reloads current authorized data.
- Confirm failed runs enqueue no assignment-updated event.
- Confirm a joined nurse cannot recover into the full charge board.

## Cross-Screen Accessibility Checks

- Minimum 44-point touch targets.
- Accessible busy and disabled states for run and rerun actions.
- Focus moves to stale or failure copy and a useful review/retry action.
- No repeated progress announcements.
- Dynamic type does not clip validation, confirmation, or error copy.
- Acuity and assignment flags remain understandable without color.
- Compact and expanded layouts preserve logical heading and focus order.

## Phase 9 Exclusions

- Optimizer settings or strategy selection in the app.
- Solver reports, objective charts, analytics, or run-history screens.
- Client-side fallback assignment generation.
- Offline optimizer queue.
- AI, EHR/EMR integration, automated acuity, multi-hospital tools, or handoff
  notes.
