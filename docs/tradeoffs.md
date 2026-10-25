# NurseFlow Tradeoff Log

Real choices made on this project, written so I can explain them in an interview. Newest entries first. Big architecture decisions also have an ADR in `docs/adr/`.

Entries before 2026-10-24 were backfilled from the ADRs, phase docs, and the Go migration plan.

---

## 2026-10-24: Who enforces "a nurse can only add a request"

- **Problem:** A joined nurse submits an issue or swap request by appending it to the shift's JSON snapshot. Moving this write to Go meant deciding where the "only append one request" rule lives.
- **Chose:** Give Go's database role a row-level UPDATE policy limited to shifts the nurse is linked to and that haven't ended. Go code (a pure, unit-tested function) guarantees only one request is appended.
- **Over:** (1) A small Postgres function that does the append, so the database enforces it. (2) Keep calling the old `SECURITY DEFINER` functions.
- **Why:** Row-level security can restrict *which rows* change, not *which JSON keys* change. A Postgres function would keep part of the workflow in PL/pgSQL, which this migration exists to retire. Calling the old functions wouldn't migrate anything.
- **Cost:** The database only enforces "your shift"; "append only" depends on Go being correct. A Go bug could overwrite other parts of the snapshot.
- **Would change if:** Requests moved into their own table (then the database could enforce insert-only), or more services started writing to the snapshot.
- **ADR:** [0004](adr/0004-joined-nurse-snapshot-writes.md)

## 2026-10-24: Invite codes as a database-checked permission

- **Problem:** Joining a shift means reading another charge nurse's invite and shift. The old code did this with `SECURITY DEFINER` functions that bypass row-level security entirely.
- **Chose:** Go hashes the code the user typed and passes the hash to Postgres as a transaction-local setting. Narrow policies then allow only the invite with that exact hash, its shift, and linking the caller's own profile.
- **Over:** (1) Keep calling the old bypass functions. (2) Give Go unrestricted access to invites and shifts.
- **Why:** Knowing the code *is* the permission, so the database should enforce that same boundary. Unrestricted access would throw away the database protection kept in ADR 0001.
- **Cost:** More policy complexity. Postgres rejects policies that reference each other in a loop, so I needed two small yes/no helper functions in a private schema. The unlocked shift row still contains the whole snapshot, so Go must be careful to return only the nurse name, floor name, and expiry.
- **Would change if:** Shift data were split into smaller tables, so an invite could unlock only the part a joining nurse needs.
- **ADR:** [0003](adr/0003-invite-code-capability-policies.md)

## 2026-10-18: Rejecting stale saves and ending a shift all at once

- **Problem:** Shift setup is saved as one JSON snapshot. If a screen with old data saves after another change landed, it could silently overwrite newer work. End Shift has several effects (carry-over suggestions, expiring invites, closing the shift) that could half-finish.
- **Chose:** Setup saves send the `updated_at` they started from and are rejected if the shift has changed since (optimistic concurrency). Go merges only setup-owned fields into the locked snapshot. End Shift runs all its effects in one database transaction.
- **Over:** Last write wins, or running End Shift as separate steps.
- **Why:** Silent overwrites are dangerous for patient assignments. A transaction means a failure rolls everything back instead of leaving a shift half-ended.
- **Cost:** The user can see "this shift changed, reload" errors. Lock order has to be planned carefully (template before shift) to avoid deadlocks.
- **Would change if:** Many people edited setup at the same time, where field-level merging or real-time co-editing would be worth the complexity.
- **ADR:** [0002](adr/0002-go-shift-lifecycle-transactions.md)

## 2026-10-10: Verify only ES256 tokens, with a library-managed key cache

