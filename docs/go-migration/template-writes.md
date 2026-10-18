# Milestone 2: template writes

Status: complete on 2026-10-17. Tickets 01–02 were authorized and verified as one milestone batch.

## Agreed contract

The user selected POST `/floor-templates` for creation, PUT
`/floor-templates/{id}` for replacement, and DELETE at the same ID route.
Save bodies contain `{"template_snapshot":{...}}`; successful saves return
`{"template":{...}}` with the same six row fields as the list API. Creation
returns 201, replacement 200, deletion 204. Missing and foreign updates/deletes
return the same controlled 404 `template_not_found` response, avoiding disclosure.

The server derives ownership from the authorized profile and supplies the saved
ID, trimmed floor name, and timestamps. A create inserts and synchronizes the
snapshot ID in one write transaction; it returns success only after commit.
Updates retain existing last-write-wins behavior. Transaction atomicity does not
make create retries idempotent; no automatic retry or new version protocol is added.

The user selected complete, consistent layout validation: exactly two named
sides, nonblank floor/room/bed names, unique nonempty IDs within each collection,
valid room/side and bed/room references, positive integral counts/numbers, and
each room's exact contiguous bed numbering. Inner IDs remain local strings.
Only reusable fields are accepted. JSON requests are limited to 1 MiB and must
contain one object; unknown properties are rejected. Duplicate-name UI rules
remain in the existing wizard; no new database uniqueness rule is introduced.

## Preserved boundaries

The existing UI/store restrictions remain, including blocking deletion during an
active charge shift. They are not promoted into new database invariants in this
milestone. The database retains `active_shifts.floor_template_id ON DELETE SET
NULL` and `previous_shift_snapshots.floor_template_id ON DELETE CASCADE`, along
with existing trigger effects. Go does not reproduce these effects manually.
Existing Supabase client policies remain for retained workflows.

The limited Go role gains only template INSERT columns (owner/name/snapshot),
UPDATE columns (name/snapshot/updated_at), and DELETE. Separate ownership policies
use the established transaction-local verified identity. Read transactions stay
read-only. No profile/shift write privileges or application function execution
are added. Schema changes remain explicit migration files; no AutoMigrate.

Expo uses the shared Axios client and Zod response schemas and preserves the
whole-workspace refresh after save/delete. Errors remain visible without fallback.

## Verification

All checks below passed. Production was not targeted.

| Surface | Evidence |
| --- | --- |
| Go unit/HTTP | JSON/body limits and media type, inconsistent layouts, authenticated create/update/delete, missing/expired credentials, forbidden role, missing/foreign resource response, controlled database failures, and CORS for writes. `go test -race ./... -count=1` and `go vet ./...` passed. |
| Local PostgreSQL 17, UTF-8 | Applied both migrations and synthetic fixtures on loopback port 55442. Tests proved create/update/reload, two-way owner isolation, regular/unknown insert denial, immutable owner/ID/created_at, read-only transaction protection, cancelled/invalid requests, identity cleanup, repeated deletion, rollback after injected snapshot-sync failure, and actual SET NULL/CASCADE reference actions. Existing read/ordering tests passed too. |
| Live development database | `backend/scripts/development.ps1 TestTemplateWrites` passed with the privately saved limited-role credential. Temporary Alpha/Beta templates were cleaned up. `TestTemplates` passed afterward with the original one-row/empty fixtures unchanged. |
| Live migration | Applied `20261018014344_go_template_writes.sql` only to `nmitctyxtjmlakcsmnuj`, then registered it through migration repair without rerunning SQL. Remote history contains versions `20261008060018` and `20261018014344`, matching the local files. |
| Live catalog | `supabase/baseline/verify-template-writes.sql` confirmed exact column grants, four Go ownership policies, four retained client template policies, enabled RLS, no profile write/unrelated-table access or public function execution, and unchanged foreign keys. |
| Expo checks | 24 template/Axios tests, nine workspace-store tests, TypeScript, and lint passed. No dependency changes. |
| Expo web walkthrough | Real development signup/session; created a one-room/two-bed floor through the wizard, stopped Go and observed visible save failure with draft retained, restarted Go and saved, reopened/renamed the floor and added a third bed, saved the same ID, and reloaded its persisted layout. Live catalog confirmed matching row/snapshot ID and name. |
| Real-token client/store demo | Actual Supabase access token, shared Axios/Zod template repository, actual store actions and actual Go/Postgres writes: create/update/reload, invalid-layout 400, foreign update/delete 404, successful delete with empty-list refresh, and visible repeated-delete error. Only unrelated shift reads used an empty fixture in this Node demo; template requests and refreshes were live. The local script is `.scratch/milestone2-client-demo.mjs`; it generates transient credentials without saving/printing them. |

