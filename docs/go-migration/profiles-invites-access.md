# Milestone 4: Profiles, invites, and joined-nurse access

Status: done on 2026-10-24. Tickets 08–11 are implemented and verified locally, against the
development database, and through a real-session browser walkthrough (limits below).
Tickets 08–11. Glossary terms are in the root `CONTEXT.md`; the joining
database boundary is [ADR 0003](../adr/0003-invite-code-capability-policies.md).

## Settled decisions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Glossary | Every profile has role `charge_nurse`; a **joined nurse** is a charge-nurse profile with *linked* nurse access to another charge nurse's active shift. Not a separate role. |
| 2 | Profile endpoints | `GET /profile` (load; 404 `profile_missing`) for session restore; `PUT /profile` (no body; load-or-create) for sign-in/signup. Identity required, no role check. Unsupported roles are returned as data; Expo's mapper keeps rejecting them. |
| 3 | Display name | From verified token claims: `user_metadata.display_name` (trimmed) → `email` → `"NurseFlow user"`. Role is always server-chosen `charge_nurse`. Existing profiles are never changed. |
| 4 | Concurrent first login | One write transaction: `INSERT … ON CONFLICT (auth_user_id) DO NOTHING`, then `SELECT`. Column-limited INSERT grant and an identity-matching insert policy. |
| 5 | Invite codes | Go generates the code with `crypto/rand` (alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, length 6), stores lowercase-hex SHA-256 of the normalized code, expiry = database `now() + 24 hours`. The raw code is returned once with `Cache-Control: no-store` and never logged. `token_hash` is never returned; `tokenHash` leaves the Expo model. |
| 6 | Generate/regenerate | `POST /shifts/{id}/invites` and `POST /shifts/{id}/invites/regenerate`, body `{nurse_id}`. One transaction: lock the owned unended shift, re-check eligibility from the stored snapshot plus active overrides, revoke (regenerate only), insert. Generate with an active invite → 409 `invite_exists`; the partial unique index is a backstop mapped to the same 409. |
| 7 | Invite/access read | `GET /shifts/{id}/invites` → `{"invites":[…],"access":[…]}` from one read transaction; `created_at DESC` / `updated_at DESC`; rows as stored. |
| 8 | Joining boundary | Transaction-local `nurseflow.invite_token_hash` capability policies (ADR 0003). |
| 9 | Code transport | `POST /invites/validate` and `POST /invites/accept`, body `{code}`. Expo keeps its format pre-check; Go re-normalizes, re-checks and hashes. Domain outcomes are 200 with `valid` / `joined` / `blocked` + `reason` (the eight existing reasons). |
| 10 | Same-profile race | `pg_advisory_xact_lock` keyed on the joining profile ID serializes that profile's joins, so the one-active-shift rule holds. All other existing accept behavior is preserved. |
| 11 | Joined workspace | `GET /joined-workspace` → `{"assignment": {…} \| null}` in the existing camelCase RPC shape. Go reads the access row, snapshot, and overrides; a pure Go function builds the narrow projection. |
| 12 | Notifications | Disabled by user decision: `EXPO_PUBLIC_NOTIFICATIONS_ENABLED` (default off) hides the permission card and skips permission prompts, token registration/disable, tap handling and the recovery route. The notification-target lookup is **not** migrated. Database triggers and Realtime live refresh are unchanged. |
| 13 | Verification | Local PostgreSQL first; then the agent shows the migration SQL and applies it to `nurseflow-go-dev` with the DPAPI helper and runs live isolation tests. A real-session walkthrough with the user is required before marking done. |

## API contracts

All routes require `Authorization: Bearer <Supabase access token>`. Errors use the
existing `{"error":{"code","message"}}` envelope; database failures are 503
`database_unavailable`. Row fields are snake_case, matching earlier Go responses.

### Profiles (ticket 08)

`GET /profile` and `PUT /profile` return 200:

```json
{"profile":{"id":"…","auth_user_id":"…","display_name":"…","role":"charge_nurse","created_at":"…","updated_at":"…"}}
```

