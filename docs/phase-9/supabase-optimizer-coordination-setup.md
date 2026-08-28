# Phase 9 Optimizer Server Setup

This setup implements the Supabase side of Phase 9 Tasks 2.1-2.4 and the legacy
rerun-boundary retirement in Task 3.4. The executable
SQL is in
`optimizer-service/sql/phase9_optimizer_server.sql`.

Apply it only after the Phase 5 active-shift tables and Phase 8 manual assignment
override setup exist. Use a disposable or non-production Supabase project first.

## End-to-end flow

```text
Expo bearer token and four action fields
  -> FastAPI verifies the token
  -> prepare_optimizer_run authorizes the shift and coordinates retries
  -> Python normalizes, solves, builds, and independently validates output
  -> finalize_optimizer_run locks and rechecks the run and active shift
  -> one transaction saves the baseline and flags
  -> a successful rerun supersedes active manual overrides
  -> the existing active_shifts update wakes realtime and notifications
```

The phone never sends a trusted assignment result. The full shift snapshot is
returned only by the authorized prepare action and is not copied into the
`optimizer_runs` table.

The migration also revokes the Phase 8
`rerun_active_shift_assignment(uuid, text, jsonb)` function from `public`,
`anon`, and `authenticated`. Keeping the function definition temporarily makes
rollback inspectable, but a mobile credential can no longer use it to save a
self-authored baseline.

## Task 2.1: coordination and idempotency

`optimizer_runs` stores only operational coordination fields:

- shift, requesting profile, and client mutation IDs;
- expected `active_shifts.updated_at` revision and expected baseline ID;
- request and normalized-input fingerprints;
- optimizer version, coarse status/outcome, result ID, and timing.

The unique mutation index gives one client mutation one meaning. Prepare checks
an existing mutation before checking the current revision. That ordering is
important: a successful run changes the shift revision and baseline, but an
identical retry must still return the already-saved result.

An existing `running` mutation returns its current state without starting a
second solve. If a crashed request remains `running` beyond its 150-second lease,
the same mutation may reclaim that run and solve the still-current snapshot.
This lease is later than the 140-second host cutoff, so a healthy original
request cannot still be running. A different mutation for the same running
shift preconditions returns `in_progress`.

Direct `anon` and `authenticated` table access is revoked. The user-facing
prepare function derives the charge profile from `auth.uid()` and verifies
ownership itself.

## Task 2.2: authenticated Python endpoint

The service exposes:

- `POST /v1/assignment-runs`;
- `GET /healthz`;
- `GET /readyz`.

The action route accepts only:

- `shiftId`;
- `clientMutationId`;
- `expectedShiftRevision`;
- `expectedBaselineAssignmentResultId`.

JWT verification checks the configured Supabase JWKS, issuer, audience,
signature, expiry, and subject. The user token stays in request memory only and
is forwarded to prepare. The service-only key is used only for `finalize` and
`fail` RPCs.

The route returns typed `saved`, `running`, `stale`, `conflict`,
`invalid_input`, `timed_out`, `unavailable`, or `failed` states. It does not
return the assignment board; the app reloads Supabase after integration in Task
3.x.

## Task 2.3: atomic finalization

`finalize_optimizer_run` is executable only by `service_role`. It locks the run
and active shift, then rechecks:

- run status and identity;
- owning charge profile and active shift state;
- exact revision and prior baseline;
- fresh result ID;
- current team membership, rooms, beds, nurses, red-bed RN eligibility,
  coverage, and nurse capacity;
- objective summary shape.

The Python output validator remains the full independent clinical validation
gate. The SQL transaction is a second protection against corrupted or invented
payloads crossing the persistence boundary.

Only the success branch updates `active_shifts`. The new assignment result,
matching flags, run success, and rerun override supersession therefore commit or
roll back together. Stale and failed branches leave the previous baseline and
active overrides unchanged.

## Task 2.4: existing readers and signals

No second realtime channel or nurse result model is added.

- Successful finalization updates `active_shifts.shift_snapshot` and
  `updated_at`, so the existing active-shift realtime subscription and generic
  notification trigger see one committed source-of-truth change.
- Stale and failed runs update only `optimizer_runs`, so they cannot emit an
  assignment-updated signal.
- The existing `get_joined_nurse_assignment_view` continues reading the
  committed baseline plus active overrides and returns only the authorized
  nurse's effective beds.
- Joined users have no table grant or RLS policy for `optimizer_runs` and cannot
  receive the full board through that nurse-scoped RPC.

## Public app configuration

The Expo app needs only the optimizer service's public HTTPS base URL:

```text
EXPO_PUBLIC_OPTIMIZER_SERVICE_URL=https://your-optimizer-service.example
```

This URL is public app configuration, not a credential. The app obtains the
current user's short-lived Supabase access token from its existing secure
session and sends it as a bearer token for each optimizer request.

## Private service configuration

Set these only in the optimizer service environment or secret manager:

```text
NURSEFLOW_SUPABASE_URL
NURSEFLOW_SUPABASE_PUBLISHABLE_KEY
NURSEFLOW_SUPABASE_SECRET_KEY
```

Optional overrides:

```text
NURSEFLOW_SUPABASE_JWT_ISSUER
NURSEFLOW_SUPABASE_JWT_AUDIENCE
NURSEFLOW_SUPABASE_JWKS_URL
```

Never prefix the secret key with `EXPO_PUBLIC_`, place it in the mobile `.env`,
or send it in a response.

## Manual database validation

After applying the SQL in a disposable Supabase project:

1. Prepare as the owning charge nurse and confirm one `running` row is created.
2. Repeat the same mutation and confirm the same run ID returns without another
   row or solve.
3. Reuse the mutation with a different revision/baseline and confirm
   `conflict`.
4. Prepare as an unrelated or joined account and confirm authorization fails.
5. Finalize with a normal user token and confirm it is denied.
6. Finalize a valid initial run and confirm one new baseline is saved.
7. Finalize a valid rerun and confirm active overrides become `superseded`.
8. Change the shift before finalization and confirm `stale` leaves its baseline,
   flags, and overrides unchanged.
9. Corrupt a bed owner, RN rule, capacity, or coverage and confirm finalization
   returns `failed` without changing `active_shifts`.
10. Confirm success causes the existing realtime/notification path to run,
    while stale and failed runs do not.
11. Confirm the joined-nurse RPC returns only that nurse's effective beds and no
    optimizer run metadata.

The checked-in SQL test guide at `tests/optimizerRunCoordination.sql` provides
the focused queries. Live results must be recorded before production rollout.

The repository also includes `optimizer-service/tests/sql_phase9_fixture.sql`
and `sql_phase9_scenarios.sql`. They execute the functions against a minimal
disposable PostgreSQL schema and cover prepare/retry, grants, initial save,
successful rerun, stale and invalid no-commit behavior, and forced transaction
rollback. They do not replace Supabase-specific RLS, Realtime, notification, or
connected-session validation.
