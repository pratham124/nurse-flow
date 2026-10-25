# Milestone 5: Manual moves, nurse requests, and request threads

Status: done on 2026-10-24. Tickets 12–15 are verified locally, against the
development database, and through a real-session browser walkthrough (limits below). Tickets 12–15. Glossary terms are in
the root `CONTEXT.md`; the joined-nurse write boundary is
[ADR 0004](../adr/0004-joined-nurse-snapshot-writes.md). Behavior authority is the
captured baseline (`supabase/baseline/functions.sql`): `confirm_manual_assignment_override`,
`complete_swap_request_from_override` (trigger), `submit_joined_nurse_issue_request`,
`update_shift_nurse_issue_status`, `submit_joined_nurse_swap_request`,
`resolve_shift_nurse_swap_request`, `get_nurse_request_thread_actor`,
`list_nurse_request_messages`, and `append_nurse_request_message`.

## Settled decisions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Charge review target | Shift ID in the URL (`/shifts/{id}/requests/{requestId}/…`), not "newest unended shift". Missing/foreign/ended shift → 404 `shift_not_found`. |
| 2 | Joined submissions | `POST /joined-workspace/issue-requests` and `/joined-workspace/swap-requests`; the shift comes from the caller's newest linked access, like `GET /joined-workspace`. 201 `{"request": …}`; Expo still reloads the joined view. |
| 3 | Joined write boundary | Go-role UPDATE policy on `active_shifts` for unended shifts with linked access; Go appends exactly one request (ADR 0004). |
| 4 | Swap source bed | Checked against the **effective** nurse, not the baseline nurse (reviewed difference below). |
| 5 | Move contract | `POST /shifts/{id}/assignment-moves`, snake_case body, 200 with the RPC's camelCase result for `saved`, `stale`, and replays. |
| 6 | Move replay | A repeated `client_mutation_id` returns the earlier override without comparing the payload, as the baseline does. |
| 7 | Swap completion | Retained `complete_swap_request_from_override` trigger; Go pre-checks all of its conditions so a bad link is a 422, not a 500. |
| 8 | Threads | `GET`/`POST /shifts/{id}/requests/{requestId}/messages`; Go computes the thread actor; `go_private.caller_is_thread_actor` backs the RLS policies. |
| 9 | Review responses | 200 `{"request": …}`; same-status issue update is a no-op; text-match duplicate detection kept; no new mutation IDs on submissions. |

Locks: every write locks the `active_shifts` row `FOR UPDATE` first and does a
read-modify-write of the snapshot (ADR 0002 pattern). Message appends do not lock
the shift, matching the baseline. No other locks are taken.

Side effects stay in the existing triggers (none of them read `auth.uid()`):
Realtime broadcasts on `active_shifts` updates and message inserts, notification
enqueueing on snapshot changes and message inserts, and swap completion on
override insert. Go never reproduces them.

## API contracts

All routes require `Authorization: Bearer <token>` and an application profile
(`RequireChargeNurse`, which every app profile passes). Errors use the existing
`{"error":{"code","message"}}` envelope; database failures are 503
`database_unavailable`; malformed JSON is the existing 400 handling. Messages
below are user-visible and copied from the baseline functions.

`NurseRequest` is the stored snapshot object, returned as stored (camelCase,
unknown keys preserved).

### Manual move (ticket 12)

`POST /shifts/{id}/assignment-moves`

```json
{"baseline_assignment_result_id":"…","bed_id":"…","from_nurse_id":"…","to_nurse_id":"…",
 "warning_acknowledgements":[{"id?":"…","warningType":"over_max_load","message?":"…","nurseId?":"…","bedId?":"…"}],
 "related_swap_request_id":"…|null","client_mutation_id":"…"}
```

Checks, in baseline order (422 `invalid_move` unless stated):

