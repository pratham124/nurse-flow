# Phase 9 Implementation Tasks

This task list plans Phase 9 in small, ordered, independently testable steps. No
implementation code is part of this planning task.

Phase 9 replaces the frontend assignment prototype with a production backend
optimizer. It preserves the existing assignment result, flags, manual override,
realtime, notification, responsive, and nurse-scoped contracts.

Status legend:

- Done
- No marker means not done yet.

## Build Order Summary

1. Freeze the optimizer rules, Python service boundary, and current app/server
   touchpoints.
2. Build canonical fixtures and the normalized optimizer input boundary.
3. Add hard constraints, lexicographic objectives, deterministic tie-breaks,
   and output validation in the Python/OR-Tools service.
4. Add authenticated run coordination and atomic finalization.
5. Connect initial assignment and rerun without changing downstream result
   consumers.
6. Retire the frontend generator from the runtime path.
7. Run complex scenario, authorization, concurrency, manual, and Phase 1-8
   regression passes.

## Planning and Guardrails

### Done Task 0.1: Create Phase 9 Planning Docs

Story coverage: US1-US7

Build:

- Add Phase 9 user stories, data model, mobile design, screens, and task
  documents.
- Use `docs/product-spec.md` and `docs/phases.md` as the canonical product and
  phase boundaries.
- Preserve Phase 1-8 contracts and list explicit Phase 9 exclusions.
- Write no app or backend implementation code.

Manual validation:

- Point to `docs/phase-9/` and explain the included optimizer capability.
- Confirm the five requested planning files exist.
- Confirm no runtime, dependency, configuration, schema, or test code changed.

### Task 0.2: Freeze the Optimizer Rules

Story coverage: US2-US4

Build:

- Turn the roadmap rules into one exact optimizer specification before writing
  solver code.
- Define participating beds, team count, team membership, room-to-team coverage,
  nurse coverage, side-guidance behavior, integer acuity weights, and all stable
  input orders.
- Define the exact lexicographic objective stages and prove later stages cannot
  worsen earlier optima.
- Define experienced, mid, new-grad RN preference only as the red-bed tie-break
  stated in the roadmap.
- Define supported maximum floor size and the difference between optimal,
  infeasible-input, timed-out, and internal-failure outcomes.

Manual validation:

- Walk through one feasible, one understaffed, and one red-bed tie scenario by
  hand.
- Explain why minimizing unassigned beds outranks every balancing preference.
- Confirm side-based limits remain guidance/flags while nurse max load is hard.

### Task 0.3: Document the Python Service and Deployment Boundary

Story coverage: US1, US4, US6, US7

Build:

- Use a separately deployable Python service with the official OR-Tools Python
  package; do not bundle Python into Expo or Supabase Edge Functions.
- Choose the minimal Python HTTP framework and container-capable host only after
  documenting local development, health checks, timeout, CPU, memory, cold
  start, deployment, and rollback requirements.
- Define one authenticated endpoint for both initial assignment and rerun.
- Define Supabase JWT verification and the user-authorized prepare action.
- Define a service-only finalization credential and protected transaction; never
  expose that credential through `EXPO_PUBLIC_` variables or mobile code.
- Pin Python and OR-Tools versions and document the supported maximum-floor
  benchmark before adding implementation dependencies.
- Keep the mobile app unaware of Python modules and solver internals.

Manual validation:

- Explain why the Python module must be a deployed service rather than a module
  imported by the Expo app.
- Trace the access token from the app through verification and the authorized
  prepare action without storing it in optimizer data.
- Confirm a normal app user cannot call protected finalization with an invented
  result.
- Demonstrate the production-like Python runtime can solve the representative
  maximum scenario deterministically within its safe resource budget.

Official references to recheck during this task:

- Google OR-Tools assignment with task sizes:
  https://developers.google.com/optimization/assignment/assignment_cp
- Google OR-Tools installation:
  https://developers.google.com/optimization/install
- Supabase JWT verification:
  https://supabase.com/docs/guides/auth/jwts

### Task 0.4: Confirm Current Assignment Touchpoints

Story coverage: US1, US5-US7

Build:

- Record the current frontend generator, assignment review action, workspace
  context, repository, active-shift RPCs, flag generation, effective assignment,
  manual override, joined-nurse view, realtime, and notification touchpoints.
- Identify every place that assumes the current result ID or accepts a client
  `nextShift` assignment payload.
- Record the initial-run and rerun transaction differences.
- Identify focused files and server functions without changing them.

Manual validation:

- Trace first assignment from button press to saved board.
- Trace rerun through baseline checking and active override supersession.
- Explain where the generated baseline ends and Phase 8 effective assignment
  begins.

## Optimizer Contract and Core

### Task 1.1: Add Canonical Optimizer Fixtures and Expected Outcomes

Story coverage: US2-US4, US6

Build:

- Create small, readable fixtures for empty census, one nurse, RN/LPN mix,
  red-bed eligibility, exact capacity, understaffing, split rooms, both doctor
  sides, active-side guidance, and stable ties.
- Add the known greedy-failure fixture where a lower-census room can strand
  capacity needed by a higher-census room.
- State expected assignments, allowed equivalent choices, and objective values
  before implementing the solver.
- Keep fixtures synthetic and free of real patient information.

Manual validation:

- Review each fixture and predict its expected unassigned count.
- Confirm the greedy-failure fixture has a valid full assignment.
- Confirm every expected red-bed owner is an RN.

### Task 1.2: Add Server Input Normalization and Validation

Story coverage: US1-US4, US6

Build:

- Convert the authoritative shift snapshot into the frozen normalized solver
  model.
- Reject duplicate IDs, broken relationships, missing acuity, invalid max loads,
  missing admitting side, and invalid side limits before solving.
- Exclude empty beds and free-text patient fields from optimization.
- Canonicalize nurse, side, room, and bed order explicitly.
- Produce a stable input fingerprint for idempotency and reproducibility.

Manual validation:

- The same logical shift with incidental query-order changes normalizes to the
  same fingerprint and model.
- Invalid relationships fail before solver invocation.
- Diagnosis changes alone do not change optimizer input or output.

### Task 1.3: Add Team and Room-Coverage Decision Model

Story coverage: US2-US4

Build:

- Model every nurse in one generated team using the frozen team-count rules.
- Model occupied-room coverage by one or more teams/nurses as required.
- Keep team labels and output ordering compatible with existing board readers.
- Prevent meaningless extra coverage through the frozen structural constraints
  or final tie-break rule.
- Keep empty-room coverage behavior compatible and deterministic.

Manual validation:

- Every nurse appears in exactly one team.
- Coverage uses only current room and nurse IDs.
- A room can receive multiple eligible nurses when needed.
- Repeated runs produce the same team and coverage decisions.

### Task 1.4: Add Bed-Assignment Hard Constraints

Story coverage: US2, US3

Build:

- Give each occupied bed one eligible nurse choice or the internal unassigned
  choice.
- Enforce individual max patient load.
- Enforce red-bed RN eligibility.
- Enforce assignment-implies-room-coverage.
- Ensure empty beds cannot be assigned.

Manual validation:

- Exact-capacity fixtures assign every occupied bed.
- Understaffed fixtures use the unassigned choice without exceeding max load.
- Red beds never go to LPNs.
- Every emitted bed assignment has matching room coverage.

### Task 1.5: Add Lexicographic Objectives and Deterministic Tie-Breaks

Story coverage: US2, US4

Build:

- Minimize unassigned occupied beds first.
- Fix that optimum before minimizing the highest weighted acuity load.
- Fix prior optima before minimizing the highest patient count.
- Apply experienced/mid/new-grad RN preference for otherwise equal red-bed
  choices.
- Apply canonical stable-order tie-breaks across remaining equal solutions.
- Configure the chosen solver for reproducibility and pin its version.

Manual validation:

- A later balance objective never increases unassigned beds.
- An otherwise equal red bed follows the required experience order.
- Identical normalized input produces byte-equivalent canonical decisions.
- A runtime upgrade cannot be accepted until the deterministic fixture suite
  passes.

### Task 1.6: Build and Independently Validate the Assignment Result

Story coverage: US1-US4, US7

Build:

- Convert solver decisions into the existing `AssignmentResult` arrays.
- Generate a new opaque server result ID and stable child IDs.
- Build matching existing assignment flags from the same result.
- Independently validate all output IDs, max loads, RN rules, occupied-bed rules,
  coverage eligibility, and objective summary before finalization.
- Reject partial, unknown, or internally inconsistent output.

Manual validation:

- Existing board, flag, effective-assignment, and nurse-view helpers accept the
  output without a second result model.
- Unassigned internal choices become existing flags rather than fake
  assignments.
- Two successful runs receive different result IDs even if decisions match.
- Corrupt one output relationship and confirm validation blocks commit.

## Server Coordination and Atomic Save

### Task 2.1: Add Optimizer Run Coordination and Idempotency