During the web walkthrough, successful save exposed a pre-existing navigation
race: clearing the draft could redirect the still-mounted review screen to Floor
Details. A small `useRef` guard now distinguishes successful cleanup from entering
review without a draft. After rebuilding, re-saving returned to Floors correctly.
The guard does not change save validation, failure recovery, or database behavior.

The security advisor reported 11 anonymous and 18 authenticated executable
SECURITY DEFINER function warnings, plus disabled leaked-password protection.
Those findings concern retained RPC grants and the existing development Auth
setting. This migration adds no functions and changes none of those grants/settings;
the Go role still cannot execute public application functions. The advisor result
is not described as clean.

## Coverage and environment limits

- Browser verification used Expo at `http://localhost:8081` and Go at
  `http://127.0.0.1:8080`, backed by the isolated development project. No native,
  physical-phone, or iOS result is claimed for this milestone.
- Browser automation's drag opened the template instead of exposing its existing
  swipe-delete action. That browser gesture/confirmation interaction was **not
  verified**. Deletion and refreshed state were verified through the actual
  client/store demo, HTTP tests, and real database checks above. No swipe-control
  redesign was introduced to accommodate automation.
- The synthetic rollback trigger and reference fixtures exist only locally.
  Production/development triggers were not injected or disabled. Live reference
  definitions were checked; actual reference actions were exercised locally.
- The existing verifier checks issued-at time without clock leeway. One freshly
  minted demo token was briefly rejected while its issuing clock was ahead of the
  local clock. The successful demo measured a 297 ms offset and waited until its
  issued-at time; Go still verified the signature and claims. Authentication was
  not changed in this milestone. This remains an existing clock-skew limitation.
- Expo reported existing package-version compatibility notices; dependency upgrades
  were outside this migration and were not performed. Web built and ran.

Four synthetic development profiles were created during the walkthrough/demo:
one `Milestone Two Charge` and three `Milestone Two API Demo` profiles across demo
attempts. The API-demo profiles have no templates; the successful demo signed out
its session. An early demo that stopped before its cleanup block discarded its
in-memory credentials without explicitly signing out that development session.
The browser account retains `Milestone Two Updated` (ID
`3324ae4f-7e66-42fc-b5d5-91d9f99e09d2`) for review. Generated passwords/tokens were
transient. Existing accounts/passwords and Alpha's original template were unchanged.
Saved local evidence: `.scratch/milestone2-updated.png`.
The browser session was signed out and its verification tab closed. Temporary
Go, Expo/Metro, and local Postgres test servers were stopped. The pre-existing
untracked `backend/supabase/` CLI cache was preserved.

## Code walkthrough

`internal/templates` holds typed reusable layouts and consistency checks without
HTTP/database dependencies. JSON tags connect Go field names to the existing
camelCase snapshot fields. Maps check ID uniqueness and layout references without
repeatedly scanning every collection.

`internal/httpapi/template_writes.go` bounds and decodes JSON, rejects unknown
fields, obtains the middleware-authorized profile, and maps service results to
the agreed status/envelope. `internal/database/template_writes.go` uses GORM with
explicit mutable columns. An update/delete affecting zero rows returns
`ErrTemplateNotFound`; it never silently creates or exposes another owner's row.

`WithWriteIdentity` shares the existing bounded identity setup while permitting
writes. An error returned by its callback causes GORM to roll back; a successful
callback still must commit successfully before a saved row is returned to HTTP.
`WithIdentity` remains read-only for existing queries. Database RLS independently
checks the verified Auth identity/profile role on every write.