1. Blank baseline ID → "The generated assignment baseline is required."
2. Blank bed/from/to → "Choose a bed, current nurse, and target nurse."
3. `from == to` → "Choose a different nurse for this bed."
4. Blank mutation ID → "A client mutation ID is required."
5. Acknowledgements missing or not an array → "Warning acknowledgements must be an array."
6. Lock the owned shift; missing/foreign → 404 `shift_not_found`.
7. Ended or `status <> 'assigned'` → 409 `shift_not_assigned` "This shift is no longer available for assignment moves."
8. Override with the same `(shift, caller profile, client_mutation_id)` exists → 200 replay (below).
9. Stored `assignmentResult.id` ≠ body baseline → 200 `stale` "The generated assignment changed. Review the current board and try again."
10. Effective nurse ≠ `from_nurse_id` → 200 `stale` "This bed assignment changed. Review the current board and try again."
11. No generated assignment for the bed → "This bed does not have a generated assignment."
12. Bed not in `beds` → "This bed is no longer part of the active shift."
13. No bed state or blank `patient.initials` → "Only an occupied bed can be moved."
14. Target not in `nurses` → "The selected nurse is no longer on this shift."
15. Target not in the bed room's `assignmentResult.roomCoverage[].nurseIds` → "The selected nurse does not cover this room."
16. `acuity = red` and target `licenseType <> 'RN'` → "A red-acuity bed must be assigned to an RN."
17. Related swap given but no `swap` request with that ID, `status = accepted`, `sourceBedId = bed` → "Only an accepted swap for this bed can be linked."
18. Related swap whose `requestingNurseId ≠ from_nurse_id` or with a non-empty `completedOverrideId` → "Only an uncompleted accepted swap owned by the current nurse can be completed." (the trigger's own check, done first in Go).
19. Load after = baseline bed assignments whose effective nurse, with this bed set to the target, is the target. Over `maxPatientLoad` without an `over_max_load` acknowledgement → "Acknowledge the max-load warning before confirming."
20. Side limit = `sideLoadLimits.admitting.max` if the target covers any room on `admittingDoctorSideId`, else `nonAdmitting.max`. Over it without `over_side_load_limit` → "Acknowledge the side-load warning before confirming."

Acknowledgements are normalized as the baseline does: keep `over_max_load`,
`over_side_load_limit`, and `team_imbalance` with a non-blank message; `id` is
the supplied one or `override-warning-<uuid hex>`; the two load messages are
rebuilt as `"<name> has <n> assigned patients, above their max load of <m>."` /
`"… above the side load limit of <m>."` (name trimmed, else "The selected
nurse"); keep `nurseId`/`bedId` when present; add `acknowledgedByProfileId` and
`acknowledgedAt`.

Write: supersede the bed's active override (`superseded`, `superseded_at`),
insert the new active override, then set only `active_shifts.updated_at`. The
insert trigger completes a linked swap. One timestamp (`nextShiftTime`) is used
for `created_at`, `superseded_at`, `acknowledgedAt`, and `updated_at`.

Response 200 (camelCase, the RPC shape):

```json
{"status":"saved","override":Override,"activeAssignmentOverridesByBedId":{"<bedId>":Override}}
{"status":"stale","message":"…","currentBaselineAssignmentResultId":"…","currentEffectiveNurseId":"…","activeAssignmentOverridesByBedId":{…}}
```

`Override`: `id, shiftId, baselineAssignmentResultId, bedId, fromNurseId,
toNurseId, createdByProfileId, createdAt, status, serverSequence,
relatedSwapRequestId, warningAcknowledgements`; a replay's `override` also has
`supersededAt`. A unique-index violation (backstop under the shift lock) → 409
`move_conflict` "This bed assignment changed. Review the current board and try again."

### Issue requests (ticket 13)

`POST /joined-workspace/issue-requests` `{"message"}` → 201 `{"request"}`

- Trimmed message empty → 422 `invalid_request` "Add issue details before submitting."
- No linked access on an unended shift → 409 `not_joined` "Join a shift before submitting an issue."
- Lock fails (shift ended meanwhile) → 409 `shift_ended` "This shift is no longer active."
- Pending issue from this nurse with the same lower-cased trimmed message and no `sourceBedId` → 409 `request_pending` "This issue is already pending."
- Appends `{id:"nurse-request-<uuid hex>", type:"issue", status:"pending", requestingNurseId, requestingNurseName (access row), message, createdAt}`; bumps `updated_at`.

`POST /shifts/{id}/requests/{requestId}/issue-status` `{"status"}` → 200 `{"request"}`

- Not `open|reviewed|resolved` → 422 `invalid_request` "Choose open, reviewed, or resolved."
- Owned unended shift, else 404 `shift_not_found`.
- No `issue` with that (trimmed) ID → 404 `request_not_found` "The issue request is unavailable."
- Current (`issueReviewStatus`, default `open`) equals target → 200, no write.
- Allowed: open→reviewed, open→resolved, reviewed→resolved, resolved→open; else 409 `invalid_transition` "That issue status change is not allowed."
- reviewed: drop `issueResolvedAt`/`issueResolvedByProfileId`, set `issueReviewStatus`, `reviewedAt`, `reviewedByProfileId`. resolved: set `issueReviewStatus`, `issueResolvedAt`, `issueResolvedByProfileId`. open: drop all four audit fields, set `issueReviewStatus: open`. Bumps `updated_at`.

### Swap requests (ticket 14)

`POST /joined-workspace/swap-requests` `{"source_bed_id","message"}` → 201 `{"request"}`

- Blank bed → 422 "Choose the assigned bed for this swap request."; blank message → 422 "Add swap details before submitting."
- Not joined → 409 `not_joined` "Join a shift before submitting a swap request."; ended → 409 `shift_ended`.
- Bed has no generated assignment, or its **effective** nurse is not the caller's nurse → 422 "Choose one of your assigned beds for the swap."
- Pending swap from this nurse for the same bed with the same lower-cased trimmed message → 409 `request_pending` "This swap request is already pending."
- Appends the issue shape plus `sourceBedId`.

`POST /shifts/{id}/requests/{requestId}/swap-resolution` `{"status"}` → 200 `{"request"}`

- Not `accepted|declined` → 422 "Choose accepted or declined."
- Owned unended shift, else 404 `shift_not_found`.
- No pending `swap` with that ID → 409 `request_not_pending` "Only pending swap requests can be resolved."
- Sets `status`, `resolvedAt`, `resolutionNote` ("Accepted by charge" / "Declined by charge"); bumps `updated_at`.

Acceptance is separate from completion: the charge nurse later confirms a move
with `related_swap_request_id`, and the retained trigger stamps `swapCompletedAt`,
`swapCompletedByProfileId`, and `completedOverrideId`.

### Request threads (ticket 15)

Thread actor: the request (trimmed ID) exists on an unended shift with a
non-empty `requestingNurseId`, and the caller is the shift's charge owner or has
linked access to that nurse's slot. Otherwise 404 `thread_not_found` "You do not
have access to this request thread."

- `GET /shifts/{id}/requests/{requestId}/messages` → 200 `{"messages":[Message]}`
  ordered by `created_at, id`.
- `POST` same path `{"body","client_mutation_id?"}`:
  - Trimmed body empty → 422 "Write a message before sending."; over 1000 characters → 422 "Keep messages to 1000 characters or fewer."
  - Trimmed mutation ID over 120 characters → 422 "Message retry identifiers must be 120 characters or fewer." (blank means none)
  - Same `(shift, author, mutation ID)` with the same request and body → 200 `{"status":"duplicate","message"}`; different → 409 `mutation_id_reused` "That message retry identifier was already used."
  - Otherwise `INSERT … ON CONFLICT DO NOTHING`, then the same comparison if a concurrent send won → 201 `{"status":"saved","message"}`.

`Message`: `id, shiftId, requestId, authorProfileId, body, createdAt, clientMutationId` (null when absent).

## Database access

Migration `20261024180000_go_moves_requests_threads.sql`:

- `manual_assignment_overrides`: column-limited INSERT (not `id`/`server_sequence`) with a policy requiring an `active` row created by the caller on an owned, unended, assigned shift. Milestone 3's status/superseded_at UPDATE is reused.
- `active_shifts`: `go_joined_active_shifts_update` — USING and WITH CHECK `ended_at IS NULL AND go_private.caller_has_linked_access(id)`. Charge review reuses milestone 3's owner UPDATE policy.
- `nurse_request_messages`: SELECT of all columns and INSERT of `shift_id, request_id, author_profile_id, body, client_mutation_id`, both through `go_private.caller_is_thread_actor`; the insert also requires `author_profile_id` to be the caller's profile. No UPDATE/DELETE.

## Reviewed behavior differences

- Swap requests check the bed's effective nurse. The baseline checked the
  generated nurse, so a nurse given a bed by a manual move saw it but could not
  request a swap, and a nurse whose bed was moved away could still request one.
- Charge review actions name their shift; a request on another or ended shift is
  404 instead of acting on the charge nurse's newest shift.
- A bad swap link on a move is a 422 with the trigger's message instead of an
  unhandled trigger exception.

Edge differences found in review, accepted because realistic data cannot reach
them:

- Go trims Unicode whitespace (`strings.TrimSpace`); PostgreSQL `btrim` trims
  only spaces. Expo already trims with JavaScript `.trim()` before sending, so a
  body such as `"\n"` never reaches the server from the app.
- A snapshot without `sideLoadLimits` or a nurse's `maxPatientLoad` reads as a
  limit of 0 (warning required) instead of SQL NULL (never fires). Shift setup
  validation requires both values.
- A snapshot whose `beds`/`rooms`/`nurses` sections are malformed fails the move
  with 503 before the stale checks; the baseline could answer `stale`.
- With duplicate request IDs in one snapshot, review actions edit the first match;
  the baseline edited every match. Go always generates unique IDs.
- A submission on an ended shift is normally 409 `not_joined` (the newest-linked
  lookup already excludes ended shifts); `shift_ended` is the race case.
- A move whose `related_swap_request_id` is `""` is a link attempt that fails the
  swap check; only `null` or an absent field means no link.

## Verification

### 2026-10-24 - Local verification (no hosted database touched)

- Disposable local PostgreSQL 17 (UTF-8, `wal_level=logical`, trust auth on
  127.0.0.1:54329): managed stubs, captured baseline, all six migrations in order,
  shift-lifecycle fixtures. The new migration's pre/post privilege checks passed.
  Tests connect as `nurseflow_go`; fixtures are staged through an admin connection.
- Go: `gofmt -l .` and `go vet ./...` clean; `go test -race ./... -count=1`: 105
  top-level and 494 subtests pass. The only failures are the four template/ownership
  tests that need their own `testdata/schema.sql` fixtures (same as milestone 4);
  the only skip is the opt-in live key-discovery check.
- New database integration coverage (real Postgres, test doubles not involved):
  - Moves: success (snapshot untouched, one revision), replay, supersede, both
    stale cases, every rule rejection without a write, acknowledgement
    normalization, cross-owner 404, setup/ended shift, two concurrent moves on one
    bed (one saved, one stale, one active override), rollback after a forced
    failure, accepted-swap completion exactly once, and Realtime/notification row
    deltas equal to the retained `confirm_manual_assignment_override`.
  - Requests: issue submit/duplicate/not-joined, concurrent duplicate issues (one
    201, one 409), every issue transition and no-op, swap submit with effective
    ownership (moved-to allowed, moved-away rejected), accept/decline/repeat, and
    comparisons with the retained SQL functions.
  - Threads: owner and joined nurse share one thread; outsiders, another slot,
    unknown requests and ended shifts are 404; RLS rejects direct outsider and
    forged-author inserts; ordering; retries; six concurrent sends with one ID save
    one row; the insert broadcast fires; the list matches `list_nurse_request_messages`.
- Expo: `npx tsc --noEmit` and `npx expo lint` clean; `npx tsx --test tests/*.test.mjs`
  145 pass, 0 fail (Axios/Zod repository and store tests use mocked HTTP).
- Review: two-axis standards/spec review. Fixed: ADR wording, README, constraint-
  checked conflict mapping, narrow-struct override insert, shared review handler
  and error helper, store shift-ID helper, readable move decoding, type naming.
  Edge differences are recorded above.

### 2026-10-24 - Development migration and live checks

- Applied `20261024180000_go_moves_requests_threads.sql` only to `nurseflow-go-dev`
  (`nmitctyxtjmlakcsmnuj`) with `supabase@2.120.0 db query --linked --project-ref …
  --file …`; its pre/post privilege checks passed inside the migration transaction.
  `migration repair 20261024180000 --status applied` registered it; all six local
  and remote versions match.
- [Read-only catalog check](verify-moves-requests-role.sql): 13 rows, identical to
  the local cluster: column-limited override and message INSERTs (no `id`,
  `server_sequence`, or message `created_at`), message SELECT, no DELETE or message
  UPDATE, the four new policies, the thread predicate executable by `nurseflow_go`
  only, and the role still neither superuser nor RLS-bypassing.
- Advisors: 62 warning-level findings = milestone 4's 61 plus one expected
  `multiple_permissive_policies` warning (`active_shifts` UPDATE now has separate
  charge and joined-nurse policies). No new security findings.
- Live dedicated-role isolation via `backend/scripts/development.ps1`:
  `TestTemplates` 7/7 and `TestShifts` 6/6 passed.

### 2026-10-24 - Real-session browser walkthrough (Expo web, development)

Driven with Playwright in desktop Chromium against local Go (DPAPI helper) and
`nurseflow-go-dev`, with the charge nurse and the joined nurse in separate browser
contexts so both sessions stayed signed in. Two new synthetic accounts were created
through signup (see development-fixtures.md). The optimizer is not configured in
development, so one synthetic assignment was staged on the walkthrough shift only
(`.scratch/m5-stage-assignment.sql`, matched by shift ID, status and revision).

- Setup through Go: template "M5 Floor" (rooms 201/202, East side), shift start,
  nurses Ava and Ben, patients and acuity; Ben's invite generated and joined.
- Ticket 13: Ben sent an issue (201); the app's own duplicate guard blocked a
  resend, and a direct request returned 409 `request_pending`. The charge nurse saw
  it under Flags > Requests, marked it reviewed, resolved it and reopened it (all
  200); a direct reviewed-to-open request returned 409 `invalid_transition`.
- Ticket 15: Ben and the charge nurse each sent a message (201) and each saw both,
  in order. A retry with the same ID and body returned 200 `duplicate` with the
  same message ID; the same ID with another body returned 409 `mutation_id_reused`.
- Ticket 14: Ben asked to swap bed 202-1 (201); a direct swap request for Ava's bed
  returned 422. The charge nurse accepted (200; a second resolution returned 409
  `request_not_pending`), then used "Complete with assignment move" in the existing
  move dialog: the move (with `related_swap_request_id`) returned `saved`, and the
  request showed Completed with its completion time. Replaying that mutation ID
  returned the same override; the same move with a new ID returned `stale` naming
  Ava as the current nurse.
- Ticket 12 and the reviewed difference: a board move of 201-1 from Ava to Ben
  (swipe, Move dialog, load preview, confirm) returned `saved`. Ben's open screen
  switched to Room 201 through Realtime without a reload. Ben then requested a swap
  for that bed, which he holds only through the move; it was accepted (201) under
  the effective-nurse rule, and the charge nurse declined it. Ben's screen showed
  Declined live.
- Console: only the existing web push-listener warning, the expected first-signup
  `GET /profile` 404, and the deliberate 409s.

### Not verified

- Native Android/iOS and physical devices; live concurrent UI races (covered by
  local PostgreSQL integration tests); UI outage/retry.
- Over-limit acknowledgement warnings in the live dialog (the two-bed floor cannot
  exceed the limits; normalization is covered by unit and integration tests).
- An outsider account calling the thread routes live (covered by integration tests).
- Notifications remain disabled by user decision; notification rows were compared
  only in local PostgreSQL.
- Synthetic walkthrough accounts, template, shift, requests and messages remain in
  development; no cleanup was performed.