`GET` returns 404 `profile_missing` when no row exists. `PUT` never returns
404. Neither accepts a request body or a client-chosen identity, name, or role.

### Invites for the charge nurse (ticket 09)

Owned, unended shift required (charge-nurse middleware plus ownership). Missing
or foreign shift → 404 `shift_not_found`.

- `GET /shifts/{id}/invites` → 200 `{"invites":[InviteRow],"access":[AccessRow]}`.
  - `InviteRow`: `id, shift_id, nurse_id, created_by_profile_id, status, created_at, expires_at, used_at, used_by_profile_id, revoked_at` (no `token_hash`).
  - `AccessRow`: `id, shift_id, nurse_id, nurse_name, nurse_profile_id, nurse_email, status, created_at, updated_at`.
- `POST /shifts/{id}/invites` and `POST /shifts/{id}/invites/regenerate`, body
  `{"nurse_id":"…"}` (snake_case like other Go request bodies) → 201 `{"code":"K7QX2M","invite":InviteRow}` with
  `Cache-Control: no-store`.
  - Ended shift → 409 `shift_ended`: "Nurse invites can only be created for an active shift."
  - Nurse not in the stored snapshot → 422 `nurse_not_on_shift`: "Choose a nurse from the active shift before creating an invite."
  - No occupied effective bed → 422 `nurse_unassigned`: "Assign at least one patient to this nurse before generating a code."
  - Generate with an active invite → 409 `invite_exists`: "This nurse already has an active invite for this shift."

Eligibility matches `getNurseAssignedPatientCount`: count beds whose effective
nurse (active manual override `to_nurse_id`, else the baseline
`assignmentResult.bedAssignments` nurse) is this nurse and whose bed state has
non-blank patient initials. No assignment result → zero.

### Joining (ticket 10)

Charge-nurse profile required (every app profile). Body `{"code":"…"}`.

- `POST /invites/validate` → 200, one of:
  - `{"status":"valid","invite_id","shift_id","nurse_id","nurse_name","floor_name","expires_at"}`
  - `{"status":"blocked","reason":"…"}`
- `POST /invites/accept` → 200, one of:
  - `{"status":"joined","access_id","shift_id","nurse_id","nurse_name","floor_name"}`
  - `{"status":"blocked","reason":"…"}`

Reasons: `invalid_format`, `not_found`, `expired`, `revoked`, `already_used`,
`ended_shift`, `stale_nurse`, `participation_conflict`. Both responses use
`Cache-Control: no-store`; neither returns patient or assignment data.

Order of checks preserves `accept_shift_nurse_invite_code` /
`validate_shift_nurse_invite_code` in the captured baseline: own unended charge
shift (accept only) → newest invite with the hash (accept locks it) → revoked →
used → expired by status or time → shift missing/ended → nurse missing from the
snapshot → linked to a different unended shift/slot → (accept) existing linked
row for this slot owned by another profile is `already_used`; own linked row is
reused; otherwise the newest `pending_link`/`removed` row is relinked with the
snapshot name and a null email, else a linked row is inserted → invite marked
`used` with `used_at`, `used_by_profile_id`, `updated_at`.

### Joined workspace (ticket 11)

`GET /joined-workspace` → 200 `{"assignment": JoinedAssignment | null}` where
`JoinedAssignment` matches `get_joined_nurse_assignment_view`:

```json
{
  "access": {"id","shiftId","nurseId","nurseName","nurseProfileId","nurseEmail","status","createdAt","updatedAt"},
  "shiftId": "…", "floorName": "…", "nurseName": "…",
  "assignedBeds": [{"bed":{…},"bedState":{…}|null,"doctorSide":{…},"room":{…}}],
  "requestHistory": [{…request…, "completedAssignmentChangedLater": true?}]
}
```

- Access: newest (`updated_at DESC`) linked access for the caller's profile on an unended shift.
- Assigned beds: baseline `assignmentResult.bedAssignments` order, effective nurse
  (active override wins) equals the access nurse, and only entries whose bed, room
  and doctor side all resolve. `bedState` may be null.
