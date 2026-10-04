# Go Backend Migration Plan

Status: consolidated plan approved by the user on 2026-09-12. Read-only live schema inspection recorded in `live-schema-review.md`; no application migration has been implemented. Mandatory understanding checkpoints were removed at the user's request on 2026-10-04; tasks complete after implementation and relevant verification.

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
6. Go returns the agreed response; the existing app repository adapts it into the existing application model.

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
- [ ] 5. Implement a local health endpoint: introduce `net/http`, a handler, server configuration, and a small meaningful handler test. No database dependency in the liveness response.
- [ ] 6. Connect to development Postgres: configure GORM, explicit existing-table mappings, connection lifecycle/timeouts, and the dedicated database role. Verify its RLS/grant behavior and avoid automatic schema changes.
- [ ] 7. Add API authentication and error handling: preserve Expo login/refresh; verify tokens using a maintained library and the actual project's signing configuration. Validate signature, issuer, audience as appropriate, and expiry. Never treat decoding alone as verification.
- [ ] 8. Add profile resolution and authorization: derive the application profile from verified identity and enforce the charge-nurse role. Test forbidden-role and missing-profile behavior.
- [ ] 9. Implement the template-list endpoint: agree the route/response contract, preserve current owner filtering, ordering, JSON snapshot mapping, and empty-state semantics. Check two-user isolation against development Postgres.
- [ ] 10. Integrate the Expo read: introduce a separate public Go API base URL, replace only the template-list data path, send the current access token, preserve application models, and handle errors without silent fallback that hides integration failures.
- [ ] 11. Complete the milestone walkthrough: test the signed-in list, empty list, expired/invalid token, forbidden role, cross-user isolation, and unavailable API/database. Run relevant Go and changed-app checks, refactor only demonstrated issues, and document the results.

Toolchain versions, token-verification library, exact grants, endpoint schema, environment commands, and test fixtures are task-level details to inspect and explain before their corresponding implementation. They are not permission to introduce new product scope.

## Learning and completion protocol

For each task:

1. Explain the problem, intended change, and meaningful alternatives before implementation.
2. Implement only that task in readable increments.
3. Run checks appropriate to the change and provide a manual verification path.
4. Explain what changed, key decisions, relevant edge cases, and effects on later work.
5. Answer questions at the requested explanation level without requiring a quiz or restatement.
6. Mark the ordered task complete when its implementation and relevant checks pass. The historical understanding checklist is not a completion gate.

## Later migration milestones: outline only

After milestone 1, conduct another bounded design round before implementing the next workflow:

1. A simple template write, including validation and reviewed transaction behavior.
2. Remaining template and shift reads/writes.
3. Assignment overrides and request workflows, preserving locking, stale-state rejection, idempotency, and notification side effects.
4. Python optimizer coordination and Realtime/push integration. Preserve current externally visible behavior; deployment boundaries and any credential changes require explicit design.
5. Deployment and full behavior comparison in the isolated environment.
6. Final integration and cutover: merge validated code, apply only necessary reviewed database changes to the existing project, and configure deployment explicitly. Test records and Auth users are not merged from development. Remove obsolete RPCs/access paths only after their callers and rollback implications are accounted for.

An ORM transaction alone does not solve every race. Preserve the current locking or version-check mechanism and duplicate-request handling when each write workflow moves. Keep irreversible cleanup separate from enabling its replacement.

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
