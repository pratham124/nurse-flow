# Milestone 3: Charge shift lifecycle

Status on 2026-10-18: tickets 03–07 are implemented and verified locally. Applying
the migration to `nurseflow-go-dev`, verifying its live grants, and completing a
real-session Expo walkthrough are pending. The milestone is **not marked done**.
No production or hosted development database was changed in this session.

The user authorized this milestone and approved stale setup rejection and atomic,
authoritative End Shift. See [ADR 0002](../adr/0002-go-shift-lifecycle-transactions.md).
The absent local ticket files were reconstructed from the approved milestone
index under `.scratch/go-migration-next/issues/03` through `07`; their status is
in review, pending live verification. Milestones 4–7 remain untouched.

## Request contract

All routes use the existing verified bearer identity and current charge-nurse
profile checks. Client identity parameters never select an owner.

| Request | Body | Success |
| --- | --- | --- |
| `GET /active-shifts/current` | None | 200 `{active_shift: row \| null}` |
| `GET /previous-shift-snapshots` | None | 200 `{snapshots: [...]}` |
| `POST /active-shifts` | `{floor_template_id}` | 201 `{active_shift: row}` |
| `PUT /active-shifts/{id}/setup` | `{expected_updated_at, setup}` | 200 `{active_shift: row}` |
| `POST /active-shifts/{id}/reopen` | `{expected_baseline_assignment_result_id}` | 200 saved/stale result |
| `POST /active-shifts/{id}/end` | `{}` | 200 `{active_shift: endedRow}` |

Rows retain snake_case database fields. Active rows include an
`active_assignment_overrides_by_bed_id` projection; Zod maps these rows into the
existing application models. Missing/foreign resources share 404, stale or
assigned setup and duplicate starts use distinct 409 codes, invalid requests use
400, oversized bodies 413, wrong media types 415, and database errors 503. Reopen
keeps the existing 200 `saved`/`stale` contract. Private database errors are never
returned to Expo. JSON writes are bounded to 1 MiB and reject unknown fields and
multiple JSON values. Existing exact-origin CORS already permits POST and PUT.

## Behavior and Go walkthrough

- **Related reads:** owner filtering and existing ordering remain. Read-only
  identity transactions now use repeatable-read isolation so a shift baseline
  and its separately queried overrides share one database snapshot. The legacy
  missing-override-table case still produces an empty projection; other query
  errors fail the workspace. Expo retains `Promise.all` and whole-load failure.
- **Start:** Go reads an owned saved template, creates the existing defaults,
  and inserts a snapshot with its final server UUID in one write. The browser
  cannot choose its owner, layout, timestamps, or initial assignment. A
  transaction advisory lock serializes Go starts by owner across templates and
  API instances. A second start returns a visible conflict instead of creating
  another row. There is no new uniqueness constraint; retained older direct
  clients do not participate in this Go advisory lock.
- **Setup:** `shifts.Setup` describes only admitting side, load limits, nurses,
  bed states, and carry-over review. Validation checks references, unique IDs,
  enum values, whole-number loads/ages, and existing load bounds. Intermediate
  review saves may still contain no admitting side, no nurses, zero nurse load,
  or patients awaiting acuity; later screens keep their existing validation.
  The server locks the shift, compares the draft revision, rejects assigned
  shifts, and merges these fields while retaining stored layout, request
  history, flags, and assignment fields. It does not retry a stale draft.
- **Draft origin:** `Shift.serverRevision` is frontend metadata attached while
  mapping the row. Existing draft copies retain it. It is sent separately as
  `expected_updated_at`, never stored in snapshot JSON. Reopen returns the
  authoritative reloaded workspace snapshot, including its version.
- **Reopen:** the expected baseline is checked under a row lock. A mismatch has
  no side effects; matching absent baselines are a no-op. Otherwise the same
  transaction supersedes active overrides, expires active invites, removes
  pending/linked access, clears the assignment and flags, and sets setup status.
  Nurses, patients, settings, and requests remain. The store reloads on saved
  and stale results, as before.
- **End:** Go locks the parent template before the shift, matching template
  deletion's reference-lock order. It serializes carry-over replacement for
  the owner/template, derives the existing suggestions from the stored row,
  deletes previous suggestions and inserts only useful replacements, expires
  invites, and sets `ended_at`. Empty shifts clear old suggestions. It retains
  the snapshot, row status, linked access, and overrides. Repeated end returns
  missing without replacing carry-over again. Nurses omit loads/assignment;
  only patients with nonblank initials become suggestions.
- **Transactions:** returning an error from a GORM transaction callback rolls
  everything back. Row locks serialize decisions on one shift; expected
  revisions additionally detect old screen contents. Server revisions advance
  at least one PostgreSQL microsecond even after clock skew, keeping retained
  optimizer revision checks meaningful. No HTTP/solver calls occur under locks.
- **Effects:** the captured database broadcast and notification triggers remain
  installed. Go does not send duplicate events or replace the retained solver,
  invite/join, request, device, or notification workflows.

Implementation: [shift rules](../../backend/internal/shifts/snapshot.go),
[database operations](../../backend/internal/database/shifts.go),
[HTTP routes](../../backend/internal/httpapi/shifts.go),
[Expo schemas](../../src/services/shiftSchemas.ts), and
[Expo repository](../../src/services/shiftRepository.ts).

## Database access

