# Assignment runs through Go and Python (milestone 6)

Milestone 6 covers tickets 16–19. The user authorized it on 2026-10-25 and settled
the decisions below in a grilling session. Ticket 18 (device notification
registration) and ticket 19's notification-navigation checks stay **deferred**
because notifications are disabled (user decision, 2026-10-24).

## Decisions

| # | Area | Decision |
| --- | --- | --- |
| 1 | Ownership | Go coordinates a run: prepare, finalize, and fail are Go transactions. Python only solves; on the new path it never reads or writes Supabase. See [ADR 0005](../adr/0005-go-coordinates-assignment-runs.md). |
| 2 | Legacy path | Additive. Python's `/v1/assignment-runs` and the `prepare/finalize/fail_optimizer_run` RPCs stay unchanged for production until ticket 23. |
| 3 | Service auth | Go → Python uses `Authorization: Bearer <NURSEFLOW_SOLVER_TOKEN>`, compared in constant time. Revisit Cloud Run IAM tokens in milestone 7. |
| 4 | Budgets | Go→Python call 125 s; Go run deadline 135 s with a 10 s finalize reserve; per-route write deadline; Expo 150 s timeout for this call only; recovery lease 150 s (the live SQL uses 90 s, the reviewed `phase9_optimizer_server.sql` 150 s). |
| 5 | Contract | `POST /active-shifts/{id}/assignment-runs`, camelCase body, Python's `{status, runId?, resultId?}` response and HTTP codes. |
| 6 | Identity | Finalize and fail run under the caller's verified identity with owner RLS; no service role. |
| 7 | Validation | `optimizer_output_validation_error` is ported to a pure Go function with the same codes. |
| 8 | Disconnect | Solve and finalize run on `context.WithoutCancel` plus Go's own deadline. |
| 9 | Transactions | Prepare transaction → solve with no lock held → finalize/fail transaction. Lock order is always run, then shift. |
| 10 | Solver contract | `POST /v1/solve` (below). Python unreachable → 503 `unavailable`. Amended 2026-10-25 after the live walkthrough: a request that provably never reached Python releases the run, so the same mutation's retry reclaims it immediately; other no-response failures keep the 150 s lease. |
| 11 | Configuration | Go refuses to start without `NURSEFLOW_SOLVER_URL` and `NURSEFLOW_SOLVER_TOKEN`. |
| 12 | Fingerprint | Go computes `sha256hex(shiftId ␟ revision(RFC 3339 UTC, nanoseconds) ␟ baselineOrEmpty)` (␟ = `\x1f`). |
| 13 | Database | `optimizer_runs` column grants and owner policies for `nurseflow_go`; the unique indexes stay the final race guard. |
| 14 | Python config | `/v1/solve` is enabled by `NURSEFLOW_SOLVER_TOKEN`, the legacy route by the Supabase settings; startup fails if neither (or only part of the Supabase set) is configured. |
| 15 | Verification | Local, then nurseflow-go-dev only after the user confirms, then a two-browser walkthrough. Timeout and invalid output are automated-only. |

## Expo → Go contract

`POST /active-shifts/{id}/assignment-runs` (charge nurse; bearer token; `{id}` is a UUID).

```json
{
  "clientMutationId": "optimizer-run-…",
  "expectedShiftRevision": "2026-10-25T18:00:00.123456Z",
  "expectedBaselineAssignmentResultId": null
}
```

- `clientMutationId`: required, non-blank text (trimmed). The app keeps it for a retry
  only after `unavailable`.
- `expectedShiftRevision`: required RFC 3339 timestamp; compared with `active_shifts.updated_at`.
- `expectedBaselineAssignmentResultId`: `null` for a first run, non-blank text for a rerun.
- Unknown fields, malformed JSON, or invalid values → 422 `{"status":"invalid_input"}`;
  body over 16 KiB → 413 `{"status":"invalid_input"}`.

Responses always use `{"status": …, "runId"?: …, "resultId"?: …}`:

| HTTP | status | Meaning |
| --- | --- | --- |
| 200 | `saved` | `runId` and `resultId`; the app reloads the workspace and checks the baseline ID. |
| 202 | `running` | The same mutation, or another run at the same revision, is still solving. |
| 409 | `stale` | The shift changed (`runId` when a run was recorded stale). |
| 409 | `conflict` | The mutation ID was reused with different preconditions. |
| 422 | `invalid_input` | Bad request, or the solver rejected the shift setup. |
| 504 | `timed_out` | The solver or Go's deadline ran out; the run is failed. |
| 503 | `unavailable` | Database or solver unreachable; nothing was saved. |
| 500 | `failed` | Solver failure, rejected output, or finalization failure. |
| 403 | `forbidden` | The shift is missing or owned by someone else. |

401 and the role checks come from the shared middleware in the usual Go error
envelope; the Expo parser maps 401/403 by HTTP status.

## Go → Python solver contract

`POST /v1/solve` with `Authorization: Bearer <NURSEFLOW_SOLVER_TOKEN>`, body up to 1 MiB:

```json
{ "runId": "uuid", "shiftSnapshot": { "…": "the stored active_shifts.shift_snapshot" } }
```

| HTTP | Body | Go records |
| --- | --- | --- |
| 200 | `{assignmentResult, flags, objectives, inputFingerprint, optimizerVersion}` | finalize |
| 422 | `{"status":"invalid_input"}` | fail `invalid_input` → 422 |
| 504 | `{"status":"timed_out"}` | fail `timed_out` → 504 |
| 500 | `{"status":"failed"}` | fail `solver_failed` → 500 |
| 401 | `{"status":"unauthorized"}` | fail `internal_failure` → 500 (misconfigured token) |
| 502, 503, or a 504 without `{"status":"timed_out"}` | — | nothing recorded → 503 `unavailable` (a gateway in front of Python answered, not Python) |
| any other status, a redirect, or a body over 4 MiB | — | fail `internal_failure` → 500 (redirects are never followed, so the token cannot leak) |
| connection refused or host not found (never delivered) | — | run released (`outcome_summary.errorCode = solver_unreachable`, still `running`) → 503 `unavailable`; the same mutation's retry reclaims it immediately |
| no response after the request was sent | — | nothing recorded → 503 `unavailable`; the run waits for the 150 s lease |
| Go's 125 s deadline | — | fail `timed_out` → 504 |
| 200 with an unreadable body | — | fail `internal_failure` → 500 |

`runId` is only for correlating private Python logs. Python keeps its existing
normalization, CP-SAT solve, 120 s solve budget, output validation, and timeout logging.

## Coordination in Go

**Prepare** (one `WithWriteIdentity` transaction; mirrors `prepare_optimizer_run`):

1. Lock the caller's run with this `(shift_id, requested_by_profile_id, client_mutation_id)`, if any.
2. Lock the owned shift (missing/foreign → `forbidden`). If step 1 found nothing, look again
   without a lock (two first requests can both miss).
3. Preconditions match when the shift has not ended, its status is `setup` or `assigned`,
   `updated_at` equals the expected revision, and the trimmed `assignmentResult.id` equals
   the expected baseline (both absent counts as equal).
4. Existing run: a different fingerprint → `conflict`. A `running` run started at least
   150 s ago (database time) is reclaimed: it becomes `stale` if preconditions no longer
   match; otherwise `started_at` is reset, `outcome_summary` is cleared, and it is solved again.
   Any other existing run returns its recorded outcome: `succeeded` → `saved`, `stale` →
   `stale`, `failed` → `invalid_input`/`timed_out`/`failed` by its `errorCode`, `running` → `running`.
5. No existing run and the preconditions fail → `stale` (no run ID).
6. Another `running` run for this shift at the same revision and baseline → `running` with its ID.
7. Otherwise insert the run (`started_at` uses the database default) and solve it.