Expo's existing server-workspace functions now delegate template writes to the
small template repository. The repository uses the current session token on each
request and validates returned rows with Zod. Store actions still reload and
publish the workspace only after success; failures remain visible.

## Repeatable checks

From `backend`: `go test -race ./... -count=1`, `go vet ./...`,
`./scripts/development.ps1 TestTemplateWrites`, and
`./scripts/development.ps1 TestTemplates`. Live write tests create/remove their
own temporary records. The failure trigger/reference test skips outside an
explicit local fixture database. From the repository root:
`npm run test:go-templates`, `npm run test:server-workspace-store`,
`npx tsc --noEmit`, and `npm run lint`.

## References

- [GORM transactions](https://gorm.io/docs/transactions.html)
- [GORM updates and affected rows](https://gorm.io/docs/update.html)
- [Supabase RLS and operation policies](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Snapshot schema follow-up

The user requested complete TypeScript snapshot typing through Zod. The nested snapshot schema now defines doctor-side, room, and bed field types, infers the outgoing save snapshot type, and validates list/save response layouts before mapping. The mapper no longer casts an unknown snapshot or checks only its arrays. Row ID/name remain authoritative, top-level extras are discarded, and nested extras are preserved. Structural field validation intentionally now rejects malformed collection entries; Go retains layout consistency rules. All 26 template/client checks, TypeScript, and focused lint passed. Browser/native checks were not repeated for this schema follow-up.

## Template module readability refactor

At the user's request, the Expo template module now separates its pure data
contract from HTTP work. The schema module owns reusable field definitions,
strict save projection, and response transforms into the existing application
model. The repository exposes the same three load/save/delete operations,
uses typed action names, and chooses POST/PUT in one Axios request configuration.
The shared Axios client, route contract, server validation, and database behavior
are unchanged.

Zod validates/copies response layouts before transforming them, so the old
separate mapping pass and test-only mapper export were removed. Tests assert
known application results through public repository operations. Save schemas
strip extra top-level/nested fields and reject invalid field types before HTTP;
Go remains authoritative for layout consistency.

All 27 template/client checks, nine workspace checks, TypeScript, focused lint,
and whitespace checks passed. The UI walkthrough was not repeated for this
internal refactor. Changes remain part of milestone 2; milestone 3 was not started.

## UUID validation follow-up

- [x] Validate IDs at their entry points: the JWT verifier checks the Auth subject,
  and reusable `requireUUID` middleware checks PUT/DELETE path IDs after
  authentication and charge-nurse authorization. Malformed paths return
  400 `invalid_id` with "The ID must be a UUID." Invalid request layouts still
  return `invalid_template`.
- Profile IDs come from PostgreSQL UUID columns. Store operations now require
  verified Auth/profile IDs and caller-validated template IDs; they do not repeat
  UUID regex checks. Direct test entry points validate environment fixture IDs.
  Any future non-HTTP entry point must validate its external IDs before calling
  the store.
- Ownership filters, RLS, layout validation, transaction identity, rollback,
  cancellation, and query timeouts remain in place.

Verification: `go test -race ./... -count=1` and `go vet ./...` passed. The final
HTTP cases also passed after strengthening the malformed-ID request bodies.
Live development `TestDatabaseOwnershipIntegration`, `TestTemplateListIsolationIntegration`,
and `TestTemplateWritesIntegration` passed using the saved limited-role credential.
The write checks removed their temporary templates; original Alpha/Beta fixtures
were preserved. Browser/native UI checks were not repeated for this backend refactor.

Generic middleware follow-up: moved the helper to `internal/httpapi/uuid.go` for reuse by any route with a UUID `{id}` parameter. HTTP package race tests and vet passed after the rename and error-contract update.

## Named insert model follow-up

- [x] Extracted the anonymous creation struct into the private `floorTemplateInsert` type in `internal/database/models.go`. Its column names now follow GORM's snake_case convention; UUID/JSONB types and the generated-ID default remain explicit. `SaveFloorTemplate` constructs this named value while retaining the explicit table and transaction flow.

Database package race tests, vet, whitespace checks, and live development `TestTemplateWritesIntegration` passed. The live check verified creation with a generated UUID, update/reload, isolation, and deletion, then cleaned up its temporary rows. No database schema change was needed.