- Request history: `nurseRequests` entries whose `requestingNurseId` is the access
  nurse, in snapshot order. Add `completedAssignmentChangedLater: true` when
  `completedOverrideId` is non-empty and no **active** override has that ID.

## Database access (one new migration)

Existing client policies, triggers, constraints and RPC grants are preserved.
Use ADR 0001's `NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid`
identity, wrapped as `(SELECT …)` initplans like `20261020055621`.

- Profiles: `INSERT (auth_user_id, display_name, role)`; insert policy requiring the row's `auth_user_id` to equal the transaction identity.
- Charge invites: `SELECT` of every non-hash invite column plus `token_hash` (needed to match a presented hash; never returned); `INSERT (shift_id, nurse_id, created_by_profile_id, token_hash, status, expires_at)` with an owner policy; `UPDATE` adds `revoked_at`.
- Charge access: `SELECT` of all `AccessRow` columns.
- Capability (`nurseflow.invite_token_hash`): read the invite with that hash and its shift; update that invite (`status, used_at, used_by_profile_id, updated_at`); read the access rows for that invite's shift/nurse; insert/relink an access row for that shift/nurse whose `nurse_profile_id` is the caller's profile (`INSERT`/`UPDATE` of `nurse_name, nurse_profile_id, nurse_email, status, updated_at`).
- Joined nurse: read access rows where `nurse_profile_id` is the caller's profile; read `active_shifts` and `manual_assignment_overrides` where the caller has linked access to that shift.

`SELECT … FOR UPDATE` requires an UPDATE privilege and a passing UPDATE policy.

Implementation notes from review:

- Policy cycles: the new `active_shifts` checks call two yes/no `SECURITY DEFINER`
  predicates in a `go_private` schema usable only by `nurseflow_go` (ADR 0003).
- The new UPDATE column grants also reach milestone 3's charge-owner update
  policies, so `RESTRICTIVE` Go update policies allow only `removed` access rows
  or rows linked to the caller, and only `revoked`/`expired` invites or invites
  used by the caller.
- Accept locks the caller's own linked row for the slot, matching the baseline;
  another profile's linked row is read and reported as `already_used`.

## Reviewed behavior differences

- A joined nurse with no remaining beds receives `assignedBeds: []`. The
  baseline function returned `null`, which the existing Expo mapper rejected as
  an invalid server shape, so that nurse previously saw an error state.
- `GET /shifts/{id}/invites` on an ended shift returns 404 `shift_not_found`.
- A per-profile advisory lock serializes that profile's joins, so the existing
  participation check (newest linked access on an unended shift) cannot be
  passed twice concurrently.
- An unknown `blocked` reason is rejected by Expo as an invalid response rather
  than mapped to `not_found`; Go only emits the eight listed reasons.
- Go's profile insert policy also requires `role = 'charge_nurse'`.
- A missing profile during validate/accept maps to the existing `not_found`
  message, as the baseline functions returned.

## Verification

### 2026-10-24 - Local verification (no hosted database touched)

- Go: `go vet ./...` and `gofmt -l .` clean; `go test -race ./... -count=1`
  passes in every package (fakes; database tests skip without the opt-in env).
- Local PostgreSQL 17 (fresh UTF-8 cluster on 127.0.0.1, managed stubs, captured
  baseline, all five migrations in order, shift-lifecycle fixtures), connected as
  `nurseflow_go`: 10 top-level tests, 53 PASS, 0 SKIP, 0 FAIL, plus two clean
  repeat runs of the concurrency tests. Coverage includes concurrent first
  `PUT /profile`, forged profile inserts, generate/regenerate atomicity and
  concurrency, cross-owner denial, every validate/accept reason compared with the
  retained SQL function, two profiles racing one code, one profile racing two
  shifts, revoked codes, accept waiting on a concurrent removal, charge-owner
  forging denied by the restrictive guards, capability isolation, and the joined
  view (joined, removed, ended, reassigned away, cross-user) compared with
  `get_joined_nurse_assignment_view`. Milestone 3 lifecycle tests still pass.