**Solve** happens outside any transaction, on `context.WithoutCancel(r.Context())` with a
135 s deadline; the Python call has its own 125 s deadline. If less than the 10 s reserve
remains after the solve, Go fails the run as `timed_out`.

**Finalize** (one transaction; mirrors `finalize_optimizer_run`):

1. Lock the caller's run, then its shift.
2. `succeeded`: identical result ID, fingerprint, and version → `saved`; otherwise `failed`.
   `stale` → `stale`; `failed` → `failed`.
3. The shift is missing, ended, not `setup`/`assigned`, or its revision or baseline changed →
   mark the run `stale` (errorCode `stale`, with fingerprint and version) → `stale`.
4. Go validation fails, or the new result ID equals the expected baseline
   (`result_id_reused`) → mark the run `failed` with that code → `failed`.
5. Write the snapshot with `assignmentResult` and `flags` replaced and `status = "assigned"`
   (every other key is kept). Set the row's `status = 'assigned'`, and advance `updated_at`
   with `nextShiftTime`. For a rerun, supersede every active manual move at that same time.
   Mark the run `succeeded` with `assignedBedCount`, `unassignedBedCount`, and
   `objectiveSummary`. This `active_shifts` update is the only one, so the existing
   Realtime and notification triggers see exactly one committed change.

**Fail** locks the caller's run and changes it only while it is `running`.
Failure-recording errors are logged and never replace the outcome being returned.

### Deliberate differences from the SQL

- The lease is 150 s rather than the live 90 s, so it exceeds the 135 s run deadline.
- Malformed solver output (blank result ID, fingerprint, or version) marks the run
  `failed`. The SQL returned `failed` without recording it, so the run stayed
  `running` and blocked new runs at that revision until the lease expired.
- Malformed output is checked before the stale check, so a changed shift with malformed
  output is recorded `failed`, not `stale`. Either way nothing is saved.
- The Go output validator is stricter than the SQL. In SQL, a missing key compares as
  NULL, so it slips through; in Go, a missing array, team or coverage `nurseIds`,
  objective, bed acuity, or red-bed nurse `licenseType` is rejected with the matching
  code. A child-ID prefix is a literal `resultId-` (SQL `LIKE` would treat `%`/`_` as
  wildcards). Python never produces these shapes.
- A finalize error only counts as `unavailable` (503, run left `running`) when the
  database could not be reached or timed out. Any other finalize error records
  `finalization_failed` and returns 500, like the legacy Python flow.
- The expected revision is truncated to microseconds (Postgres precision) before it is
  compared and fingerprinted, matching the SQL's timestamp cast.
- Python's `/v1/solve` returns 500 `failed` for both solver errors and unexpected
  exceptions, so Go records `solver_failed` for both. The legacy flow recorded
  `internal_failure` for the latter. The legacy route's pipeline now shares
  `solve_snapshot` with `/v1/solve`; its responses are unchanged.
- The request fingerprint uses Go's RFC 3339 revision text. Fingerprints are compared
  only within one mutation ID, and the two paths never share one.

## Ticket 19: remaining direct access and retained infrastructure

Inventory taken on 2026-10-25 from `src/` (excluding tests), the Python service, and the
captured database triggers. Everything below is **retained on purpose** unless marked
otherwise; ticket 23 retires the legacy paths after cutover.

