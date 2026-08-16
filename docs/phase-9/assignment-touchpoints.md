# Phase 9 Current Assignment Touchpoints

Task: Phase 9 Task 0.4, Confirm Current Assignment Touchpoints

This note freezes the assignment path that exists before the Phase 9 optimizer
is implemented. It records where a generated assignment is created, saved,
projected with Phase 8 manual moves, read by each role, refreshed through
Realtime, and compared for notifications.

This is documentation only. Task 0.4 does not change app behavior, database
functions, schemas, dependencies, configuration, or tests.

## Boundary Summary

The current system has two assignment layers:

```text
Generated baseline
  Shift.assignmentResult in active_shifts.shift_snapshot
  teams + room coverage + generated bed owners

                    plus

Active Phase 8 moves
  manual_assignment_overrides rows keyed by bed ID
  only the latest active row for each bed participates

                    becomes

Effective assignment
  same baseline ID, teams, and room coverage
  bed owner replaced where an active override exists
```

The generated baseline is persisted. The effective assignment is a read
projection and is not written back as a replacement baseline.

The current first-run and rerun paths both calculate the baseline on the phone,
but they save it differently. The first run uses the broad active-shift save.
The rerun uses a focused Supabase transaction that checks the prior baseline and
supersedes active overrides. Phase 9 must replace both calculation paths with
one backend action while preserving the established result and effective-read
contracts.

## Current Touchpoint Inventory

| Boundary | Current touchpoint | Responsibility today | Phase 9 treatment |
| --- | --- | --- | --- |
| Assignment action | `src/screens/AssignmentReviewScreen.tsx` | Validates the draft, runs the local generator, builds `nextShift`, chooses first-run versus rerun save, handles stale reruns, then opens the floor board. | Keep the screen and rerun warning, but call one authenticated optimizer action and stop constructing a client assignment payload. |
| Frontend generator | `src/utils/assignmentTeams.ts` | Creates at most two teams, room coverage, bed assignments, and the result ID entirely in TypeScript. | Remove it from the runtime producer path after backend parity is proven. It may remain temporarily for comparison tests. |
| Flag generator | `src/utils/assignmentFlags.ts` | Derives understaffing, coverage, capacity, RN-eligibility, unassigned-bed, and team-imbalance flags from a shift and assignment result. | Preserve the output contract. Finalization must save authoritative baseline flags, and app reads continue deriving effective flags after moves. |
| Workspace orchestration | `src/store/ServerWorkspaceContext.tsx` | Exposes first-run broad save, focused rerun, manual-move confirmation, effective result/flags, and reload-after-write behavior. | Add the optimizer action here, retain the source-of-truth reload, and preserve manual-move/effective projections. |
| Broad shift repository | `saveServerActiveShift` and `getActiveShiftPayload` in `src/services/serverWorkspaceRepository.ts` | Accept a complete client `Shift` and update the complete `shift_snapshot`. The first assignment currently uses this boundary. | Do not use this broad client write to commit optimizer output. Keep it for unrelated shift editing until later tasks narrow those writes. |
| Focused rerun repository | `rerunActiveShiftAssignment` in `src/services/serverWorkspaceRepository.ts` | Sends the expected baseline ID and the complete client-generated `nextShift` to the rerun RPC. | Replace with the small optimizer request: shift ID, mutation ID, expected revision, and expected baseline ID only. |
| Rerun transaction | `rerun_active_shift_assignment` in `docs/phase-8/supabase-manual-override-setup.md` | Locks the shift, checks ownership/current baseline, accepts a client `p_next_shift_snapshot`, supersedes all active overrides, and replaces the snapshot atomically. | Preserve its lock, stale protection, and atomic override supersession inside the future service-only finalization transaction; stop accepting a phone-generated snapshot. |
| Manual move dialog | `src/components/assignment/AssignmentMoveDialog.tsx` | Previews a move from the effective result and submits the baseline result ID, current owner, target owner, mutation ID, and warnings. | Preserve. A newly finalized result ID must make an old move request stale. |
| Manual move repository/RPC | `confirmManualAssignmentOverride` in the repository and `confirm_manual_assignment_override` in the Phase 8 setup | Revalidates ownership, baseline, current effective owner, bed/room/RN/load rules, then supersedes the previous active move for that bed and inserts a new history row. | Preserve this Phase 8 boundary. It remains downstream of optimizer finalization. |
| Effective assignment | `src/utils/effectiveAssignment.ts` | Clones the baseline and overlays active `toNurseId` values on matching baseline bed assignments. | Preserve unchanged unless a later task adds validation at its boundary. |
| Charge consumers | `src/screens/FloorBoardScreen.tsx`, `src/screens/FlagsScreen.tsx`, and `src/utils/floorBoardLookup.ts` | Read the effective result/flags for the board and workloads while retaining baseline team labels and coverage. | Continue consuming the established `AssignmentResult`; do not teach these readers about OR-Tools. |
| Joined-nurse read | `loadJoinedNurseAssignmentView` in the repository and `get_joined_nurse_assignment_view` in the Phase 8 setup | Returns only the signed-in nurse's beds after overlaying active overrides on baseline bed owners. | Preserve the scoped RPC and do not return optimizer run records, the full result, or override history. |
| Local simulated nurse read | `src/utils/nurseAssignmentView.ts` and the simulated nurse screens | Derive the older local/development nurse view directly from `Shift.assignmentResult`. | Treat as compatibility consumers during regression testing; the signed-in joined-nurse path remains the scoped RPC. |
| Realtime subscriptions | `src/services/realtimeWorkspaceRepository.ts` | Listens for private identifier-only active-shift/access events. | Preserve the event contracts. A successful finalization must update `active_shifts` so existing subscribers refetch. |
| Realtime publisher | `broadcast_nurseflow_active_shift_change` in `docs/phase-8/supabase-request-message-setup.md` | Broadcasts an identifier-only signal after any active-shift update to the charge topic and nurse-access topics. | Preserve. The event remains a refetch signal, not the optimizer result. |
| Notification comparison | `enqueue_active_shift_change_notifications` in `docs/phase-7/supabase-notification-event-setup.md` | After `shift_snapshot` changes, compares baseline bed IDs per linked nurse and saved flags, then enqueues generic events. | Recheck during integration so a committed optimizer baseline uses this safe path exactly once and no uncommitted result creates an event. |