- **Problem:** Go has to verify Supabase access tokens. The project had moved to an ES256 key, but older HS256 shared-secret tokens could still exist.
- **Chose:** Accept only ES256 tokens, checked against Supabase's public key list (JWKS). A maintained library (`jwkset`) fetches and caches the keys; `golang-jwt` verifies signature, issuer, audience, and expiry.
- **Over:** Also accepting HS256 with the shared secret, calling Supabase Auth on every request, or writing my own key cache.
- **Why:** The backend never holds a shared secret, there's no network call per request, and a library handles caching and refresh better than hand-written code would.
- **Cost:** Users with an old HS256 token must refresh or sign in again. Key revocation isn't instant (up to ~10 minutes of Supabase cache plus the 5-minute refresh).
- **Would change if:** Instant session revocation mattered, e.g. for a lost hospital device. That would need a server-side session check.

## 2026-10-07: Limited database role that keeps row-level security

- **Problem:** Go connects to Postgres directly, so Supabase's normal per-user row-level security doesn't apply automatically.
- **Chose:** A dedicated database role with only the access it needs. Go passes the verified user ID as a transaction-local setting, and role-specific policies still enforce ownership. I also removed blanket `PUBLIC` execute grants on five functions so this role couldn't inherit them.
- **Over:** Connecting as the service role (bypasses all row-level security) and relying only on Go's `WHERE` filters.
- **Why:** Defense in depth: if a Go query forgets an ownership filter, the database still blocks other users' rows.
- **Cost:** Every new workflow needs matching policies and grants, which slows each migration step. The database trusts the user ID Go sends, so this guards against missing filters, not against stolen backend credentials.
- **Would change if:** The data model became simpler, or a team preferred one clear authorization layer in application code with strong testing.
- **ADR:** [0001](adr/0001-go-database-ownership-checks.md)

## 2026-09-12: Move business logic from PL/pgSQL into a Go API, one workflow at a time

- **Problem:** The app's core workflows lived in large PL/pgSQL functions called directly from the app. They were hard to read, test, and change.
- **Chose:** A Go backend in front of the same Supabase Postgres database and schema, migrating one workflow at a time on a separate branch and development Supabase project. The app keeps Supabase sign-in, and Go verifies the token.
- **Over:** Rewriting the whole backend at once, or leaving the logic in the database.
- **Why:** Go services are easier to unit-test and explain than long SQL functions. Migrating one workflow at a time keeps the app working throughout, and each step can be checked against the old behavior. Learning Go was also an explicit goal.
- **Cost:** Two backend paths exist at the same time during the migration, plus an extra service to run and later deploy.
- **Would change if:** The logic were small and mostly simple reads. Then plain Supabase plus row-level security would be enough.

## 2026-09-12: Standard library HTTP and GORM, with plain SQL where needed

- **Problem:** Choosing how the Go API handles routing and database access.
- **Chose:** Go's built-in `net/http` router. GORM for ordinary queries, mapped to the existing tables. Small explicit SQL for things GORM doesn't model well (e.g. `set_config`, advisory locks). Schema changes go through reviewed migration files, never GORM's automatic migration.
- **Over:** A web framework (Gin, Echo), raw SQL everywhere, or letting GORM manage the schema.
- **Why:** The standard library router handles methods and path parameters well enough, so a framework wasn't needed. GORM keeps simple queries short and readable. Keeping migrations manual protects a schema shared with an existing app.
- **Cost:** Two ways to query the database, so the codebase needs a convention for when to use each (researched in `go-migration/research-gorm-raw-sql-convention.md`).
- **Would change if:** Query complexity grew. Then a generated-from-SQL tool like sqlc could be a better fit than an ORM.

## 2026-08-28: Zustand store instead of one big React Context

- **Problem:** All server workspace state lived in one broad React Context value, so a change to any field re-rendered every screen using it.
- **Chose:** A Zustand store created per provider mount. Components subscribe to only the fields they read using selectors.
- **Over:** Keeping Context, or splitting it into many smaller Contexts.
- **Why:** Selectors limit re-renders without a tangle of nested providers, and the store can be tested on its own.
- **Cost:** One more dependency, and a library concept to learn in place of built-in React.
- **Would change if:** The app moved to a server-cache library like TanStack Query. Much of this state is really server data.