Story coverage: US1, US6

Build:

- Add the minimal optimizer run record and indexes from the data model.
- Add an authenticated prepare action that derives the charge profile, verifies
  shift ownership and active status, captures current revision/baseline, and
  returns only the authorized calculation input.
- Enforce one meaning per client mutation ID and return the existing success for
  an identical completed retry.
- Keep full shift snapshots and patient details out of run metadata.

Manual validation:

- Owning charge nurse can prepare a run.
- Joined nurse and unrelated charge account cannot prepare it.
- An identical retry reuses one run.
- Mutation-key reuse with different input is rejected.

### Task 2.2: Add the Authenticated Python Optimizer Endpoint

Story coverage: US1-US4, US6

Build:

- Add one Python HTTPS endpoint for initial and rerun calculation.
- Verify the Supabase bearer token before preparing a run.
- Call the user-authorized prepare action to load only the server-authorized
  current input.
- Normalize and run the pinned OR-Tools version with a bounded execution policy.
- Call protected finalization with a server-only credential after independent
  output validation.
- Return typed saved, stale, invalid, timed-out, unavailable, or failed outcomes
  without exposing solver internals.

Manual validation:

- Valid charge request reaches the optimizer.
- Missing, expired, or wrong-role authorization fails.
- A normal mobile credential cannot finalize an invented result.
- Timeout or internal failure returns a safe non-commit outcome.
- Logs contain IDs and timings but no diagnosis text or full patient payload.

### Task 2.3: Add Atomic Optimizer Finalization

Story coverage: US1, US5, US6

Build:

- Lock and recheck the active shift, owner, status, revision, expected baseline,
  run identity, and validated output.
- Save the new assignment result and matching flags atomically.
- Mark the run succeeded with its result ID in the same transaction.
- Supersede active manual overrides only when a rerun successfully commits.
- Return stale without modifying baseline, flags, or overrides when inputs
  changed.

Manual validation:

- A successful initial run saves one baseline.
- A successful rerun saves a new baseline and clears active overrides.
- Concurrent input change makes finalization stale with no partial writes.
- A database error rolls back result, flags, run success, and override changes.

### Task 2.4: Preserve Realtime, Notifications, and Nurse-Scoped Reads

Story coverage: US5, US7

Build:

- Reuse the active-shift realtime signal after successful finalization.
- Reuse generic assignment-update notifications only after commit.
- Keep failed and stale runs from emitting assignment-updated events.
- Confirm joined-nurse reads derive only the authorized nurse's effective beds.
- Keep optimizer run records and full result data out of joined responses.

Manual validation:

- Connected charge and nurse sessions refresh after success.
- Former and new assigned nurses receive the correct scoped result.
- Failed/stale runs send no assignment-updated notification.
- Joined nurses cannot query run metadata or the full board.

## Mobile Integration

### Task 3.1: Add the App Optimizer Repository Contract

Story coverage: US1, US5-US7

Build:

- Add one small repository action for initial and rerun requests.
- Send shift ID, mutation ID, and current preconditions rather than a client
  assignment snapshot.
- Strictly validate saved, stale, invalid, timed-out, unavailable, and failed
  responses.
- Refresh the server workspace after a saved or stale result.

Manual validation:

- The app sends no `nextShift.assignmentResult` as trusted optimizer input.
- Saved response refreshes the committed baseline.
- Stale response refreshes current inputs and remains on review.
- Malformed service responses fail safely.

### Task 3.2: Connect Initial Assignment to the Backend

Story coverage: US1-US4, US7

Build:

- Replace the first-run frontend generator call with the repository action.
- Preserve existing assignment validation before submission.
- Add one in-flight guard and readable calculating, disconnected, stale,
  timeout, unavailable, and failure states.
- Route to the existing board only after refreshed saved state is available.

Manual validation:

- First assignment is generated and saved only by the backend path.
- Duplicate taps create one committed baseline.
- Failure stays on review and creates no local-only assignment.
- Accessibility and dynamic-type checks pass for busy and error states.

### Task 3.3: Connect Rerun and Override Clearing to the Backend

Story coverage: US5-US7

Build:

- Preserve the active-moves warning and confirmation.
- Invoke the same optimizer action with the expected prior baseline.
- Keep current baseline and overrides visible until successful finalization.
- Handle stale/failure recovery without clearing local or server moves.

Manual validation:

- Cancel preserves moves.
- Success changes result ID and clears active moves.
- Failure and stale outcomes preserve the prior effective board.
- An old manual-move dialog cannot save against the new baseline.