The SQL touchpoints above are recorded in the checked-in Supabase setup notes.
The deployed project must still be checked against those definitions during the
later integration and regression tasks.

## First Assignment: Button to Saved Board

The current first-run path is:

```text
AssignmentReviewScreen primary action
  -> getAssignmentValidation(activeShift)
  -> generateLocalAssignmentResult(activeShift) on the phone
  -> generateAssignmentFlags(activeShift, assignmentResult) on the phone
  -> construct complete nextShift with status = assigned
  -> ServerWorkspaceContext.saveActiveShift(nextShift)
  -> repository.saveServerActiveShift(...)
  -> direct active_shifts update of the complete shift_snapshot
  -> reload loadServerWorkspace(...)
  -> context derives effective result and flags
  -> navigate to /floor-board
  -> FloorBoardScreen reads the refreshed effective shift
```

Detailed behavior:

1. `handlePrimaryPress` refuses to run when assignment validation has a hard
   blocker.
2. `runAndSaveAssignment` calls `generateLocalAssignmentResult` with the
   in-memory `activeShift`.
3. The screen creates `nextShift` by copying the full shift, inserting the
   result, generating flags, and changing the status to `assigned`.
4. Because no earlier `assignmentResult` exists, it calls the generic
   `saveActiveShift` context action.
5. `saveServerActiveShift` checks that the caller is a charge nurse and filters
   the update by shift ID, owning charge profile, and a null `ended_at` value.
   It does not carry an expected shift revision or assignment-baseline
   precondition.
6. `getActiveShiftPayload` places the complete client `Shift` in
   `shift_snapshot` and supplies a client timestamp for `updated_at`.
7. After the write, the context reloads the complete server workspace instead
   of making the board trust the original `nextShift` object.
