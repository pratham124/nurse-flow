# Go Backend Migration Plan

Status: milestones 1–5 are done (milestones 4 and 5 on 2026-10-24). Milestone 3 (tickets 03–07) was closed at the user's request on 2026-10-19 after local and live development checks passed, with the remaining manual checks and fixture cleanup deferred. See `shift-lifecycle.md` for the exact verification limits. The existing architecture and milestone execution protocol remain approved. Milestone 5 was authorized and completed on 2026-10-24. Milestone 6 was authorized on 2026-10-25 and is implemented and verified, except the deferred notification work (verified on web and Android); the user closed it on 2026-10-25 by authorizing milestone 7. Milestone 7 is in progress: tickets 20 and 21 were done on 2026-10-29 against the hosted development stack (`nurseflow-dev-2610`), and tickets 22–23 need separate approvals. See `hosted-development.md`.

## Purpose and scope

Move NurseFlow's procedural business logic from large PL/pgSQL RPCs into readable Go services. Use an ORM for ordinary database queries. Preserve the functional app's current behavior and database structure. Learning Go is an explicit project objective; delivery speed does not override understanding.

The user has confirmed that no additional product features are planned during this migration. Existing product requirements and screens remain the baseline. This is a migration of the current app, not a restart of the historical Phase 1 prototype.

## Agreed decisions

| Area | Decision |
| --- | --- |
| Destination | Go eventually handles ordinary application reads and writes, one workflow at a time. |
| HTTP | Go standard library `net/http`. |
| Database access | GORM, mapped to the existing Postgres tables. Small explicit SQL operations remain possible when required. |
| Business logic | Small Go service functions; keep HTTP and database details out of domain rules where practical. |
| Database | Retain Supabase Postgres and the current schema initially. |
| Authentication | Expo retains Supabase sign-in and token refresh. Go verifies the access token. |
| Response validation | As each workflow migrates, Expo validates Go API responses with Zod schemas and infers TypeScript response types from them. Preserve existing mapping and failure behavior; Go retains server-side validation and authorization. |
| Authorization | Go checks role and resource access using verified identity and server data. |
| Database role | Dedicated role with only required permissions; explicitly design its interaction with existing RLS. |
| Schema management | Reviewed, versioned migration files; no startup GORM AutoMigrate. |
| Existing client paths | Keep their RLS protection while workflows migrate. |
| Realtime | Retain Supabase Realtime initially; its integration is outside milestone 1. |
| Optimizer | Retain the separate Python optimizer; integration is outside milestone 1. |
| Errors | Consistent API error codes/messages and HTTP statuses, preserving existing user-facing behavior. |
| Isolation | Separate migration branch, worktree, and development Supabase project with test accounts/data. |
| Learning | Assistant writes small increments and explains purpose, implementation, decisions, and verification. No mandatory quizzes or understanding checkpoints. |
| First milestone | Expo reads the signed-in charge nurse's floor templates through a local Go API. Deployment follows later. |

## Request flow

1. Expo signs in through the development Supabase project and obtains an access token.
2. Expo sends that token with a request to the local Go API.
3. Go verifies the token and resolves the corresponding application profile.
4. Go checks the charge-nurse role and restricts the query to that profile's templates.
5. GORM queries the development Postgres database.
6. Go returns the agreed response; Expo validates it with Zod, then the existing app repository adapts it into the existing application model.

The client cannot choose another user's identity by supplying a profile ID. A direct ORM connection does not automatically receive the Supabase user's RLS identity. The database role and its policies must be checked explicitly before the first query is enabled.

## Existing repository facts

Live dashboard observations and remaining baseline-export work are recorded in [Live Supabase Schema Review](live-schema-review.md). The inspection confirms 11 public tables, snapshot-based storage, owner/profile authorization, and trigger dependencies. It is not a restorable schema export.