### Task 3.4: Retire the Frontend Generator from the Runtime Path

Story coverage: US1, US6, US7

Build:

- Remove all production screen/context calls that calculate assignment on the
  device.
- Remove or archive obsolete helpers only after focused tests prove no remaining
  consumer needs them.
- Keep reusable client display, validation, flag-preview, and effective-
  assignment helpers that still own mobile behavior.
- Update project structure documentation and service boundaries.

Manual validation:

- Search confirms no mobile runtime path can save a locally generated baseline.
- Manual assignment preview still works because it uses the committed result,
  not the retired generator.
- TypeScript, lint, targeted tests, and production export pass.

## Validation and Completion

### Task 4.1: Run the Complex Optimizer Scenario Suite

Story coverage: US2-US4, US6

Build:

- Test many rooms, uneven room census, mixed sides, RN/LPN mixes, experience
  ties, red-heavy census, low caps, exact capacity, and understaffing.
- Add property checks for output IDs, one owner per bed, max load, red RN,
  coverage, and occupied-bed-only assignment.
- Repeat deterministic runs and canonical-order perturbations.
- Record supported maximum scenario solve time and result status in the chosen
  production-like runtime.

Manual validation:

- The greedy-failure fixture receives a full valid assignment.
- No feasible full assignment is reported with avoidable unassigned beds.
- Repeated runs are identical.
- The maximum supported scenario stays inside the documented resource budget.

### Task 4.2: Run Authorization, Idempotency, and Concurrency Checks

Story coverage: US1, US5-US7

Build:

- Test charge ownership, joined-nurse denial, unrelated-account denial, expired
  auth, duplicate retries, mutation-key misuse, concurrent runs, input changes,
  and rerun/manual-move races.
- Verify transaction rollback and notification-after-commit behavior.
- Verify logs and run records do not duplicate patient details.

Manual validation:

- Only the owner can commit an assignment.
- One mutation produces at most one baseline.
- A stale result never overwrites newer input or active moves.
- Joined nurses cannot read optimizer records.

### Task 4.3: Run the Mobile Manual Pass

Story coverage: US1-US7

Build:

- Test first run, rerun with and without moves, disconnect, reconnect, stale
  refresh, timeout, unavailable service, invalid setup, success, and failure.
- Check small/large phones, tablet portrait/landscape, dynamic type, and
  VoiceOver/TalkBack.
- Record expected copy and screenshots only as test evidence, not a redesign.

Manual validation:

- The user always knows whether the current assignment changed.
- Duplicate submission is unavailable while calculating.
- Previous data remains visible after rerun failure.
- Busy, error, retry, and confirmation controls are accessible.

### Task 4.4: Run the Phase 1-8 Regression Pass

Story coverage: US5, US7

Build:

- Recheck floor setup, carry-over, auth, active-shift persistence, realtime,
  invites, nurse-scoped views, requests, push recovery, offline reads, manual
  moves, request threads, responsive layouts, accessibility, and large-floor
  rendering.
- Confirm the existing `AssignmentResult` contract prevents duplicate board or
  nurse-view implementations.
- Record any intentional assignment copy changes.

Manual validation:

- Current Phase 1-8 acceptance checks pass.
- Manual moves still overlay the generated baseline.
- Request history survives rerun.
- Phone and tablet boards render the backend result correctly.

### Task 4.5: Complete Scope, Readability, and Understanding Checkpoint

Story coverage: US1-US7

Build:

- Remove dead compatibility paths and explain the final server/app boundary in
  beginner-friendly project documentation.
- Confirm exact optimizer priorities and failures are readable without knowing
  solver internals.
- Mark completed Phase 9 tasks only after their acceptance and manual checks
  pass.
- Update `docs/understanding-checklist.md` incrementally and complete the
  required teaching checkpoint.

Manual validation:

- The learner can explain authoritative input, hard constraints, objective
  order, deterministic tie-breaks, unique result IDs, stale finalization, and
  manual-override compatibility.
- No later-phase or future-consideration feature appears in runtime or docs as
  Phase 9 implementation.
- App, backend, and setup documentation agree.

## Later, Not Phase 9

- AI-based staffing or explanations.
- Diagnosis interpretation or automated acuity.
- EHR/EMR integration.
- Multi-hospital administration.
- Shift handoff notes.
- Advanced cross-shift analytics.
- User-adjustable solver weights or strategy settings.
- Optimizer reports or run-history UI.
- Offline assignment writes or a sync queue.