8. The floor board receives the context's effective assignment. On a first run
   there normally are no active overrides, so the effective bed owners equal
   the generated baseline bed owners.

This path has charge ownership checks, but the assignment itself is still
calculated and submitted by the client. It is the trust boundary Phase 9 must
remove.

## Rerun: Baseline Check and Override Supersession

The current rerun path is:

```text
AssignmentReviewScreen primary action
  -> if active moves exist, require confirmation
  -> calculate a complete local nextShift again
  -> ServerWorkspaceContext.rerunActiveShiftAssignment(nextShift)
  -> read expected baseline ID from refreshed workspace state
  -> repository.rerunActiveShiftAssignment(...)
  -> Supabase rerun_active_shift_assignment transaction
       lock active shift row
       verify owner, active status, and expected baseline
       validate only the broad next-snapshot envelope
       supersede every active override for the shift
       replace shift_snapshot and status
  -> reload complete workspace whether saved or stale
  -> saved: open floor board
  -> stale: keep refreshed server state and show the stale message
```

The warning is shown only when both an existing baseline and at least one active
override are present. Canceling closes the dialog and writes nothing.

The RPC derives the acting profile from `auth.uid()`, locks the active-shift row,
and compares its current `assignmentResult.id` with
`p_expected_baseline_assignment_result_id`. A mismatch returns `stale` with no
snapshot or override mutation.

On a matching baseline, the RPC currently checks only that the client snapshot
uses the requested shift ID, contains a non-empty result ID, and has
`status = 'assigned'`. It then supersedes every active override and saves the
complete client snapshot in one transaction. That atomic ordering is correct:
active moves are cleared only when the new baseline is saved. The weak part is
that the result and most of the snapshot came from the phone.

## First Run Versus Rerun Today

| Concern | First assignment | Rerun |
| --- | --- | --- |
| Calculation | Phone TypeScript generator | Phone TypeScript generator |
| Client payload | Complete `Shift` through generic save | Complete `nextShift` plus expected baseline ID |
| Write boundary | Direct `active_shifts` update | Focused Supabase RPC and transaction |
| Row lock | No explicit row lock in the app write | Yes, before baseline validation |
| Expected shift revision | None | None |
| Expected prior baseline | Implicitly none, but not checked | Exact current baseline ID required |
| Active override handling | No atomic override action | All active rows superseded only with the saved rerun |
| Stale result | Generic write error only | Explicit `stale` result and refreshed workspace |
| Source-of-truth reload | Yes | Yes, for both saved and stale outcomes |

Phase 9 makes both cases use the same backend route and finalization
transaction. The only first-run/rerun distinction becomes the expected baseline
precondition: `null` for the first run and the reviewed result ID for a rerun.

## Result ID Assumptions

The current local generator returns this result ID on every run for one shift:

```text
assignment-${activeShift.id}
```

Its team, coverage, and bed-assignment child IDs are also derived from the shift
and domain IDs. Consequently, a rerun of the same shift normally reuses the
same baseline result ID even when its decisions change.

Every current place coupled to the baseline ID is listed below:

1. `generateLocalAssignmentResult` creates the fixed result ID.
2. `ServerWorkspaceContext.rerunActiveShiftAssignment` reads the current result
   ID and sends it as the expected prior baseline.
3. `serverWorkspaceRepository.rerunActiveShiftAssignment` forwards that value
   to `p_expected_baseline_assignment_result_id`.
4. `rerun_active_shift_assignment` compares it with the current snapshot result
   before saving and clearing overrides.
5. `AssignmentMoveDialog` sends `effectiveAssignmentResult.id` as the move's
   `baselineAssignmentResultId`.
6. `getEffectiveAssignmentResult` deliberately preserves the baseline ID, so
   the dialog's effective result ID is still the generated baseline ID.
7. `confirm_manual_assignment_override` checks that ID and stores it on every
   override history row.
8. `ManualAssignmentOverride.baselineAssignmentResultId` in
   `src/types/models.ts` expresses that relationship in the app model.

Phase 9 must generate a fresh server-owned result ID for every successful first
run or rerun. Consumers must treat it as opaque. This lets an old move request
fail after a rerun even when the shift ID is unchanged.

