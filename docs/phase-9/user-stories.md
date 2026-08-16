# NurseFlow Phase 9 User Stories

Phase 9 replaces the Phase 1 frontend assignment prototype with a deterministic,
production-grade Python backend optimizer using OR-Tools. The Python optimizer
is a separately deployed service, not code bundled into the Expo app. It
preserves the established floor setup, active-shift snapshot, assignment result,
flags, manual overrides, realtime refresh, notifications, responsive layouts,
and nurse-scoped views from Phases 1-8.

The optimizer is a constraint solver, not AI. It uses only the structured shift
inputs already collected by NurseFlow.

## US1: Generate the Assignment on the Backend

As a charge nurse, I want NurseFlow to calculate the assignment on the backend
so the saved result is server-authoritative and consistent across connected
devices.

### Acceptance Criteria

- Only the owning, signed-in charge nurse can request an optimizer run for an
  active shift.
- The Expo app calls one authenticated Python optimizer endpoint using the
  current Supabase access token; it does not execute Python on the device.
- The Python service verifies the caller, prepares the run through Supabase,
  normalizes the authorized snapshot, and calculates the result with a pinned
  OR-Tools version.
- The optimizer reads the current server-owned shift snapshot instead of
  trusting a full assignment payload calculated by the phone.
- Only the Python service can submit solver output to the service-authorized
  finalization boundary; a mobile client cannot submit a claimed optimizer
  result directly.
- Initial assignment and rerun use the same backend optimizer contract.
- A successful run atomically saves one new generated baseline and returns the
  refreshed active shift.
- Each successful run has a new server-generated assignment result ID.
- The existing `AssignmentResult` output remains compatible with the floor
  board, flags, nurse views, and manual-override baseline references.
- A failed or stale run does not partially replace the current assignment.

### Manual Checks and Edge Cases

- Run the first assignment while connected and confirm the result appears on
  the charge board.
- Confirm a joined nurse cannot invoke the optimizer.
- Try to call the finalization action with only a normal user session and
  confirm it is denied.
- Disconnect before running and confirm the app explains that calculation
  requires a connection; it does not queue the request.
- Force a backend failure and confirm no partial baseline is saved.

## US2: Assign Every Feasible Occupied Bed

As a charge nurse, I want the optimizer to consider the whole floor together so
capacity is not stranded by an early room choice.

### Acceptance Criteria

- Only occupied beds with an acuity participate in assignment.
- Every participating bed is assigned to exactly one eligible nurse or is
  explicitly left unassigned when no valid assignment exists.
- The first optimization priority is minimizing the number of unassigned
  occupied beds.
- A lower-census room cannot consume coverage in a way that leaves a
  higher-census room unassigned when a valid global assignment exists.
- A nurse never exceeds her configured `maxPatientLoad`.
- Existing flags clearly identify occupied beds that remain unassigned.

### Manual Checks and Edge Cases

- Use a scenario where the Phase 1 greedy room order strands capacity and
  confirm the backend optimizer finds the valid full assignment.
- Use a genuinely understaffed scenario and confirm only the minimum necessary
  beds remain unassigned.
- Confirm empty beds never appear in `bedAssignments`.
- Confirm changing room input order does not change the feasible assignment
  count.

## US3: Preserve Clinical Eligibility and Coverage Rules

As a charge nurse, I want the optimizer to enforce nurse eligibility and room
coverage rules so a mathematically balanced result cannot violate the staffing
constraints NurseFlow already communicates.

### Acceptance Criteria

- Red-acuity beds are assigned only to RNs.
- LPNs are never assigned red-acuity beds.
- Every bed assignment points to a nurse whose generated room coverage includes
  that bed's room.
- Every nurse belongs to one generated team, using the existing stable team
  labels and output shape.
- Room coverage may include more than one nurse from its selected generated
  team, but every occupied room is covered by exactly one team.
- Existing side-based load limits remain soft workload guidance and flagging;
  the nurse's individual max load remains the hard cap.
- Invalid or missing nurse, room, bed, side, acuity, or relationship IDs block
  the run before solving.

### Manual Checks and Edge Cases

- Run a red-bed scenario with RN and LPN capacity and confirm only RNs receive
  red beds.
- Run a red-bed scenario with no RN capacity and confirm the bed remains
  unassigned and flagged.
- Inspect every saved bed assignment and confirm its nurse appears in that
  room's coverage.
- Confirm a nurse whose coverage touches the admitting side receives the
  existing admitting-side workload guidance and flags.

## US4: Receive a Balanced, Predictable Result

As a charge nurse, I want equally feasible solutions to prefer safer workload
balance and stable ordering so the result is understandable and repeatable.

### Acceptance Criteria