- Expo: `npx tsc --noEmit` and `npx expo lint` clean; `npx tsx --test tests/*.test.mjs`
  130 pass, 0 fail (Axios/Zod repository tests use mocked HTTP).
- Review: two-axis standards/spec review; findings fixed (restrictive update
  guards, caller's linked-row lock, join-flow error wording, snake_case
  `nurse_id`, de-duplication, glossary naming).
- The template list/write integration tests need their own `testdata/schema.sql`
  fixtures (see template-list.md) and were not part of this baseline-cluster run.

### 2026-10-24 - Development migration and live checks

- The user applied `20261024120000_go_profiles_invites_access.sql` only to
  `nurseflow-go-dev` (`nmitctyxtjmlakcsmnuj`) with
  `supabase@2.120.0 db query --linked --project-ref … --file …`; its pre/post
  checks passed. Migration repair registered it; all five versions match.
- [Read-only catalog check](verify-profiles-invites-role.sql): 39 rows,
  identical to the local cluster (column grants, nine new policies including two
  restrictive guards, helpers executable only by `nurseflow_go`, no delete or
  profile update, role neither superuser nor RLS-bypassing).
- Advisors: 61 findings = the 55 existing plus 6 expected
  `multiple_permissive_policies` performance warnings from the separate charge,
  capability, and joined-nurse policies. No new security findings.
- Live dedicated-role isolation via `backend/scripts/development.ps1`:
  `TestTemplates` 7/7 and `TestShifts` 6/6 passed.
- Local Go API against development: all six new routes return 401
  `unauthenticated` without a valid token.

### 2026-10-24 - Real-session browser walkthrough (Expo web, development)

Driven with Playwright in desktop Chromium against local Go (DPAPI helper) and
`nurseflow-go-dev`, using two new synthetic accounts (see development-fixtures.md):

- Fresh signup: `GET /profile` 404 → `PUT /profile` 200; the workspace showed the
  token-derived name and the empty template state. Reload restored the session;
  sign-out and returning sign-in worked. An Auth user with no profile was
  provisioned on its first sign-in.
- No notification bell or permission prompt with the flag unset.
- Join screen: `ABC` showed the format message without a request; `ZZZZZZ`
  returned `blocked/not_found` with the existing message.
- Template, shift start, nurses, patients and acuity saved through Go. The
  optimizer is not configured in development, so the user staged one synthetic
  assignment on that shift only (`.scratch/m4-stage-assignment.sql`, matched by
  shift ID and revision).
- Invites: list loaded; generate → 201 with a code; regenerate (with the existing
  confirmation) → 201 with a new code. The old code was refused as no longer
  active; the new code entered in lowercase joined (`validate` then `accept`).
- Joined workspace showed only the joined nurse's bed and patient; the other
  nurse's patient was absent from the response. The join response carried no
  patient data. Reusing the code returned `already_used`. The charge invites
  screen showed the nurse as joined.
- End Shift → 200; the joined nurse's home dropped the joined card and the
  workspace showed the existing "No shift access yet" state
  (`{"assignment": null}`, matching the retained SQL function).

Walkthrough-discovered bug, fixed: development Auth's clock ran 4–5 s ahead of
the API host, so a token used immediately after signup failed the issued-at
check (401, shown as "Your session expired"). The verifier now allows a
30-second clock-skew leeway for `iat`/`nbf`/`exp`; a new test failed before and
passes after, and the full Go suite passes. The check dated from milestone 1 but
was first exercised by `PUT /profile` running immediately after signup.

### Not verified

- Unsupported-role sign-in was not repeated live (the regular-nurse fixture's
  password is not available); automated Go and Expo tests cover it.
- Native Android/iOS, physical devices, live concurrent UI races, and UI
  outage/retry were not exercised; concurrency is covered by local PostgreSQL
  integration tests.
- Synthetic walkthrough accounts, template, ended shift and invites remain in
  development; no cleanup was performed.