## Complete Client Assignment Payload Touchpoints

The places that currently accept or construct a client-controlled assignment
snapshot are deliberately enumerated:

- `AssignmentReviewScreen.runAndSaveAssignment` constructs the full
  assignment-bearing `nextShift`.
- `ServerWorkspaceContext.saveActiveShift` accepts any complete `Shift`; it is
  the first-run assignment write path.
- `saveServerActiveShift` serializes that object with `getActiveShiftPayload`
  and directly replaces `shift_snapshot`.
- `ServerWorkspaceContext.rerunActiveShiftAssignment` accepts a complete
  `nextShift`.
- `RerunActiveShiftAssignmentInput.nextShift` exposes that trust in the
  repository type.
- `serverWorkspaceRepository.rerunActiveShiftAssignment` passes the object as
  `p_next_shift_snapshot`.
- `rerun_active_shift_assignment` accepts and saves that JSON payload after
  only envelope checks.

The generic `saveActiveShift` action also has non-assignment callers in
`CarryOverReviewScreen`, `NursesScreen`, `PatientsAndAcuityScreen`,
`StartShiftScreen`, `SimulatedNurseIssueScreen`, and
`SimulatedNurseSwapScreen`. Later Phase 9 work must not accidentally route all
of those workflows through OR-Tools. It should replace only the assignment
producer/write path and use shift revision plus input fingerprint checks to
detect relevant edits made while a solve is running.

## Where the Baseline Ends and Effective Assignment Begins

The persisted baseline ends at:

```text
active_shifts.shift_snapshot.assignmentResult
```

That `AssignmentResult` contains:

- `id`;
- `generatedTeams`;
- `roomCoverage`;
- `bedAssignments`.

Phase 8 manual moves begin outside the snapshot in active
`manual_assignment_overrides` rows. The charge workspace loads those rows into
`activeAssignmentOverridesByBedId`. `getWorkspaceSnapshots` then calls
`getEffectiveAssignmentResult`.

The helper:

- copies the baseline result instead of mutating it;
- preserves the baseline result ID;
- preserves generated teams and room coverage;
- replaces only `bedAssignment.nurseId` when an active row exists for that bed;
- falls back to the generated nurse when no active override exists.

The charge board and flags use this effective result. The joined-nurse RPC does
the same overlay in SQL with `coalesce(active_override.to_nurse_id,
baseline_nurse_id)` and returns only beds effectively owned by the signed-in
nurse. Superseded override history is not part of either routine projection.

This separation is why a rerun cannot merely overwrite the baseline and leave
old active overrides in place: those old rows would otherwise be applied to a
new result they were never confirmed against.

## Flags: Saved Baseline Versus Effective Read

`AssignmentReviewScreen` currently generates flags from the new baseline and
stores them in `shift_snapshot.flags` with the assignment.

After any workspace load, `ServerWorkspaceContext.getWorkspaceSnapshots`
behaves differently:

- when an assignment result exists, it creates the effective result first and
  regenerates flags from that result;
- when no result exists, it falls back to the flags saved on the shift.

Therefore `effectiveAssignmentFlags` is the current charge-facing truth after a
manual move, while `shift_snapshot.flags` describes the saved baseline. The
floor board and Flags screen consume the effective flags exposed by context.

Phase 9 finalization should save baseline flags that match its committed
baseline, while preserving the current effective flag regeneration after
manual moves.

## Realtime Refresh Path

The server uses Realtime events only as refetch signals:

1. An `active_shifts` update runs
   `broadcast_nurseflow_active_shift_change`.
2. The trigger sends the shift ID to the owning charge topic and sends the
   shift/access IDs to each nurse-access topic. It sends no snapshot, patient
   fields, result, or override history.
3. `subscribeToChargeActiveShift` receives `active-shift-changed`; the charge
   context reloads `loadServerWorkspace`.
4. `subscribeToJoinedNurseAssignmentView` receives the same event on its
   access-scoped topic; the nurse context reloads the scoped RPC.
5. A manual override changes its own table and also touches
   `active_shifts.updated_at`, which wakes these same refetch paths without
   exposing the override row to joined nurses.