| Caller | Access | Classification |
| --- | --- | --- |
| `authRepository.ts`, `AuthSessionContext.tsx`, `goApiAuth.ts`, `shiftRepository.ts`, `floorTemplateRepository.ts`, `optimizerRepository.ts` | `supabase.auth.*` sign-up, sign-in, sign-out, session reads | Retained: Supabase Auth owns sign-in and refresh (plan decision). |
| `realtimeWorkspaceRepository.ts` | Private Realtime broadcast channels (`realtime.setAuth`) | Retained: Supabase Realtime carries identifier-only change events; every refetch goes through Go. |
| `serverWorkspaceRepository.ts` `loadJoinedNurseNotificationTargetState` | Direct `shift_nurse_access` select | Not migrated: used only by notification-tap routing, which is off while notifications are disabled (deferred with ticket 19's notification part). |
| `devicePushTokenRepository.ts` | `register_device_push_token`, `disable_current_device_push_token` RPCs | Not migrated: ticket 18, deferred because notifications are disabled. |
| Python `/v1/assignment-runs` | `prepare_optimizer_run` (user token), `finalize_optimizer_run` / `fail_optimizer_run` (secret key) | Legacy production path; replaced on this branch by Go plus `/v1/solve`; retire in ticket 23. |
| Database triggers | `broadcast_nurseflow_*` (Realtime), `enqueue_*` (notification outbox), `complete_swap_request_from_override` | Retained: they fire on Go's committed writes exactly as on the RPC writes. |
| Notification outbox | `notification_events` rows written by the `enqueue_*` triggers | Retained. No delivery worker is in this repository; delivery remains outside the migration. |

Every other app read and write (templates, shift lifecycle, profiles, invites, joining,
the joined-nurse view, moves, requests, threads, and assignment runs) now goes through Go.

## Verification

### 2026-10-25 - Local verification (no hosted database touched)

- Go: `gofmt -l .` and `go vet ./...` clean; `go test -race ./... -count=1` passes in every
  package (database tests skip without the opt-in environment).
- Disposable local PostgreSQL 17 (UTF-8, `wal_level=logical`, trust auth on 127.0.0.1:54329):
  managed stubs, captured baseline, all seven migrations in order, shift-lifecycle fixtures,
  connected as `nurseflow_go`. All `TestAssignmentRun*` tests pass. They cover:
  - first run and rerun, including atomic override supersession;
  - replay of succeeded, failed, and stale runs;
  - conflict, stale at prepare, and stale at finalize after a setup save or move;
  - an in-progress run for another mutation;
  - lease reclaim (matching and stale) and the unreachable-solver release and reclaim;
  - rejected output leaving `active_shifts` untouched, and cross-owner denial;
  - eight concurrent duplicate prepares producing one run;
  - Realtime and notification row deltas equal to the retained SQL path.
- The only failures in the full package are the three known template fixture tests
  (`TestTemplateWriteRollbackAndReferencesIntegration`,
  `TestTemplateListIsolationIntegration/Alpha_own_templates`,
  `TestTemplateListOrderingIntegration`). They need their own `testdata/schema.sql`. Run in the
  same pass, their leaked rows also fail `TestDatabaseOwnershipIntegration/Alpha`, so run
  them last or separately.
- Python 3.14.4 (3.13 is not installed on this machine; production pins 3.13.14):
  118 tests pass, including `/v1/solve` and the configuration combinations.
- Expo: `npx tsc --noEmit` and `npx expo lint` clean; `npx tsx --test tests/*.test.mjs`
  152 pass, 0 fail (repository tests use mocked Axios).
- Review: two-axis standards/spec review. Fixed: finalize error mapping, revision precision,
  HTTP mapping moved to `httpapi`, package direction, typed run statuses, duplication,
  finalize readability, and a typed (stricter) output validator.

### 2026-10-25 - Development migration and live checks

- Applied `20261025120000_go_assignment_runs.sql` only to `nurseflow-go-dev`
  (`nmitctyxtjmlakcsmnuj`) with `supabase@2.120.0 db query --linked --project-ref … --file …`.
  Its pre/post privilege checks passed inside the migration transaction.
  `migration repair 20261025120000 --status applied` registered it; all seven versions match.
- [Read-only catalog check](verify-assignment-runs-role.sql): the column grants are exactly
  decision 13. There are three `go_charge_optimizer_runs_*` policies, RLS is on, there is no
  DELETE, `authenticated` has no access, and `nurseflow_go` is neither superuser nor
  `bypassrls`.
- Live isolation with the DPAPI-saved dedicated-role credential: template list 7/7 and
  shift workspace 6/6 pass.
- Stack: Go API (development database, DPAPI credential) on 8080; Python in solver-only mode
  on 8090 with a random per-session token; Expo web on 8081. Charge nurse (Charge M5) used
  Playwright; a joined nurse (fresh synthetic account "Nurse M6") used a separate Chrome
  instance.
- Direct checks: the solver rejects a missing or wrong token (401). The legacy route is
  absent in solver-only mode (404). Go rejects an unauthenticated run (401).
- Real-session API calls from the charge browser (the token never left the page), against
  the M5 shift with baseline `m5-walkthrough-assignment-1` and two active manual moves:
  - The rerun saved (200), superseded both moves, and preserved every other snapshot key.
  - Replay returned the same run and result.
  - Stale revision → 409 `stale`; old baseline with a new mutation → 409 `stale`.
  - Reused mutation with different preconditions → 409 `conflict`.
  - Unknown body field → 422. Browser CORS from the Expo origin passed.
- Expo UI first run (after a Go reopen): with the solver stopped, Run assignment showed the
  "unavailable" message and "Retry assignment". The walkthrough found that an immediate
  retry answered "still calculating" until the 150 s lease. The user chose the
  unreachable-solver release (decision 10 amended).
  - Before the fix: Retry after the lease reclaimed the run and saved it.
  - After the fix: Retry 18 s after the failure saved straight away.
  - The development database shows one run row per mutation in both cases.
- Joined nurse: invite generated in the UI, the new account joined with the code, and the
  scoped view showed the nurse's bed through Go. A rerun produced exactly one Realtime event
  on the nurse device, followed by one `GET /joined-workspace` refetch. Reopening had already
  removed the previous joined nurse's access ("Removed").
- Still not exercised live at this point: solver timeout and invalid output, reconnect,
  sign-out, End Shift, unsaved input, native, and Python 3.13. These were completed in the
  follow-up session below, except native.
- Temporary servers were stopped and the local token file deleted. Development fixture data
  (Charge M5's shift, new runs, the "Nurse M6" account) remains in `nurseflow-go-dev`.

### 2026-10-25 - Follow-up: Python 3.13, ticket 19, and solver failures

- **Python 3.13:** in the official `python:3.13.14-slim` image (production's pin) with the
  locked `requirements.lock` (OR-Tools 9.15.6755), all 118 tests pass. The service source and
  `tests/fixtures` were mounted read-only and bytecode writing was off. A first attempt
  without `tests/fixtures` mounted errored on the missing shared fixture file.
- **Solver failures, live.** Go, the development database, and Expo were real. A throwaway
  **stub** on port 8090 implemented the `/v1/solve` contract with the same token; it lives in
  the scratchpad, not the repository.
  - The stub returned Python's `504 timed_out`. The UI showed "Assignment calculation timed
    out", and the run was `failed`/`timed_out`.
  - The stub returned well-formed output assigning an occupied bed to a nurse who doesn't
    exist. Go's validator rejected it, the UI showed "Assignment could not be calculated",
    and the run was `failed`/`unknown_assignment_nurse`.
  - The stub hung. The UI showed "Calculating…" for 125 s, then "timed out", well inside
    Expo's 150 s limit. The run was `failed`/`timed_out` with `duration_ms` 126266.
  - In all three cases the shift stayed in setup with no assignment. Real Python then saved
    the next run.
- **Ticket 19, live on web.** Charge nurse in Playwright, joined nurse ("Nurse M6") in a
  separate Chrome instance.
  - *Unsaved input:* the nurse typed an issue without sending it. A charge rerun produced one
    change event and a refetch, and the draft was kept.
  - *Offline:* DevTools offline mode. The missed rerun was not delivered. After the Realtime
    heartbeat timeout, the badge showed "Live issue" with a **Refresh** button, and the cached
    assignment and draft stayed visible.
  - *Reconnect:* back online, the listener resubscribed and showed "Live", keeping the draft.
    **Finding (predates the migration):** the app did not refetch automatically after a
    reconnect, so a change made while offline appeared only after the nurse pressed Refresh or
    the next change event arrived. `realtimeWorkspaceRepository.ts` and the
    connection-state handlers were identical to `main`. Fixed at the user's request (below).
  - *Sign-out:* the app returned to `/login`, cleared the stored session, and showed no shift
    data. Signing back in restored the joined shift through Go.
  - *Access removal:* a charge reopen switched the nurse screen to "Access removed" within
    seconds.
  - *End Shift:* after the nurse rejoined with a new code, the charge ended the shift in the
    UI. The nurse screen switched to "Shift ended" within seconds. The next shift's
    carry-over review offered the previous nurses and patients, and its first UI run saved.
- **Native: initially blocked by the environment, not the app** (resolved below). The Android emulator
  (`Pixel_5_API_34`, read-only) failed to start while Docker Desktop held the hypervisor. With
  Docker stopped and the software renderer, it booted and the existing debug app ran the
  current Metro bundle ("Running main"). But the screen captured blank and `uiautomator`
  produced no dump, so no native interaction was possible. The emulator also reports itself
  out of date. No physical device was available. Native remains unverified for milestone 6.
- **Cleanup:** temporary servers, `adb reverse` mappings, the emulator, and the token file were
  stopped or deleted; Docker Desktop was stopped. Development data remains: the ended M5
  shift and its runs, a new active "M5 Floor" shift for Charge M5, and the "Nurse M6" account.

### 2026-10-25 - Reconnect refetch and native Android

- **Reconnect refetch (user-requested product fix):** `subscribeToPrivateBroadcastChannels`
  tracks, per subscription, whether it has been live and has since dropped. When it returns
  to live it calls a new `onReconnected` exactly once. The charge board, the joined-nurse
  view, and request threads each refetch once through Go; a fresh subscription's first live
  never counts. Eight repository tests were written first. They cover the first live, each
  drop status, repeated drops, a drop before the first live, a fresh instance,
  multiple channels, and no call after stopping. The wiring in `ServerWorkspaceContext` and
  `useRequestThread` is type-checked but not rendered in tests (the suite has no React
  renderer). Expo: `tsc` and lint clean, 160 pass, 0 fail.
- **Emulator:** the local emulator binary 32.1.15 crashed with the host GPU and drew nothing
  with the software renderer. It was replaced with the stable 37.2.12 package from Google's
  SDK repository (SHA-1 checked against the repository listing); the old copy remains at
  `Sdk/emulator.bak-32.1.15`. Docker Desktop must not run at the same time (hypervisor
  conflict).
- **Native Android, live** (`Pixel_5_API_34` read-only, existing debug app
  `com.pfrog123.firstapp` on the current Metro bundle, `adb reverse` 8080/8081; real Go,
  Python, and development data; driven with `adb` input and `uiautomator`):
  - Nurse M6 signed in. The profile and workspace loaded through Go.
  - *Joined nurse:* the nurse joined with a code generated on web, the scoped assignment
    showed "Room 201, Bed 1", and Realtime reached Live. A web rerun produced one change
    event and one refetch on Android.
  - *Reconnect fix on device:* Wi-Fi and mobile data were turned off. Android reported
    "transport failure" and the badge showed "Live issue" with Refresh. A web rerun while
    offline was not delivered. With the network back, the listener went live, logged
    "reconnected; refreshing nurse-scoped view", refetched once, and showed "Live".
  - *Charge run on device:* a template was created for Nurse M6 through Go. On Android the
    nurse started a shift and, through the UI, added two RN nurses, entered two patients
    with acuity, reviewed, and ran the assignment. Go and real Python saved it, and the board
    showed Cleo/Drew with Team A/Team B. This is the 150 s Axios run call on React Native's
    networking.
- iOS and physical phones were not tested (none available).
- **Cleanup:** the emulator, reverse mappings, servers, token file, and downloaded packages
  were removed. Additional development data: the "M6 Native Floor" template and its active
  shift for Nurse M6, and Nurse M6 linked to Charge M5's new shift.