## 2026-08-15: Python optimizer on Cloud Run

- **Problem:** Auto-assignment needed a real constraint solver (Google OR-Tools) that could take up to ~140 seconds per run.
- **Chose:** A separate Python FastAPI service on Google Cloud Run, packaged as a standard container, handling one request per instance. Supabase remains the source of truth; the app starts a run and then reloads results from the database.
- **Over:** Supabase Edge Functions, AWS App Runner, Azure Container Apps, or a self-managed VM or Kubernetes cluster.
- **Why:** Edge Functions can't run the official OR-Tools Python package. App Runner's 120-second request limit was too short. Cloud Run allows one request per instance, long timeouts, scale-to-zero, and easy rollback, with no cluster to manage.
- **Cost:** A third vendor (GCP), with its own billing and permissions. Scale-to-zero adds cold-start delay.
- **Would change if:** Solves got short enough to run anywhere, or long enough to need a background-job design instead of one long HTTP request.

## 2026-07-18: Manual moves stored as history, not edits to the generated assignment

- **Problem:** Charge nurses needed to move a bed to a different nurse after auto-assignment.
- **Chose:** Keep the optimizer's result as a fixed baseline, and store each manual move as a separate record. Only the newest move per bed is active. A bed's current nurse is the active move's target, or the baseline nurse if there's no move.
- **Over:** Editing the generated assignment directly.
- **Why:** You can always see what the optimizer suggested versus what a human changed, and every move can be checked against current state.
- **Cost:** Reads have to combine the baseline with active moves, and old moves accumulate as history.
- **Would change if:** Nobody needed the original suggestion or an audit trail.

## 2026-07-18: Deferred the offline read cache

- **Problem:** The plan included letting charge and joined nurses see their last board while offline.
- **Chose:** Defer it until real hospital testing shows it's needed.
- **Over:** Building the read-only cache.
- **Why:** The cache would store protected patient assignment data on the device, which adds risk (sign-out clearing, cross-user leaks) without a proven need.
- **Cost:** A connection drop leaves the board unavailable rather than showing a stale copy.
- **Would change if:** Testing showed nurses regularly lose signal on the floor.

## 2026-06-13: Supabase for auth and storage, with each shift stored as one JSON snapshot

- **Problem:** Phase 5 needed real accounts and server storage after the local prototype was proven.
- **Chose:** Supabase Auth (email/password) and Supabase Postgres, with row-level security as the authorization layer. Templates and active shifts are stored as JSON snapshots (floor, nurses, beds, assignment, requests) instead of fully normalized tables. Old local storage was removed instead of kept as a fallback.
- **Over:** A custom backend from the start, or a fully normalized schema.
- **Why:** One provider covered auth, database, and security rules, which was beginner-friendly. Snapshots matched the existing TypeScript `Shift` model, so the app code barely changed.
- **Cost:** The snapshot choice created later costs: row-level security can't protect parts of a JSON document (ADR 0004), unlocking a shift exposes the whole snapshot (ADR 0003), and concurrent edits need revision checks (ADR 0002).
- **Would change if:** I started over now. I'd split frequently changed parts (requests, nurse assignments) into their own tables early.

## 2026-05-17: Local-only prototype before any backend

- **Problem:** Starting a new app with an uncertain workflow.
- **Chose:** Phases 1–3 ran entirely on one device with local state: floor setup, assignment, the floor board, and a simulated nurse view. Backend, auth, and real-time features waited until Phase 5 or later.
- **Over:** Building auth and a database first.
- **Why:** It proved the charge nurse workflow quickly and cheaply, and the data model was settled before it was locked into a database.
- **Cost:** Local persistence code was later thrown away, and local IDs had to be replaced by server IDs.
- **Would change if:** The project had a fixed backend requirement from day one, such as integrating with a hospital system.