A successful Phase 9 finalization must keep the active-shift update inside its
commit so both roles continue to refetch only committed state.

## Notification Touchpoint

The Phase 7 `enqueue_active_shift_change_notifications` trigger runs only after
`shift_snapshot` changes. For every linked nurse it compares sorted baseline
bed IDs owned in the old and new snapshots. A difference enqueues one generic
`assignment_updated` event. It also compares patient presence and saved
unassigned/imbalance flags without copying patient details into notifications.

Implications for Phase 9:

- a successful first run or rerun changes `shift_snapshot`, so the existing
  server-side comparison is the applicable notification boundary;
- a failed, timed-out, invalid, or stale solve must not change the snapshot and
  therefore must not create a false assignment notification;
- finalization must avoid a partial/intermediate snapshot write that could be
  observed or notified;
- repeating an assignment with identical nurse-to-bed sets does not notify a
  nurse merely because JSON order or the opaque result ID changed.

One existing Phase 8 caveat remains visible in this trace: a standalone manual
move updates override rows and `active_shifts.updated_at`, not the baseline
`shift_snapshot.assignmentResult`. It wakes Realtime refetches, but this Phase 7
snapshot-diff trigger alone cannot detect that effective ownership change.
Phase 9 does not silently redesign that Phase 8 notification boundary in Task
0.4; later notification regression work must test the installed database and
address the already-recorded override-notification touchpoint if needed.

## Focused Phase 9 Change Surface

Later implementation tasks should focus changes on:

- `src/screens/AssignmentReviewScreen.tsx`: replace local generation/save with
  the authenticated optimizer action while retaining validation, progress,
  rerun confirmation, stale recovery, and navigation;
- `src/store/ServerWorkspaceContext.tsx`: expose one first-run/rerun optimizer
  action and retain source-of-truth reloads;
- `src/services/serverWorkspaceRepository.ts` or a focused optimizer service
  adapter: send only action metadata, never `nextShift` or solver output;
- new Python service files: authenticate, prepare, normalize, solve, validate,
  and request protected finalization;
- new focused Supabase prepare/finalize functions: authorize user intent,
  protect idempotency/concurrency, and atomically commit the new baseline;
- `src/utils/assignmentTeams.ts`: leave available during parity testing, then
  remove from the production runtime path.

The following existing boundaries should remain compatible:

- `AssignmentResult` in `src/types/models.ts`;
- `generateAssignmentFlags` output and effective flag calculation;
- `getEffectiveAssignmentResult` and active override history;
- `confirm_manual_assignment_override` stale-baseline protection;
- charge floor-board and flag readers;
- nurse-scoped `get_joined_nurse_assignment_view`;
- private Realtime topics and refetch behavior;
- generic, server-created notification events.

## Manual Trace Checklist

### First assignment

- Start with an active setup shift that has no `assignmentResult`.
- Follow `handlePrimaryPress` to `runAndSaveAssignment`.
- Confirm the branch calls `saveActiveShift`, not the rerun action.
- Follow the complete client `Shift` through `getActiveShiftPayload` into
  `active_shifts.shift_snapshot`.
- Confirm the workspace reload occurs before the floor board reads the result.

### Rerun

- Start with a saved baseline and at least one active manual override.
- Confirm the warning can cancel without writing.
- On confirmation, follow the current baseline ID from context to the RPC.
- Confirm the RPC locks and rechecks that baseline before writing.
- Confirm stale returns without replacing the snapshot or superseding active
  overrides.
- Confirm saved rerun supersedes all active overrides and replaces the snapshot
  in the same transaction, then reloads the workspace.

### Baseline and effective assignment

- Point to `shift_snapshot.assignmentResult` as the generated baseline.
- Point to active `manual_assignment_overrides` as separate history/state.
- Follow `getEffectiveAssignmentResult` and confirm it changes only effective
  bed owners.
- Confirm charge views use the context projection and joined nurses use the
  scoped SQL projection.
- Explain why each new successful optimizer run needs a new result ID before a
  later manual move can safely reference its baseline.