- Optimization priorities are lexicographic: minimize unassigned occupied beds,
  then prefer lower maximum acuity load, then lower maximum patient count, then
  stable nurse and floor order.
- Acuity comparison uses one documented integer scale and does not inspect
  diagnosis text or infer clinical meaning.
- Red-bed ties between otherwise equal eligible RNs prefer experienced, then
  mid, then new-grad RNs.
- When all higher assignment priorities tie, generated teams spread
  experienced, mid, and new-grad nurses as evenly as possible without using a
  combined experience-strength score.
- Stable ordering covers nurse, doctor-side, room, bed, team, and coverage
  tie-breaks so equivalent inputs do not depend on database row order.
- The same normalized input, optimizer version, and supported runtime produce
  the same result.
- The complex scenario suite proves objective priority rather than checking only
  that a result exists.

### Manual Checks and Edge Cases

- Run identical input more than once and compare generated teams, coverage, and
  bed assignments.
- Shuffle source-array order, normalize it, and confirm the same canonical
  result.
- Create an otherwise equal red-bed choice and confirm experience order breaks
  the tie.
- Create an otherwise equal team-membership choice and confirm experience
  categories are spread across teams.
- Confirm the optimizer never accepts an extra unassigned bed merely to improve
  acuity or patient-count balance.

## US5: Rerun Safely After Manual Moves

As a charge nurse, I want a rerun to create a fresh generated baseline and clear
active manual moves only after the new result succeeds so deliberate work is not
lost on a failed calculation.

### Acceptance Criteria

- The existing warning appears before rerunning when active overrides exist.
- Canceling keeps the current baseline and all active overrides.
- Confirming starts a backend optimizer run against the current shift revision.
- A successful commit supersedes active manual overrides in the same transaction
  that saves the new baseline.
- A failed, timed-out, or stale optimizer run preserves the previous baseline
  and active overrides.
- Historical manual moves and completed swap history remain available under
  their existing Phase 8 rules.
- A manual move created against an older result ID cannot be saved against the
  new baseline.

### Manual Checks and Edge Cases

- Cancel a rerun with active moves and confirm nothing changes.
- Complete a rerun and confirm the new result ID differs and the active override
  projection is empty.
- Cause a rerun failure and confirm the previous effective board still includes
  its active moves.
- Try a stale move after rerun and confirm the server rejects and refreshes it.

## US6: Recover Safely from Concurrent or Failed Runs

As a charge nurse, I want clear recovery when shift data changes during
optimization so an older calculation cannot overwrite newer patient or staffing
data.

### Acceptance Criteria

- Each request carries an idempotency key and the expected server shift revision.
- Retrying the same completed mutation returns the same committed result instead
  of creating another baseline.
- Reusing an idempotency key for different input is rejected.
- Finalization verifies that the active shift, expected revision, and expected
  prior baseline still match the run input.
- A stale result is discarded without changing the shift or overrides, then the
  app reloads current server state.
- Timeout, infeasible internal model, invalid output, and service-unavailable
  errors have distinct safe server outcomes even if the UI uses concise copy.
- No client-side fallback silently creates a different assignment.

### Manual Checks and Edge Cases

- Submit the same mutation twice and confirm one baseline is committed.
- Change a nurse, bed state, or acuity while a run is in progress and confirm the
  older result cannot commit.
- Simulate an invalid optimizer response and confirm it never reaches the active
  shift snapshot.
- Retry after a transient failure with a fresh request and confirm the current
  shift is used.

## US7: Preserve Existing Connected Views and Phase Boundaries

As a charge nurse or joined nurse, I want the new optimizer result to flow
through the existing NurseFlow experience so Phase 9 does not create a second
board or expose additional data.

### Acceptance Criteria

- The charge board, flags, effective-assignment projection, request flows, and
  joined-nurse assignment consume the established result contract.
- Successful initial runs and reruns trigger the existing realtime refresh and
  safe assignment-update notification paths where applicable.
- Joined nurses receive only their nurse-scoped assignment and cannot read
  optimizer requests, run records, full inputs, or the full board.
- Cached board and joined-nurse views remain readable under existing Phase 7
  rules, but optimizer writes require a connection.
- Phase 9 adds no new top-level route and no solver settings in the mobile UI.
- Phase 9 adds no AI, EHR/EMR integration, automated acuity, multi-hospital
  tools, handoff notes, advanced analytics, or offline write queue.

### Manual Checks and Edge Cases

- Observe a successful run in connected charge and joined-nurse sessions.
- Confirm current request, notification-tap, manual-move, and responsive-layout
  flows still work.
- Confirm a joined nurse cannot access optimizer run metadata or full shift data.
- Run the Phase 1-8 regression checklist and record any intentional copy-only
  changes.