- `src/services/supabaseClient.ts` selects the Supabase project through `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `.env` is ignored by Git: changing branches alone does not change database targets.
- No ordered `supabase/migrations` directory or Supabase CLI `config.toml` was found during planning. Setup SQL is distributed among phase documentation and SQL files.
- Treat the existing database as something to inspect, not something assumed to match every historical setup document. Establish a schema/function/policy baseline before creating the development environment.
- `src/services/serverWorkspaceRepository.ts` contains `loadFloorTemplates`; preserve its filtering, ordering, mapping, and surrounding workspace behavior when replacing this read.
- The current filter is `owner_profile_id = profile.id`, ordered by `updated_at DESC` without a secondary ordering rule. `profiles.auth_user_id` maps the verified Auth subject to the separate application profile ID.
- The template mapper validates the snapshot's `doctorSides`, `rooms`, and `beds` arrays and uses the row's ID/name in the returned snapshot. Preserve this mapping or retain the existing Expo mapper.
- `loadServerWorkspace` loads templates, active shift, and previous shifts together; failure of the template read currently fails the whole workspace load. Preserve that behavior initially.
- The Python optimizer already accepts its Supabase project through environment variables. When tested later, it must target the same development project as Expo and Go.

## Milestone 1 user story and acceptance criteria

As a signed-in charge nurse, I can see my existing floor-template list through the Go API with the same app behavior as before.

- Valid charge nurses receive only their own templates, in the existing order and shape expected by the app.
- An empty collection is successful and displays the existing empty state.
- Missing, invalid, or expired credentials cannot read templates.
- A signed-in user with an unauthorized role cannot read charge-nurse templates.
- Two test charge nurses cannot read each other's templates.
- Database/API failures produce controlled errors without exposing internal details or database credentials.
- The Go API and Expo both use the isolated development environment.
- The app's other workflows remain on their existing paths during this milestone.
- Web and physical-device API reachability are documented as applicable; a phone's localhost is not the development computer.
- Relevant automated checks and a manual Expo walkthrough pass.

## Ordered implementation tasks

Branch/worktree setup (2026-09-12): `codex/go-migration` created at `C:/Users/psito/Projects/Projects/first-app-go-migration` from `d4ac54f` (`go migration planning`). The original checkout remains on `main`. Git verified both worktrees; no `.env` or `node_modules` was copied. Branch creation and its understanding checkpoint are complete. The separate development configuration was completed in ordered task 3.

- [x] README architecture diagrams: current and planned flows documented; human explained layer responsibilities and the first milestone's retained write path.
- [x] README scope refinement: removed milestone/process details, added the optimizer's Cloud Run hosting boundary, and documented app environment setup. Migration steps remain in this plan.
- [x] Preliminary read-only dashboard inspection: inventory saved in `live-schema-review.md`. Schema export/restore is not complete; teaching checkpoint is recorded separately.

Every item below is a separate implementation task. Do not implement multiple items in one turn by default. Before code, explain the purpose and design; after code, verify behavior and explain the result. Use `grill-with-docs` to settle unresolved design decisions, without requiring post-task understanding quizzes.

- [x] 0. Review and agree this consolidated architecture plan before implementation.
- [x] 1. Establish isolation: preserve current work, create the migration branch/worktree from the agreed current baseline, and document separate environment targets. Do not copy existing live credentials into the development setup.
- [x] 2. Establish the database baseline: inspect existing schema, functions, triggers, grants, and RLS; capture a reproducible starting point and document required Auth/project settings. Review before applying it anywhere.
- [x] 3. Prepare the separate development Supabase project: apply the baseline, configure development authentication, create test accounts and synthetic template data, and verify the existing app can use it. Project provisioning/billing or unavailable access requires a concrete user action if needed.
- [x] 4. Set up Go: inspect/install an appropriate supported toolchain as needed, create one backend module, and explain packages, imports, structs, and explicit error handling using only what the next task needs.
- [x] 5. Implement a local health endpoint: introduce `net/http`, a handler, server configuration, and a small meaningful handler test. No database dependency in the liveness response.
- [x] 6. Connect to development Postgres: configure GORM, explicit existing-table mappings, connection lifecycle/timeouts, and the dedicated database role. Verify its RLS/grant behavior and avoid automatic schema changes.
- [x] 7. Add API authentication and error handling: preserve Expo login/refresh; verify tokens using a maintained library and the actual project's signing configuration. Validate signature, issuer, audience as appropriate, and expiry. Never treat decoding alone as verification.
- [x] 8. Add profile resolution and authorization: derive the application profile from verified identity and enforce the charge-nurse role. Test forbidden-role and missing-profile behavior.
- [x] 9. Implement the template-list endpoint: agree the route/response contract, preserve current owner filtering, ordering, JSON snapshot mapping, and empty-state semantics. Check two-user isolation against development Postgres.
- [x] 10. Integrate the Expo read: introduce a separate public Go API base URL, replace only the template-list data path, send the current access token, preserve application models, and handle errors without silent fallback that hides integration failures.
- [x] 11. Complete the milestone walkthrough: test the signed-in list, empty list, expired/invalid token, forbidden role, cross-user isolation, and unavailable API/database. Run relevant Go and changed-app checks, refactor only demonstrated issues, and document the results.

Toolchain versions, token-verification library, exact grants, endpoint schema, environment commands, and test fixtures are task-level details to inspect and explain before their corresponding implementation. They are not permission to introduce new product scope.

## Learning and completion protocol

Milestone 1 is complete; implementation and verification are recorded in the authentication, profile, template-list, Expo-read, and milestone-verification notes.

The user changed the execution style on 2026-10-17: once a milestone is agreed and implementation authorized, complete that entire milestone instead of stopping after every familiar CRUD ticket. Tickets remain independently verifiable workflows and may span multiple contexts within the milestone.

1. At kickoff, inspect current code and use grill-with-docs to settle unresolved contract, validation, permissions, and transaction decisions. Preserve settled decisions.
2. Explain new Go concepts or complex behavior before the affected major change. Repetitions of the established flow need no new review gate.
3. Work the ready-ticket frontier within the authorized milestone in readable increments. Continue through routine tickets; discuss consequential unresolved choices or scope changes.
4. Verify each workflow and the combined milestone with appropriate automated checks and a manual/demo path. Record environments/devices and distinguish live results from test doubles.
5. Give a focused milestone walkthrough emphasizing new concepts, complex rules, and verification. Answer questions without a quiz, restatement, or historical-checklist gate.
6. Mark only verified tickets/milestones complete. Stop at the agreed boundary unless the next milestone is authorized.

Current handoff: **Milestone 3 — Charge shift lifecycle is done.** Tickets 03–07 are implemented and verified with local checks, real Supabase-token lifecycle requests, development role isolation, and a partial browser/Android walkthrough. Migrations `20261018160805` and `20261020055621` are applied and registered only in `nmitctyxtjmlakcsmnuj`; live catalog/advisor checks passed. The user explicitly closed the milestone with final UI checks and fixture cleanup deferred; see [shift lifecycle](shift-lifecycle.md) for the evidence and limits. Development credentials are environment-specific: the Windows helper uses DPAPI, while the branch-restricted CI environment provides read-only template checks; see [CI database checks](ci-database-checks.md) and [cloud execution limits](cloud-execution-trial.md). Milestone 4 requires authorization before implementation.

Update 2026-10-24: the user authorized **Milestone 4** and settled its decisions; see [profiles, invites, and joined-nurse access](profiles-invites-access.md), `CONTEXT.md`, and ADR 0003. The user also disabled notifications for now: an off-by-default Expo flag hides permission, device registration, and tap handling; the notification-target lookup in ticket 11, device registration (ticket 18), and notification navigation in ticket 19 are deferred by that decision. Database notification triggers and Realtime live refresh are unchanged.

## Remaining approved milestones

The user approved this breakdown on 2026-10-17. Full ticket deliverables, blocking edges, and learning topics are in [Remaining milestones](remaining-milestones.md); individual local tickets are under `.scratch/go-migration-next/issues/`.

| Milestone | Scope | Tickets | Status |
| --- | --- | --- | --- |
| 2 | Save and delete owned floor templates | 01–02 | Complete; verification in template-writes.md |
| 3 | Charge workspace reads and shift lifecycle, including carry-over | 03–07 | Done; verification limits and deferred manual checks in shift-lifecycle.md |
| 4 | Application profiles, nurse invites, joining, and scoped nurse reads | 08–11 | Done; verification and limits in profiles-invites-access.md |
| 5 | Manual moves, issue/swap requests, and request threads | 12–15 | Done; verification and limits in moves-requests-threads.md |
| 6 | Go/Python optimizer coordination, device registration, and live collaboration parity | 16–19 | Closed 2026-10-25; 18 deferred (notifications off); 19 verified on web and Android; see assignment-runs.md |
| 7 | Hosted development, full parity, explicit cutover, and legacy retirement | 20–23 | In progress: 20 implemented, awaiting setup and live checks; 21 partly prepared; 22–23 need separate approval; see hosted-development.md |
| 8 (proposed) | App Store / Play Store release | — | Not started or authorized; follows the cutover (22) |

Work one authorized milestone at a time, completing its routine tickets as a batch. Technical blockers differ from this execution order: unblocked tickets can be verified using retained existing paths and fixtures. Planning approval publishes the tickets; it does not start implementation in this session.

Review unresolved Go/Python, transaction, deployment, and credential boundaries when their milestone starts. Preserve existing behavior, locks/version checks, duplicate-request handling, RLS, Realtime, and notification effects. An ORM transaction alone does not solve every race.

Production enablement follows hosted development verification and explicit approval of the concrete rollout/rollback plan. Test records and Auth users are not copied from development. Retire obsolete RPCs/access paths only after their callers and rollback implications are accounted for, separately from enabling Go.

## Sources reviewed during planning

- [Go standard HTTP routing](https://go.dev/blog/routing-enhancements)
- [GORM transactions](https://gorm.io/docs/transactions.html)
- [GORM locking](https://gorm.io/docs/advanced_query.html)
- [Supabase JWTs](https://supabase.com/docs/guides/auth/jwts)
- [Supabase environment management](https://supabase.com/docs/guides/deployment/managing-environments)


### Database baseline capture progress (2026-09-12)

- [x] Read-only capture saved under `supabase/baseline`: 29 function definitions and 269 structural metadata rows, with reproducible catalog queries and file hashes.
- [x] Capture integrity checked: JSON parsing, object counts, complete function definitions, and targeted credential-pattern scan.
- [x] Capture understanding checkpoint: human explained why non-table objects preserve functionality and correctly predicted the conditional trigger behavior.
- [x] Completed Auth/project settings review, restore preparation, and isolated restore validation; ordered task 2 is complete.


### Restore preparation progress

- [x] Recorded observed provider, redirect, email, and session settings in `auth-and-restore-preparation.md`; unverified settings are listed explicitly.
- [x] Prepared `supabase/baseline/export-public-schema.ps1`, using a terminal password prompt and a schema-only public export with grants.
- [x] User exported `public-schema-20260912-215152.sql` using the terminal password prompt.
- [x] Reviewed the dump and external dependencies, finished configuration review, and validated the isolated restore.


### 2026-09-13 - Dump review

- [x] Static dump review complete; all 29 function bodies match the catalog capture, and table/policy/trigger/index counts agree. See `supabase/baseline/dump-review.md`.
- [x] Recorded required restore adjustments and prepared read-only destination inspection SQL.
- [x] Dump-review understanding checkpoint: human correctly chose to omit duplicate schema creation and explained how permissions affect access to functionality.
- [x] Inspected the development destination, produced and applied its adapted restore, and validated schema, permissions, and synthetic-user behavior.


### 2026-09-13 - Development destination inspection

- [x] User created `nurseflow-go-dev` (`nmitctyxtjmlakcsmnuj`) in East US.
- [x] Read-only inspection verified empty public schema, PostgreSQL 17.6, required managed dependencies, and matching default privileges.
- [x] Prepared `supabase/baseline/restore-development.draft.sql` with documented schema/managed-role adjustments, exact client ACL reconciliation, and app Realtime additions.
- [x] Applied the prepared restore to development and compared schema/ACLs with source; see `supabase/baseline/development-verification`.
- [x] Completed app behavior validation with synthetic accounts.
- [x] Development isolation/restore preparation checkpoint: human explained .env targeting, unintended grants, and the nonempty-schema stop condition.
- [x] Restore execution/validation and Auth/app configuration.


### 2026-09-13 - Development restore applied

- [x] Applied the prepared baseline to `nmitctyxtjmlakcsmnuj` in one transaction.
- [x] Verified 29 functions, 11 tables, 27 indexes, seven triggers, 22 policies, exact object ACLs, and app publication membership against source; two equivalent check-expression grouping differences documented.
- [x] Confirmed all application tables are empty; no production records copied.
- [x] Restore-result understanding checkpoint: human distinguished restored structure/behavior from application data and explained the rerun preflight outcome.
- [x] Compared the development Auth settings needed by the current app with production. At the human's request, email confirmation was disabled in development to match current behavior and avoid the built-in provider's email limit during fixture setup.
- [x] Added a Git-ignored Expo `.env` for the development project only; left the production-connected optimizer URL unset during isolated validation.
- [x] Created and verified three development Auth/profile fixtures: two charge nurses for authorized/ownership-isolation checks and one regular nurse for forbidden-role checks. Credentials are not committed.
- [x] Created `Migration Test Floor` as Charge Alpha and verified its two-room/three-bed/two-side snapshot in Postgres.
- [x] Existing-app behavior checks passed: Alpha sees the template, Beta sees the empty state, and Regular Nurse is rejected from the charge workspace.
- [x] Completed the development-environment understanding checkpoint; ordered task 3 is complete.

### 2026-10-04 - Go setup complete and learning workflow updated

- [x] Backend module and executable scaffold are implemented; formatting, compilation, static checks, and the success path passed during task 4.
- [x] Removed the mandatory understanding checkpoint at the user's request. Ordered task 4 is complete; task 5 (local health endpoint) is next.
- [x] Updated AGENTS.md and this plan to retain explanations, incremental implementation, grill-with-docs design discussions, and relevant verification.

### 2026-10-04 - Local health endpoint complete

- [x] Added a standard-library HTTP server with `GET /health`, returning HTTP 200 and `{"status":"ok"}` without database or Auth dependencies.
- [x] Default binding is `127.0.0.1:8080`; `NURSEFLOW_HTTP_ADDR` overrides it. Explicit request/header/write/idle timeouts are configured.
- [x] Handler tests verify successful JSON status/content, unsupported methods, and unknown routes. `go test ./...` and `go vet ./...` passed.
- [x] Real HTTP walkthrough returned the expected response; a second server on the occupied port returned a clear startup error and a nonzero exit. The walkthrough server was stopped afterward.
- [x] Added backend run/configuration instructions and beginner-oriented code explanations. Ordered task 5 and local ticket 01 are complete; ordered task 6 (development Postgres connection) is next.

### 2026-10-07 - Database connection preparation

- [x] Agreed to preserve database ownership checks for Go reads alongside server authorization, using a limited database role and transaction-local verified identity; recorded the decision in ADR 0001.
- [x] Prepared pinned GORM/Postgres dependencies, existing profile/template mappings, a bounded connection pool, private development-only configuration, transaction-local identity, and a separate connection-check command. No automatic schema changes or HTTP data endpoint were added.
- [x] Read-only development preflight confirmed table RLS and fixture identities. Five PUBLIC-executable workflow functions also have explicit grants to the existing client roles; the proposed migration removes the blanket grants while preserving those named grants.
- [x] Local Postgres migration/ownership/permission checks and Go tests/static checks passed; local test servers were stopped. Details and configuration instructions are in `database-connection.md`.
- [x] Applied the reviewed role/policy migration to development on 2026-10-08. Catalog checks confirmed the limited grants and preserved existing client function access. Login remains disabled; SQL-editor role impersonation was denied.
- [x] User privately provisioned the Go role password and enabled login. User-run `dbcheck` connected as `nurseflow_go`, and the live `TestDatabaseOwnershipIntegration` parent test and all four user subtests passed. The downloaded Supabase root certificate resolved the Windows psql system-certificate issue. Ordered task 6 is complete; task 7 (API authentication and error handling) is next. Tasks 7–9 have not started.

### 2026-10-10 - Development migration history reconciled

- [x] Verified the installed role, exact ownership policy predicates, RLS flags, and grants using the read-only `verify-database-role.sql` query.
- [x] Recorded version `20261008060018` as applied using CLI migration repair with the explicit development project reference. The final migration list reports the same version locally and remotely; no role/policy SQL was rerun.
- [x] Explained task 6 implementation incrementally with the user. The Go field remains `Profile.ID`; the proposed rename was cancelled before edits. Task 7 has not started.

### 2026-10-10 - API authentication complete

- [x] Inspected the current ECC P-256 signing key and matching public ES256 discovery key. The user chose ES256-only verification; no keys/secrets or Expo auth settings were changed.
- [x] Added pinned JWT v5.3.1 verification for signature, issuer, authenticated audience, required expiry, UUID subject, and authenticated database-role claim. Added cached public-key discovery, bounded retrieval, and rejection of unsupported algorithms.
- [x] Added reusable bearer middleware, request-context identity, JSON error helpers, and a protected `/auth/check` diagnostic. `/health` remains public and database-independent. Profile resolution and charge-nurse authorization are not implemented yet.
- [x] Go tests, static checks, race-detector checks, live public-key retrieval, and running-server health/missing/invalid-token requests passed. Synthetic signatures exercised authenticated success. The user-run real Supabase sign-in check also passed on 2026-10-10: Charge Alpha's token returned 200 with its matching Auth UUID; an altered signature returned 401.
- [x] Documented the implementation files, Go concepts, errors, cache/revocation limits, and manual verification in `api-authentication.md`. Ordered task 7 is complete; task 8 is next.
- [x] Task 7 readability follow-up: replaced application-owned JWK coordinate decoding and curve-point validation with pinned `go-jose` v4.1.5. Retained the bounded HTTP fetch, cache, ES256/P-256 selection, and token-claim rules. Added malformed-point, key-metadata, duplicate-ID, and mixed-algorithm coverage; Go tests, vet, race checks, and live development-key retrieval passed.
- [x] Task 7 cache follow-up: moved discovery, decoding, synchronized caching, rate-limited unknown-key refresh, and periodic refresh to `jwkset` v0.11.3; removed the intermediate `go-jose` dependency. Retained our key-selection and HTTP bounds, clear cached keys after refresh failure, and cancel background work with the server context. Documented the change from request-triggered expiry to background refresh. Rotation/revocation, outages/recovery, unknown-key throttling, cancellation, redirect rejection, and live discovery checks passed.

### 2026-10-11 - Profile authorization complete

- [x] User selected distinct 403 `profile_missing` and `forbidden` errors, 503 `database_unavailable` for lookup failures, and a separate `/auth/charge-check` diagnostic; `/auth/check` remains authentication-only.
- [x] Added an explicit profile lookup using the verified Auth subject, existing read-only identity transaction, and unchanged RLS policies. Missing rows are distinguished from database failures; no profile is created by a read.
- [x] Added reusable charge-nurse middleware and authorized profile context. The nurse role is read from Postgres for each request; client identity inputs and the JWT's authenticated database-role claim cannot establish authorization.
- [x] API startup now owns the development database pool and requires Task 6's private settings. Health and authentication-only handlers still make no database queries. No schema, dependencies, Expo behavior, or template endpoint changed.
- [x] Go tests, vet, race checks, router/middleware checks, and actual profile resolution against isolated UTF-8 PostgreSQL passed, including both charge nurses, regular/unknown users, controlled errors, current-role lookup, and identity cleanup. Local test servers were stopped afterward. Live development requests are documented but not claimed as run without private credentials.
- [x] Implementation, Go concepts, manual requests, and verification are recorded in `profile-authorization.md`. Ordered task 8 is complete; task 9 is next.

### 2026-10-17 - Template-list endpoint implementation

- [x] User selected `GET /floor-templates` with a `{"templates":[...]}` envelope and the six existing snake_case database fields. The raw snapshot remains unchanged; Task 10 retains the frontend mapper.
- [x] Added the owner-filtered GORM query, existing transaction-local RLS identity, exact `updated_at DESC` ordering, protected route, empty-array semantics, and controlled query errors. No schema, grants, dependencies, or Expo read path changed.
- [x] Go race tests and static checks passed. HTTP tests cover the route contract, authorization, empty/error cases, and ignored client identity inputs. Actual isolated UTF-8 Postgres checks cover ownership, two nonempty users, ordering/ties, and pooled-identity cleanup.
- [x] Required development Postgres isolation check passed on 2026-10-17 through `backend/scripts/development.ps1 TestTemplates`, using the privately saved dedicated-role credential. All seven subtests passed: Alpha's template, Beta's empty list, cross-owner reads in both directions, regular-role denial, and unknown-user denial. This was a read-only development check; no fixture data was changed.
- [x] Ordered task 9 is complete. The contract, manual requests, and test commands are in `template-list.md`; task 10 has not started. The full real-token/API and Expo walkthrough remains task 11.
- [x] Added `backend/scripts/development.ps1` for Windows DPAPI credential storage after successful connection verification. Synthetic helper checks passed. User reports the development reader password reset succeeded; the password was not shared. The user completed `Save`, and the agent successfully loaded the saved credential through an approved command as that Windows account. The live isolation test passed without exposing credentials.
- [x] User-requested layout follow-up: moved routing, HTTP handlers, response types, and their existing tests from `cmd/api` into `internal/httpapi`. `cmd/api/main.go` now owns startup/configuration and supplies dependencies to `httpapi.NewHandler`. Routes and behavior are preserved; `go test -race ./... -count=1` and `go vet ./...` passed after the move. No new migration task was implemented.

### 2026-10-17 - Expo template read implementation

- [x] User approved `EXPO_PUBLIC_GO_API_URL`, retained frontend mapping, web/native support, exact local web origins, and visible failures without Supabase fallback.
- [x] Replaced only the template-list read with authenticated Go HTTP. Moved its existing mapper and owner check into a small repository shared with unchanged Supabase template writes. Workspace loading retains `Promise.all` and whole-load failure behavior.
- [x] Added bounded requests, controlled errors and response validation, public environment setup, and exact-origin Go CORS preflight for Authorization/Accept. Default web origins are localhost and 127.0.0.1 on port 8081; `NURSEFLOW_WEB_ORIGINS` overrides the list.
- [x] New repository checks (11) and existing workspace-store checks (9), TypeScript, lint, Go race tests, and Go vet passed. Local browser build and Charge Alpha sign-in passed: the Go-backed workspace displayed Migration Test Floor with two rooms and three beds.
- [ ] Charge Beta browser empty-state check: its prior fixture password was rejected once; the user does not remember its current password. No password was reset. Automated empty-list coverage passed. This remaining manual check is documented in `expo-template-read.md`; ordered task 10 remains unchecked pending its task-ticket manual criteria.
- [ ] Physical-device reachability is documented; no physical device was available, so no device result is claimed. The full milestone matrix remains ordered task 11.
- [x] Additional Task 10 browser verification: stopping Go produced the controlled workspace connection error; restarting Go and pressing Retry restored Alpha's template list. Final app checks passed. Beta's manual empty-state result remains unavailable.
- [x] User-requested readability follow-up: added pinned Axios 1.20.0 and a shared Go API client with a constant base URL, common timeout/headers, and preserved cookie/redirect behavior. Removed the URL helper, per-call base-URL override, and manual abort timer. The 16 Axios/template checks and nine workspace tests passed; Expo web displayed Alpha's real template through Axios. Beta/device manual status is unchanged.
- [x] User-requested Task 10 validation follow-up: added pinned Zod 4.6.7 directly to Expo, inferred the row type from a schema, and replaced the manual list/row guard with safeParse. Snapshot mapping and ownership checks are preserved. All 18 Axios/template checks, nine workspace tests, TypeScript, and focused lint passed. This remains part of the Expo-to-Go integration; Beta/device manual criteria are unchanged.

### 2026-10-17 - Milestone 1 verification complete

- [x] User-authorized parallel checks covered live database/authentication behavior and Android reachability. The user chose fresh synthetic accounts instead of resetting Beta.
- [x] Real Charge Empty web and Charge Native Empty Android sessions displayed the existing empty state through Go. Alpha's populated web list passed. Stopped Go, observed controlled errors, restarted Go, and verified Retry recovery on both platforms.
- [x] Live isolation and public key discovery, direct missing/invalid-token requests, Go race tests/vet, 18 template-client checks, nine workspace checks, TypeScript, and lint passed. Automated expiry/role/database-failure tests are distinguished from real-session observations in the report.
- [x] Tasks 10 and 11 are complete; see [Milestone 1 verification](milestone-one-verification.md). Native testing used an existing read-only Android emulator with scoped ADB reverse; physical-phone LAN and iOS were not tested. Temporary servers/emulator were stopped. No later migration workflow or application refactor was implemented.

### 2026-10-17 - Milestone 2 complete

- [x] Ticket 01: template create/update now uses authenticated Go, complete layout validation, server-owned fields, one identity-scoped write transaction, and shared Axios/Zod integration.
- [x] Ticket 02: owned template deletion now uses Go with indistinguishable missing/foreign 404s, preserved UI restrictions and database reference effects, and existing workspace refresh.
- [x] Applied and registered development migration 20261018014344; exact limited grants/RLS and retained client policies were verified.
- [x] Go race/static checks, local database rollback/reference tests, live development ownership/write tests, Expo checks, browser create/update/reload/outage recovery, and a real-token client/store delete/refresh demo passed. The observed save-navigation race was fixed and manually rechecked.
- [x] Decisions, walkthrough, advisor findings, fixture cleanup, and explicit browser-swipe/native/clock-skew coverage limits are recorded in template-writes.md. Milestone 3 is unstarted and requires authorization.

### 2026-10-18 - Cloud execution experiment

- [x] Pushed the reviewed migration branch through `a372326`, prepared and published a private `nurse-flow` cloud environment, and passed the existing non-database checks. No later milestone implementation was started.
- [x] Retested the exact development pooler after publishing its restricted allowlist entry in a fresh cloud task. DNS resolution still failed; no database credential was accessed or uploaded.
- [ ] Live Supabase tests from cloud remain unverified. DNS failure prevented a direct TCP/authentication test; it is not evidence of a port-level denial. See [cloud execution trial](cloud-execution-trial.md) for the observed result and environment limits.

- [x] User-requested cloud retry: the normal turn-scoped network permission was granted, but Python DNS resolution still failed with EAI_AGAIN. No password was used; direct TCP/authentication remain unverified. Details are in the cloud execution trial.

### 2026-10-18 - GitHub Actions live database checks

- [x] Added a migration-branch workflow for backend/workflow changes, with a password-free connectivity probe followed by the existing read-only template isolation test.
- [x] Created the exact-branch-restricted `nurseflow-go-development` GitHub environment. The existing limited development password was transferred privately from DPAPI to its encrypted environment secret; the public CA certificate is an environment variable. No plaintext password was written to Git or logs.
- [x] actionlint passed. GitHub-hosted [run 39104411624](https://github.com/pratham124/nurse-flow/actions/runs/39104411624) passed both jobs for `e8ba856`; the actual live test and all seven isolation cases passed without skips or fixture mutation.
- [x] Cloud coding plus GitHub-hosted live database verification now works independently of the laptop. Direct Codex Cloud database networking is still a separate unresolved limitation. Setup/re-run guidance is in [CI database checks](ci-database-checks.md). No milestone 3 implementation was started.

### 2026-10-18 - Milestone 3 implementation and local verification

- [x] User authorized the charge shift lifecycle milestone and approved rejection of stale setup saves and atomic End Shift derived from authoritative server state.
- [x] Restored and loaded the exact previously used grill-with-docs, grilling, domain-modeling, and Supabase skills from Git history into `/workspace/shared/skills`, outside the application repository.
- [x] Implemented tickets 03–07: Go workspace reads/overlays, owned atomic start, validated setup saves with draft-origin revisions, baseline-checked reopen, and atomic carry-over/invite expiry/closure. Retained business triggers and joined-nurse ended-state semantics.
- [x] Generated migration `20261018160805` with limited column grants and owner RLS. Applied only to isolated local PostgreSQL restored from the full captured baseline; no hosted database changes.
- [x] Local checks cover HTTP auth/errors, domain validation, concurrency, ownership, transaction rollback, trigger effects, reference lock order, and the actual Axios/Zod/store-to-Go-to-Postgres demo. Expo web export passed. See shift-lifecycle.md for final check results and coverage limits.
- [x] Development migration/catalog/advisor/role checks and real-session lifecycle demo completed in the Windows handoff below. The user later closed the milestone with the remaining manual walkthrough checks deferred; see shift-lifecycle.md. Milestone 4 has not started.
- [x] User-requested UUID readability follow-up: replaced manual UUID generation with pinned `github.com/google/uuid` v1.6.0, preserving `NewID() (string, error)` and version 4 IDs. Updated AGENTS.md to favor maintained libraries for standard functionality when they reduce custom code and improve readability. `go test ./...` and `go vet ./...` passed; this follow-up does not complete the pending live milestone checks.
- [x] User-requested backend library cleanup: shared UUID validation now uses `google/uuid` with the existing dashed-format restriction across Auth subjects, route IDs, and shift-start input. Pinned `rs/cors` v1.11.1 handles CORS policy checks; an adapter retains exact origins, deny-all empty configuration, JSON 403 errors, advertised methods/headers, and header case/spacing tolerance. UUID/Auth/route and CORS regression tests, `go test -race ./...`, `go vet ./...`, and diff checks passed. Frontend schema cleanup and shared JSON decoding remain separate follow-ups; live milestone checks are still pending.
- [x] User-requested remaining cleanup: frontend Zod schemas now validate optimizer responses, manual overrides, joined-nurse access/beds/history, and saved-record UUIDs. Reused existing nested shift schemas, retained ownership/status checks and legacy aliases, normalized nullable RPC fields, and kept UUID version/casing rules. Template and shift handlers now share a bounded standard-library Go JSON decoder with endpoint-specific errors, unknown-field rejection, and one non-null value per request. All 70 focused frontend checks, TypeScript, focused lint, Go race tests/vet, Expo web export (22 routes), and diff checks passed. No new frontend dependency or hosted database change; real-session milestone walkthroughs remain pending.
- [x] User-requested typed snapshot construction: `shifts.New` now builds an `initialSnapshot` struct with named load-range fields and marshals it once, replacing the heterogeneous field map and per-field encoding loop. Retained the map for later edits that preserve unknown workflow fields. Existing JSON fields/defaults, including empty arrays, are covered by the updated shift test; `go test ./...`, `go vet ./...`, formatting, and diff checks passed.
- [x] User-requested Go convention cleanup: made `BaselineID` decoding/fallback explicit, changed `Snapshot.set` to error-first flow, documented exported backend declarations, replaced numeric handler statuses with `net/http` constants, and named the carry-over suggestion fields. Added baseline fallback coverage; backend tests, `go vet ./...`, formatting, and diff checks passed. JSON contracts, successful carry-over behavior, and the pending live milestone boundary are preserved.

### 2026-10-19 - Reviewed work merged into the migration branch

- [x] Merged `review-milestone-3` into `codex/go-migration`, retaining the target branch's CI workflow and cloud/database verification history alongside milestone 3 and the reviewed cleanup. Resolved the migration-log conflict by preserving both histories and the current milestone boundary. Go race tests/vet, TypeScript, lint, 70 focused frontend tests, and diff checks passed. Hosted milestone 3 migration and real-session walkthroughs remain pending.

### 2026-10-19 - Milestone 3 development verification and closeout

- [x] Applied and registered lifecycle migration `20261018160805` and policy initplan follow-up `20261020055621` only in nurseflow-go-dev. Existing tables, functions, triggers, and client policies are preserved. Final advisors: 55 existing findings, no new findings. Dedicated-role live workspace isolation passed.
- [x] Verified real Supabase-token requests through Axios/Zod/Zustand, Go, and development Postgres: duplicate starts, stale saves, owner/role/token rejection, baseline-checked reopen, invite expiry, joined ready/removed/ended states, populated carry-over, and empty replacement.
- [x] Browser setup/save/reload/end walkthrough and Android emulator sign-in/list/start reached the migrated workflows. Added screen-focus guards for missing-draft redirects discovered during the browser walkthrough. TypeScript, lint, 56 focused frontend checks, Go race tests, and vet passed after the code change.
- [x] User requested stopping the remaining walkthrough and then explicitly requested marking milestone 3 done and pushing the changes. Marked tickets 03–07 done with the remaining UI regression, full native flow, live UI outage/retry, and synthetic fixture cleanup deferred in shift-lifecycle.md. Temporary test processes were stopped. No production change or milestone 4 implementation.

### 2026-10-24 - Milestone 4 kickoff

- [x] User authorized milestone 4 (tickets 08–11). Grill-with-docs settled profile endpoints, token-derived display names, conflict-safe provisioning, server-generated invite codes, locked generate/regenerate transactions, a combined invite/access read, code-unlocked joining policies (ADR 0003), a per-profile join lock, and a Go-built joined-nurse projection.
- [x] User disabled notifications for now: off-by-default `EXPO_PUBLIC_NOTIFICATIONS_ENABLED`; the notification-target lookup is not migrated; tickets 18 and 19's notification parts are deferred by user decision.
- [x] Implemented tickets 08–11 with the reviewed migration `20261024120000`, two-axis code review fixes, and local Go/PostgreSQL/Expo verification.
- [x] Applied and registered the migration only in nurseflow-go-dev; read-only catalog check matched local; advisors added only expected permissive-policy warnings; live template/shift isolation passed.
- [x] Real-session Expo web walkthrough passed signup, restore, invite generate/regenerate, revoked/used codes, join, scoped joined view, and End Shift. Fixed a walkthrough-discovered JWT clock-skew rejection with a 30-second leeway. Native and live unsupported-role checks were not run. Milestone 4 is done; milestone 5 requires authorization.

### 2026-10-24 - Milestone 5 implementation and local verification

- [x] User authorized milestone 5 (tickets 12–15) and accepted every recommended decision: shift IDs in charge review URLs, `/joined-workspace/*-requests` submissions, a joined-nurse `active_shifts` UPDATE policy with Go-enforced append-only requests (ADR 0004), effective-owner swap checks, the RPC-shaped move contract, payload-blind move replay, the retained swap-completion trigger with Go pre-checks, a `go_private.caller_is_thread_actor` predicate, and 200 `{request}` review responses.
- [x] Added glossary terms, ADR 0004, migration `20261024180000`, and the contract in `moves-requests-threads.md`. Implemented Go routes, pure rules, transactions and Expo Axios/Zod integration for all four tickets.
- [x] Local PostgreSQL integration, Go race/vet/format, Expo type/lint/145 tests, and a two-axis review with fixes passed; see moves-requests-threads.md.
- [x] Applied and registered the migration only in nurseflow-go-dev; the read-only catalog check matched local; advisors added only one expected permissive-policy warning; live template/shift isolation passed.
- [x] Real-session Expo web walkthrough (charge and joined nurse in separate browser contexts) passed issue submit/review/resolve/reopen, both thread participants with retry/reuse checks, swap submit/accept/decline, swap completion through the move dialog, a board move with live joined-nurse refresh, replay/stale moves, and the effective-owner swap rule. Native, live warning acknowledgements, and outsider thread calls were not exercised live. Milestone 5 is done; milestone 6 requires authorization.

### 2026-10-25 - Milestone 6 implementation and verification

- [x] The user authorized milestone 6 and settled its boundary in a grilling session (decisions 1–15 in [assignment runs](assignment-runs.md)). Go coordinates runs; Python is a solver-only `/v1/solve` behind a shared secret; the legacy Python route stays until ticket 23. ADR 0005, glossary terms (assignment run, rerun), and tradeoff entries were added.
- [x] Implemented tickets 16–17: migration `20261025120000`, Go prepare/finalize/fail transactions, a typed output-validator port, the solver client and coordinator with detached deadlines, the Python `/v1/solve` endpoint and configuration split, and the Expo transport through Axios with a 150 s timeout.
- [x] Two-axis code review with fixes. Local Go/PostgreSQL/Python/Expo checks pass.
- [x] Applied and registered the migration only in nurseflow-go-dev. The read-only catalog check matched; live isolation passed.
- [x] Real-session walkthrough: rerun, replay, stale, conflict, unavailable-then-retry in the UI, and joined-nurse live refresh. It found that an immediate retry after an unreachable solver waited for the lease; the user chose to release never-delivered runs (decision 10 amended), and the fix was re-verified live.
- [x] Follow-up: Python 3.13.14 container tests passed. Live solver timeout, invalid output, and Go's 125 s deadline were exercised with a stub solver against real Go, development data, and Expo. Ticket 19's web checks passed: unsaved input, offline cached view, reconnect, sign-out, access removal, and End Shift. They found a pre-existing gap: there is no automatic refetch after a reconnect.
- [x] Fixed the reconnect refetch at the user's request (a refetch once on recovery; 160 Expo tests). Updated the local emulator to 37.2.12 and verified Android live: joined-nurse join, live refresh, the reconnect fix on device, and a charge assignment run through Go and Python.
- [ ] Ticket 18 and notification navigation stay deferred; iOS and physical devices were not tested. Changes are uncommitted for the user's review.

### 2026-10-26 - Milestone 7 kickoff and ticket 20 implementation

- [x] The user authorized milestone 7, which closes milestone 6 with ticket 18 still deferred. A grilling session settled the decisions in [hosted development](hosted-development.md): Cloud Run in `us-east4` in a new development-only GCP project, a hosted solver-only Python service, the shared bearer token kept, scale to zero with small caps, a required `NURSEFLOW_SUPABASE_PROJECT_REF` allowlist, Secret Manager, GitHub Actions deploys through Workload Identity Federation from the migration branch (merging into `main` belongs to the cutover), a re-runnable gcloud bootstrap script, and a proposed store-release milestone 8. ADR 0006 and tradeoff entries were added.
- [x] Implemented ticket 20's code: the project-ref selection (tests for both refs and rejection cases), the Go Dockerfile with the public Supabase CA, the API/solver deploy workflows (test, SHA-tagged image, no-traffic candidate, smoke check, traffic switch, rollback command in the summary), and the bootstrap script.
- [x] Local checks: Go format, vet, build, race tests, and a static Linux build pass. 118 Python tests pass. The workflows parse. The bootstrap helpers were tested against a fake gcloud, which found and fixed a byte-order mark added to secrets. Not run: `docker build` (daemon stopped), actionlint (fetch blocked), and any real gcloud/gh call.
- [x] Ticket 21 preparation: the remaining-legacy-caller inventory, the production change list, and the rollback plan are drafted in hosted-development.md and not applied.
- [x] User: GCP setup, push, and ticket 20 live checks, then ticket 21's hosted matrix (done 2026-10-29; see below).

### 2026-10-29 - Tickets 20 and 21 verified on hosted development

- [x] The user ran the bootstrap script for `nurseflow-dev-2610`. Commit `3ebae95` deployed both services through the workflows. Ticket 20's live checks passed: health and auth, Expo web and Android against `run.app`, a blocked bad revision, rollback and roll-forward, and an assignment run through the hosted solver.
- [x] Ticket 21's hosted matrix passed on web (Playwright) and Android (Pixel 7 Pro API 33). It covered the full charge workflow, the joined nurse, requests and threads, live updates, reconnect, access removal, End Shift, isolation, sign-out, and run concurrency. Results and findings are in [hosted development](hosted-development.md#ticket-21-hosted-matrix-2026-10-29).
- [ ] Ticket 18 and notification navigation stay deferred. iOS and physical devices were not tested. Tickets 22–23 need separate approvals.

### 2026-10-29 - Ticket 22 approved and prepared

- [x] The user approved starting ticket 22. A grilling session settled 15 decisions, recorded in [hosted development](hosted-development.md#ticket-22-production-cutover) and ADR 0007. Production goes in its own GCP project `nurseflow-512906`, deploys from `main` after development and only with the user's approval, allows no browser origins, and starts at zero instances.
- [x] Prep: reusable Cloud Run deploy workflows with test → development → production jobs; `deploy/production/api.env.yaml`; the bootstrap script moved to `deploy/` with `-Environment production`; `npm run start:dev`. Development was re-bootstrapped so `main` may deploy it.
- [x] Cutover steps 1–9 done (2026-10-29 to 2026-10-30):
  - production restored, compared read-only, and migrated (the user ran the apply script);
  - password and bootstrap verified, with the production pooler corrected to `aws-1`;
  - PR #2 merged and both production deploys approved;
  - the main folder points at production;
  - the production smoke checks passed on two Android emulators.
  
  Details are in [hosted development](hosted-development.md#cutover-progress).
- [ ] Ticket 23 (retire legacy paths) needs its own approval, after about a week of stable production use. Milestone 8 (store release) is proposed.