[Migration 20261018160805](../../supabase/migrations/20261018160805_go_shift_lifecycle.sql)
was generated with the Supabase CLI and validated against local PostgreSQL
17.11 restored from the captured development baseline. It requires the existing
limited role and all five lifecycle tables with RLS enabled. It adds 12
owner-scoped role policies and only the necessary column/table grants. Existing
client policies, functions, tables, constraints, and triggers remain unchanged.

Go can select its own shifts, suggestions, and overrides; insert shifts and
suggestions; update shift state; delete previous suggestions; and update the
status/timestamp columns needed by reopen/end. Invite hashes, nurse contact
details, invite issuance, ownership changes, shift deletion, and direct
notification writes remain inaccessible. No public workflow RPC is executable by
the Go role. See [read-only catalog verification](verify-shift-lifecycle-role.sql).

Before using the updated app against hosted development, apply this migration
as the development administrator to project **`nmitctyxtjmlakcsmnuj`** and register
its version through the existing migration workflow. The Go login cannot grant
itself permissions. Do not apply it to production or copy fixture credentials.

## Verification performed

- [x] Go race suite and HTTP/domain checks, including route authentication,
  forbidden/missing profiles, invalid bodies/IDs, safe errors, and response
  contracts.
- [x] Actual isolated PostgreSQL with the **full captured public baseline**,
  original business functions/RLS/triggers, both prior Go migrations, and this
  milestone's final grants/policies. Only managed Auth/Realtime dependencies
  were local stand-ins; broadcast calls were recorded, not delivered to devices.
- [x] Database lifecycle checks: concurrent starts, stale concurrent saves,
  authorization/identity cleanup, related overrides, assigned-save rejection,
  expected-baseline/no-op reopen, retained related effects and broadcasts,
  injected-close rollback, authoritative/empty carry-over replacement, repeat
  end, immutable-column/secret-column restrictions, monotonic revisions, and
  concurrent template deletion without a lock-order deadlock.
- [x] Safe workspace isolation checks and existing database ownership/template
  writes against the restored database.
- [x] Real local HTTP demo using **actual Axios, Zod, Zustand, JWT verification,
  profile lookup, and the limited Postgres role**: start, save, stale rejection,
  reload, reopen saved/stale contract, second-owner/forbidden-role checks, end,
  carry-over, empty replacement, participation refresh, and stopped-API errors.
  JWTs were locally generated synthetic credentials, not Supabase sign-ins.
- [x] Eleven new repository/store checks passed. Existing template/client/store
  checks and TypeScript/focused lint passed during implementation.
- [x] Expo web static export succeeded for all 22 routes. The existing web push
  listener warning remains; export is not a real-session browser walkthrough.
- [ ] Development migration application/history, live catalog/advisor review,
  dedicated-role checks, and real Supabase-token requests.
- [ ] Expo browser and available native-device walkthrough against development,
  including outage/retry and joined-nurse ended-versus-removed state.

The cloud runtime has no configured database credentials. The previously saved
Windows DPAPI credential cannot be decrypted in this Linux workspace. Supabase
was found as an available plugin but was not connected when these checks ran.
No live result or physical-device/iOS result is claimed.

## Repeat the checks

From the repository root:

```sh
npm run test:go-shifts
npm run test:go-templates
npm run test:server-workspace-store
npx tsc --noEmit
```

From `backend`: `go test -race ./... -count=1` and `go vet ./...`.
Opt-in database tests require `NURSEFLOW_DATABASE_TESTS=1` and the documented
fixture Auth UUID variables. `TestShiftWorkspaceIsolationIntegration` is
read-only and may use development; the staged/failure/HTTP demo tests require an
explicit `NURSEFLOW_TEST_DATABASE_URL` whose hostname is `127.0.0.1`.

For a fresh disposable local cluster, apply in order:

1. `backend/internal/database/testdata/shift-lifecycle-managed.sql`
2. `supabase/baseline/restore-development.draft.sql`
3. All three `supabase/migrations/*.sql`, in version order
4. `backend/internal/database/testdata/shift-lifecycle-fixtures.sql`

Use UTF-8, a `postgres` administrator, and `wal_level=logical`. Managed stubs and
fixtures are **local-only**. Local fixture Auth UUIDs end in `...0001`, `...0002`,
and `...0003` as shown in that fixture file. Connect tests as `nurseflow_go`, not
as administrator. Then run:

```sh
go test -race ./internal/database -run 'Test(ShiftLifecycleIntegration|ShiftWorkspaceIsolationIntegration|ShiftLifecycleHTTPDemo)$' -count=1 -v
```

With development credentials available on the original Windows account, run
`backend/scripts/development.ps1 TestShifts` after applying the migration. It uses
the existing private helper and performs read-only ownership checks. That new
dispatch action was reviewed here but could not be executed on Linux.

For the live Expo walkthrough: start/resume an owned template, save each setup
screen and reload, try an older draft after another save, reopen an assigned
baseline and verify access removal/invite expiry, then end a populated shift and
confirm carry-over on the next start. End an empty shift to clear suggestions.
Repeat isolation with the other charge user and the regular-user fixture.

References: [GORM transactions](https://gorm.io/docs/transactions.html),
[GORM row locking](https://gorm.io/docs/advanced_query.html#Locking),
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
The current official RLS source was checked for SELECT prerequisites and both
UPDATE policy predicates; the captured baseline remains the behavior authority.
