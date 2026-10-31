# Hosted development, cutover preparation, and retirement (milestone 7)

Milestone 7 covers tickets 20–23. The user authorized it on 2026-10-25 and settled
the decisions below in a grilling session. Milestone 6 is closed by the same
decision, with ticket 18 and notification navigation still deferred.

Ticket 20 is implemented in code and waits for the user's one-time Google Cloud
setup before its live checks. Parts of ticket 21 are prepared ahead of time: the
production configuration, the legacy-caller inventory, and the rollback plan
below, none of it applied. Tickets 22 (production cutover) and 23 (retirement)
each need their own explicit approval and have not started.

## Decisions

| # | Area | Decision |
| --- | --- | --- |
| 1 | Scope | This session covers ticket 20 plus ticket 21's preparation. Ticket 21's live hosted matrix runs after provisioning. Tickets 22 and 23 are separate approvals. |
| 2 | Host | Google Cloud Run in `us-east4` (northern Virginia, next to Supabase's AWS `us-east-1`). See [ADR 0006](../adr/0006-cloud-run-development-hosting-with-github-deploys.md). |
| 3 | Isolation | A new GCP project for development only (for example `nurseflow-dev-<suffix>`). It holds no production optimizer, secrets, or IAM. |
| 4 | Dev solver | A second Cloud Run service, `nurseflow-solver-dev`, runs the existing Python image with only `NURSEFLOW_SOLVER_TOKEN`, so only `/v1/solve` exists. It has no Supabase keys. |
| 5 | Service auth | Keep the shared bearer token from milestone 6, stored in Secret Manager. Cloud Run IAM identity tokens are deferred. |
| 6 | Limits | Both services scale to zero. API: max 2 instances, concurrency 80, 1 vCPU / 256 MiB, 160 s request timeout, 5 database connections per instance (≤ 10 total). Solver: max 1 instance, concurrency 1, 1 vCPU / 2 GiB, 140 s timeout (the Phase 9 contract). |
| 7 | Project selection | `NURSEFLOW_SUPABASE_PROJECT_REF` is required and must be exactly the development or production ref. The issuer, database host check, and pooler user come from it. One image moves between environments by configuration alone. |
| 8 | Secrets and image | DB password and solver token live in Secret Manager. Each runtime service account can read only its own secrets. The public Supabase Root 2021 CA is baked into a distroless, non-root image; `NURSEFLOW_HTTP_ADDR=:8080`. |
| 9 | Deploys | GitHub Actions, authenticated by Workload Identity Federation (no stored Google key). Steps: test, build the image tagged with the commit SHA, deploy a no-traffic candidate, smoke-check it, then move traffic. |
| 10 | Expo | Expo web stays local (`localhost:8081`) and points `EXPO_PUBLIC_GO_API_URL` at the hosted URL. The Android emulator uses the HTTPS URL directly, without `adb reverse`. No web hosting is added. |
| 11 | Account steps | The user installs gcloud, signs in, links billing, and types the database password. The agent prepares exact commands. |
| 12 | Trigger | Deploys run on pushes to `codex/go-migration` that change `backend/**` (API) or `optimizer-service/**` (solver). Each workflow also triggers on changes to its own file, and the API workflow on `deploy/development/api.env.yaml`. There is no manual button, because it needs the workflow on the default branch. Redeploy with "Re-run jobs". Merging into `main` is a ticket 22 cutover step. |
| 13 | GitHub trust | A `gcp-development` environment, limited to `codex/go-migration`, holds only non-secret IDs. Google trusts tokens only from repository ID `1225352400`, that branch, and that environment. The deployer account can push images and manage Cloud Run, but has no Secret Manager access itself. It can deploy code that runs as the runtime accounts, which do read secrets, so push access to the branch is effectively secret access. That is inherent to continuous deployment; branch access is the real boundary. |
| 14 | Solver deploy | Same pattern, in its own workflow. |
| 15 | Rollback | One documented `gcloud run services update-traffic` command. Each deploy summary prints it with the exact previous revision. |
| 16 | Bootstrap | A checked-in, re-runnable gcloud script (`deploy/bootstrap-gcp.ps1`), not Terraform. |
| 17 | Store release | App Store / Play Store release is a proposed follow-on milestone after the cutover, not part of milestone 7. |

## What was built (ticket 20)

| File | Purpose |
| --- | --- |
| `backend/internal/supabaseproject/` | The two allowed project refs and `FromEnvironment()`. `database.Open`, `database.URL`, `auth.New`, and `auth.Issuer` take the ref. |
| `backend/Dockerfile`, `backend/.dockerignore` | Two-stage build: Go 1.27.1 compiles a static binary, and `distroless/static-debian12:nonroot` runs it. |
| `backend/certs/supabase-root-2021-ca.crt` | The public Supabase Root 2021 CA (SHA-256 `80:70:25:AD:…:CA:FA`, expires 2031-04-26), so Postgres TLS stays `verify-full`. It is the same certificate as the CI environment's `NURSEFLOW_DB_CA_CERT_PEM`. |
| `deploy/development/api.env.yaml` | The API's non-secret settings. The workflow appends the solver URL. |
| `deploy/bootstrap-gcp.ps1` | One-time GCP and GitHub setup. |
| `.github/workflows/deploy-api.yml` | Go checks, then a deploy of `nurseflow-api-dev`. |
| `.github/workflows/deploy-solver.yml` | Python checks, then a deploy of `nurseflow-solver-dev`. |

The two workflows originally repeated the same deploy steps, and each file read top to bottom. Ticket 22's prep moved the deploy steps into reusable workflows (`cloud-run-api.yml`, `cloud-run-solver.yml`), because production needed them as well (see below).

### How a deploy protects the running version

1. `gcloud run deploy --no-traffic --tag candidate` creates a new revision with its own URL. Users stay on the old revision.
2. The API connects to Postgres, checks the `nurseflow_go` role, and loads the Supabase signing keys **before** it listens. A revision with a wrong password or project ref never becomes ready, so the deploy command fails and nothing changes for users. This is the "deployment failure visibility" check.
3. Smoke checks hit the candidate URL. The API must return `{"status":"ok"}` on `/health` and `401` on `/floor-templates` without a token. The solver must return `401` on an unauthenticated `POST /v1/solve`. Cloud Run reserves paths ending in `z`, so the solver's `/healthz` can't be used.
4. Only then does `update-traffic --to-revisions <new>=100` switch users over.

The first deploy of each service creates it, because Cloud Run cannot create a
service with no traffic. There is no earlier revision to protect at that point.

### Runtime notes

- **Connection pools across instances:** each instance has its own pool of 5. At max 2 instances that is 10 session-pooler connections. Raising `--max-instances` multiplies this, so check the Supabase pooler limit first.
- **Cold starts:** at zero instances, the first request waits for a container start, the database check, and the key download (a few seconds). The 150 s assignment-run budget is unaffected.
- **Background work:** Cloud Run gives CPU only during requests by default. The signing-key refresh can lag while the instance is idle, but an unknown key ID still triggers a rate-limited refresh, so new keys are picked up.
- **Secrets** use `:latest` and are read when an instance starts. After rotating the solver token, re-run both deploy workflows so no running instance keeps the old value.

## User setup (one time)

These steps need your Google account, billing, and the development database
password, so you run them. Use `!` in Claude Code to run a command in this session.

1. Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) for Windows, then run `! gcloud auth login`.
2. Find your billing account: `! gcloud billing accounts list`.
3. Choose a globally unique project ID, then run:
   `! powershell -File deploy/bootstrap-gcp.ps1 -ProjectId nurseflow-dev-<suffix> -BillingAccount <id>`.
   It prompts (hidden) for the **development** `nurseflow_go` password, which is the one saved by `backend/scripts/development.ps1 Save`. It generates the solver token itself.
4. Commit and push the branch. Both workflows trigger because their files are new. If the API job ran before the solver existed, it stops with "Run the solver deploy workflow first". Re-run it after the solver run finishes.
5. Copy the API URL from the run summary into Expo's `.env` as `EXPO_PUBLIC_GO_API_URL`, then restart Expo.

Expected cost at development traffic is close to zero: scale-to-zero Cloud Run
within the free tier, plus a few cents of image storage. A billing budget alert is
optional (`gcloud billing budgets create`).

### Rollback

Each deploy summary prints the exact command, for example:

```text
gcloud run services update-traffic nurseflow-api-dev --region us-east4 --project <project> --to-revisions <previous-revision>=100
```

A later push deploys a new revision and moves traffic forward again.

## Verification

### Done locally (2026-10-26)

- `gofmt`, `go vet ./...`, `go build ./...`, and `go test -race ./... -count=1` pass. New tests cover both refs, cross-project direct-host rejection, unknown or missing refs, and the per-project issuer. Live database tests skip without credentials.
- A static Linux build (`CGO_ENABLED=0 GOOS=linux`, the Dockerfile's compile step) produced an ELF binary. The full `docker build` was **not** run because the local Docker daemon was stopped. The first workflow run is the first image build.
- The Python suite passes: 118 tests, run on local Python 3.14.4. CI uses the pinned 3.13.14.
- Both workflows and `api.env.yaml` parse as YAML. actionlint was **not** run: fetching it was blocked in this session. Run `actionlint` before pushing if it is available.
- The bootstrap script parses with no errors. Its helpers were exercised against a fake `gcloud`:
  - argument quoting of the WIF condition (`&&`, single quotes) and the comma mapping
  - failure detection
  - secret bytes sent exactly: a value with spaces, `&|"`, and non-ASCII characters arrived byte-for-byte. This caught and fixed a UTF-8 byte-order mark that Windows PowerShell adds to process stdin.

  The real gcloud/gh calls have not run.

### Ticket 20 live checks (2026-10-29)

Setup ran against GCP project `nurseflow-dev-2610`. Commit `3ebae95` was the first deploy. The API URL is `https://nurseflow-api-dev-e5rif6atnq-uk.a.run.app`.

- [x] Both workflow runs pass. The first API run stopped with "Run the solver deploy workflow first", as expected, because the two services were deployed by the same push. A re-run after the solver finished passed. The second deploy's summary showed the revision, the image SHA tag, and the rollback command. The first deploy has no rollback line because there was no earlier revision.
- [x] `GET <url>/health` returns `{"status":"ok"}`. An unauthenticated `/floor-templates` returns 401.
- [x] Expo web (local, `localhost:8081`) loaded the signed-in development account's profile, templates, active shift, and joined workspace from `run.app`. Every request returned 200, which also proves CORS for the localhost origin.
- [x] Android emulator (Pixel 7 Pro, API 33): signup of a new synthetic account and its Go-backed home screen worked. Only Metro's port (8081) was reversed. The API requests reached Cloud Run over the internet.
- [x] Failure visibility: a revision deployed the way the workflow does it (`--tag candidate --no-traffic`) with `NURSEFLOW_DB_HOST=wrong-host.invalid` failed to deploy. The log showed `configure database: database host must be the project's direct host or a Supabase session pooler`. Users and the candidate URL stayed on the healthy revision.
  - Finding: the same bad revision deployed **without** `--tag` was reported as "deployed", because Cloud Run retires an untagged no-traffic revision on a scale-to-zero service without ever starting it. The workflow always tags the candidate, so it is not affected. Any manual no-traffic deploy must also add a tag, or it proves nothing.
- [x] Rollback with the printed command, from `00005-bev` to `00001-joc`, took a few seconds and `/health` stayed ok. Rolled forward again the same way.
- [x] Assignment run through the hosted API and solver: `POST /active-shifts/{id}/assignment-runs` returned `saved` with a new result ID. The solver's request log shows `POST /v1/solve` returning 200 at the same moment. The run was sent from the signed-in development session using the app's own request shape. The shift was the milestone 5 fixture's 2-bed floor, so the solve took 0.2 s.

Seen during the checks, not caused by hosting: Supabase Realtime once returned `MissingPartition` for the charge active-shift listener on the first connection after the development project had been idle since 2026-10-26. The client rejoined on its own about a second later ("listener live"), and today's `realtime.messages` partition existed afterwards. Realtime traffic goes straight to Supabase, not through Cloud Run.

## Ticket 21 hosted matrix (2026-10-29)

Stack: the hosted API (`nurseflow-api-dev-00005-bev`) and solver on Cloud Run, the development Supabase project, and Expo running locally. Only Metro's port was reversed to Android, so all API traffic crossed the internet.

Devices:
- Charge: Charge M5 on Expo web in Playwright (Chromium).
- Joined nurse: Charge M7 Android on the Pixel 7 Pro API 33 emulator, using the existing debug app on the current Metro bundle and driven with `adb` and `uiautomator`.
- Isolation: a separate browser context with a fresh synthetic account.

iOS and physical devices were not tested; none were available.

| Area | Check | Result |
| --- | --- | --- |
| Charge workflow (web UI) | End shift, carry-over review (2 nurses, 2 patients), start shift, setup, Run assignment | Passed. The board showed Ava → 201 and Ben → 202. |
| Charge workflow (web UI) | Create template "M7 Hosted Floor" (4 steps) | `POST /floor-templates` 201 |
| Charge workflow | Delete it with the app's request | `DELETE` 204, and the template is gone. The swipe-to-delete control could not be driven by a mouse drag (see findings). |
| Invites and joining | Generate a code in the UI and join on Android | The scoped view showed only Room 202, Bed 1, and Realtime was Live. |
| Invites and joining | A used code after a reopen | Refused: "That code has already been used". |
| Invites and joining | A new code | Joined. |
| Live updates | One charge rerun | Exactly one change event and one `GET /joined-workspace` on Android, within the same second. An unsent issue draft was kept. |
| Requests and threads | Issue from Android | It appeared live on the charge's Requests list. Charge reply → shown on Android. Nurse reply → shown live on web. Reviewed and Resolved statuses reached Android live. |
| Requests and threads | Swap from Android | Appeared live. Accept → Android showed "Accepted — assignment change pending". |
| Manual move | Move a bed to the other nurse (app request shape) | `422 invalid_move`, "The selected nurse does not cover this room". This is correct: on this floor each nurse covers one room. Successful moves were verified through the UI in ticket 12. The move swipe could not be driven by a mouse (see findings). |
| Reconnect | Android offline, charge rerun, back online | The badge showed "Live issue" with a transport failure. Back online, it showed "reconnected; refreshing" and made one refetch. The missed change appeared. |
| Access removal | Charge "Edit active shift" (reopen) | Android showed "Access removed" within seconds, and the charge's invite list showed Ben as "Removed". The first attempt overlapped a network blip and showed "Shift ended" (see findings). |
| End Shift | Charge ends the shift while the nurse is joined | Android showed "Shift ended" within seconds. |
| Sign-out | Separate-context account signs out | Returned to `/login` with the stored session cleared. |
| Isolation (fresh account) | Own data | Templates 0, active shift null, joined workspace empty. |
| Isolation (fresh account) | Charge M5's records | Template `DELETE` → 404 `template_not_found`. Run on M5's shift → 403 `forbidden`. Move on M5's shift → 404 `shift_not_found`. |
| Run safety (app request shape) | Replay | Same run and result. |
| Run safety (app request shape) | Stale revision; old baseline | 409 `stale` for both. |
| Run safety (app request shape) | Reused mutation with new preconditions | 409 `conflict`. |
| Run safety (app request shape) | Unknown field; no token | 422 `invalid_input`; 401. |
| Run safety (app request shape) | Two runs at once, same preconditions | One saved (200). The other returned 202 `running` with the same run ID, and only the winner is current. |
| Cold start | UI run after the API had been idle about 16 minutes and the solver about 20 | Both services started new instances. The API was ready in 0.5 s (database and key checks included) and the solver (uvicorn and OR-Tools) in 2.4 s. The board appeared 4.1 s after the click. |
| Warm solver | Earlier runs | 0.05–0.2 s per solve. The solver was still warm about 14 minutes after its last request. |

Findings (none caused by hosting):

1. **The access-removal label can say "Shift ended".** If a Realtime reconnect happens at the moment the charge reopens the shift, the nurse sees "Shift ended" instead of "Access removed". The reconnect refresh added in milestone 6 calls `refreshJoinedNurseAccess("shift_changed")`. Access is still removed either way; only the wording is wrong. A possible follow-up is to label a reconnect refresh by what the refetch finds, not by the event type. Not changed here.
2. **The swipe actions did not respond to a mouse drag on web.** The template-delete and bed-move controls use `PanResponder`, and Playwright's mouse drag did not reveal them. The UI predates the migration, and it is unconfirmed whether a real desktop mouse has the same problem. The underlying requests were exercised directly.
3. **Realtime `MissingPartition`.** It happened once after the project had been idle, and recovered within about a second (see ticket 20).

Release gates still open for ticket 22:
- The production decisions in the change list below: hosting location, the production `nurseflow_go` password, and `min-instances` for real users. The 4 s cold start is acceptable for development; production can keep one instance warm.
- Merging into `main`.
- iOS and physical devices are untested.
- Notifications stay deferred (ticket 18 and notification navigation).
- A store release is proposed for milestone 8.

## Ticket 21 preparation (not applied)

### Remaining direct Supabase use in Expo (2026-10-26 inventory)

| Responsibility | Where | Classification |
| --- | --- | --- |
| Sign-up, sign-in, sign-out, session restore and refresh | `authRepository.ts`, `AuthSessionContext.tsx` | **Retained**: Supabase Auth by design. |
| Access token for Go | `goApiAuth.ts`, `shiftRepository.ts`, `floorTemplateRepository.ts` (`auth.getSession`) | **Retained**: Auth. |
| Realtime broadcast: `nurseflow:active-shift:*`, `nurseflow:nurse-access:*`, `nurseflow:request-thread:*` | `realtimeWorkspaceRepository.ts` | **Retained**: Supabase Realtime by design. It uses private broadcast channels, not `postgres_changes`. The database triggers that broadcast must survive ticket 23. |
| `register_device_push_token`, `disable_current_device_push_token` RPCs | `devicePushTokenRepository.ts` | **Deferred**: ticket 18. Gated off by `EXPO_PUBLIC_NOTIFICATIONS_ENABLED`. |
| `shift_nurse_access` select (notification-tap target) | `serverWorkspaceRepository.ts` `loadJoinedNurseNotificationTargetState` | **Deferred**: ticket 11's notification lookup. Gated off. |
| Everything else (templates, shifts, invites, joining, moves, requests, threads, assignment runs) | Go through `goApiClient` | **Migrated**. No `functions.invoke`, storage, or direct optimizer calls remain. |

On the server side, the legacy Python `/v1/assignment-runs` route
(`http_api.py`, `service.py`, `runtime.py`, `supabase_clients.py`) calls the
`prepare_optimizer_run`, `finalize_optimizer_run`, and `fail_optimizer_run`
RPCs with the Supabase secret key. The production app on `main` still uses this
route and the other legacy RPCs, so they remain until ticket 23.

### Production change list (draft, superseded by "Ticket 22: production cutover" below)

1. Apply the seven reviewed migrations in order to production `mkljczezkyqtuplzedpj`. Before that, re-run the read-only catalog comparison against production, because the development baseline came from it.
   - `20261008060018_go_template_read_role`
   - `20261018014344_go_template_writes`
   - `20261018160805_go_shift_lifecycle`
   - `20261020055621_go_shift_lifecycle_policy_initplans`
   - `20261024120000_go_profiles_invites_access`
   - `20261024180000_go_moves_requests_threads`
   - `20261025120000_go_assignment_runs`

   They are additive for existing clients. New roles, policies, and grants are added. The only revokes remove blanket `PUBLIC` execute from five invite and request RPCs while keeping their explicit client-role grants, and they lock down the new `go_private` helpers. This was verified on development; confirm again on production.
2. Privately provision the production `nurseflow_go` password and enable login, as done for development in ordered task 6.
3. Production hosting: a separate production GCP project, or the existing optimizer project. This is **to decide at ticket 22**. Same image and workflow shape, with `NURSEFLOW_SUPABASE_PROJECT_REF=mkljczezkyqtuplzedpj`, the production pooler host, a production solver token, and a `/v1/solve`-capable production solver revision. Reconsider `min-instances 1` for real users.
4. Merge `codex/go-migration` into `main`. Point the production Expo build's `EXPO_PUBLIC_GO_API_URL` at the production API, and move the deploy trigger to `main`.
5. Smoke checks: sign-in, template list, start shift, invite and join, a move, an assignment run, and joined-nurse live refresh, using a real production charge account approved by the user. No development fixtures are copied.

### Rollback plan (draft)

- **App:** the commit on `main` just before the merge is the rollback build. It uses only the legacy client paths, which stay in place until ticket 23.
- **API:** Cloud Run traffic goes back to the previous revision, or to 0% if the app has rolled back.
- **Database:** the migrations are additive, so the legacy paths keep working with them applied. Rollback does not reverse migrations unless a specific defect requires it.
- **Triggers to roll back:** any smoke check fails; a charge or joined-nurse workflow error appears that development did not show; or authorization isolation is in doubt.

## Ticket 22: production cutover

The user approved starting ticket 22 on 2026-10-29. A grilling session settled the decisions below, and they supersede the draft change list and rollback plan above. As of this writing, the prep is done and nothing has been applied to production.

Facts found first:
- `main`'s app calls the Python optimizer at `http://127.0.0.1:8080`, because Phase 9 was never deployed. There is no hosted production backend to replace.
- The production Supabase project `nurseflow` (`mkljczezkyqtuplzedpj`, `us-east-1`) was paused (`INACTIVE`) and must be restored first.
- The GCP project `nurseflow-512906` exists but is empty.

### Decisions

| # | Area | Decision |
| --- | --- | --- |
| 1 | Users | No outside users yet. They arrive with the App Store release (milestone 8). |
| 2 | Host | Production runs in its own GCP project, `nurseflow-512906`, set up with `deploy/bootstrap-gcp.ps1 -Environment production`. Development secrets and permissions never reach it. |
| 3 | Solver | Solver-only, like development: `/v1/solve` with its own shared token, no Supabase keys. `main`'s old direct-call route is never hosted. |
| 4 | Gate | The `gcp-production` GitHub environment allows only `main` and requires the user's approval for every deploy. |
| 5 | Order | 1. Restore the paused production Supabase project. 2. Read-only catalog comparison. 3. Apply the 7 migrations. 4. Set the `nurseflow_go` password. 5. Production bootstrap. 6. PR merge into `main`. 7. Approve the production deploys (solver first). 8. Point the app at production. 9. Smoke checks. |
| 6 | Password | The user generates it, sets it in production's SQL editor (`alter role nurseflow_go login password '…'`), and pastes it at the bootstrap's hidden prompt. The agent never sees it. |
| 7 | Migrations | The agent runs the read-only comparison and applies the 7 files with the Supabase CLI only after the user's explicit "apply". |
| 8 | Origins | Mobile-only, so production's `NURSEFLOW_WEB_ORIGINS` is empty and the API refuses every browser origin. Development keeps localhost. |
| 9 | Triggers | `deploy-api.yml` and `deploy-solver.yml` run on pushes to `main` and `codex/go-migration`. Development deploys automatically. Production runs only from `main`, only after development succeeded, and waits for approval. |
| 10 | Instances | Production starts at `min-instances 0`, since the measured cold start was 4.1 s. Whether to keep one instance warm is decided at milestone 8. |
| 11 | Smoke accounts | Two reusable production test accounts (a charge and a nurse), created and signed in by the user with passwords in their password manager. No development fixtures are copied. |
| 12 | Local setup | After the merge, one folder: `.env` holds production settings and `.env.dev` holds development settings (`npm run start:dev`). The migration worktree is removed during ticket 23's cleanup. |
| 13 | Rollback | See below. Migrations stay in place, and a defect gets a fix-forward migration. |
| 14 | Ticket 23 | Can run after about a week of stable production use, because no store build will ever use the old paths. From milestone 8 on, Go API changes must keep working for app versions already installed. |
| 15 | Merge | Through a GitHub pull request that the user merges. |

### What the prep changed

| File | Change |
| --- | --- |
| `.github/workflows/cloud-run-api.yml`, `cloud-run-solver.yml` | New reusable deploy steps (`workflow_call`), unchanged in substance. Each environment passes its GitHub environment, service name, and settings file. The runtime service account has the same name as the service. A per-service concurrency group means a production job waiting for approval never blocks development. |
| `.github/workflows/deploy-api.yml`, `deploy-solver.yml` | Renamed from `*-development.yml`. The jobs are test, then development, then production (on `main` only). |
| `deploy/production/api.env.yaml` | The production ref, the `us-east-1` pooler host, and empty origins. |
| `deploy/bootstrap-gcp.ps1` | Moved out of `deploy/development/`. `-Environment production` uses the `-prod` names, the `gcp-production` environment, `main` only, and the signed-in GitHub user as required reviewer. Development allows `main` and `codex/go-migration`. Google's condition is now `assertion.ref in [...]`. The GitHub environment settings go through a temporary JSON file, because Windows PowerShell prefixes piped input with a byte order mark that GitHub rejects. |
| `package.json` | `npm run start:dev` starts Expo with `.env.dev` loaded through Node's `--env-file`. Expo does not override variables that are already set. The file is not named `.env.development`, because Expo loads that file on every `expo start`. |

### Cutover progress

- **2026-10-29, step 1:** The user restored the paused production project, which reports `ACTIVE_HEALTHY`.
- **2026-10-29, step 2:** Read-only comparison. The baseline capture queries (`supabase/baseline/capture-*.sql`) were re-run against production and diffed with the 2026-09-12 capture: all 263 catalog rows and all 29 functions were identical. Production had no migration history table, no `nurseflow_go`, no `go_private`, and no `go_*` policies.
- **2026-10-29, step 3:** The user ran `.scratch/apply-production-migrations.ps1`. Claude Code's auto mode blocks agent-run production changes, so the agent prepared the script and the user executed it. All 7 migrations applied in order, each was recorded with `migration repair`, and `migration list` shows all 7 local = remote.
  - Production vs. the September baseline: +32 `go_*` policies, `nurseflow_go` column/table/schema grants, and `PUBLIC` execute removed from the 5 invite/request functions (their `anon`/`authenticated` grants are kept). Nothing else changed.
  - Production vs. development: identical, apart from Supabase's dated Realtime partitions and the two `nurse_request_messages` check constraints that the September restore deparses with flatter AND grouping (same meaning; see `supabase/baseline/development-verification`).
  - `nurseflow_go` exists with login disabled.
- **2026-10-29, steps 4–5:** The user set the production `nurseflow_go` password, enabled login, and ran `deploy/bootstrap-gcp.ps1 -Environment production -ProjectId nurseflow-512906`.
  - Verified: `gcp-production` allows only `main` and requires `pratham124`, and its three variables point at `nurseflow-512906`. Google's condition is `ref in ['refs/heads/main']` and `environment == 'gcp-production'`. Both secrets exist.
  - Finding: the production pooler is on Supabase's **`aws-1-us-east-1`** cluster. `aws-0` answers `tenant/user … not found` for this project, while development is on `aws-0`. `deploy/production/api.env.yaml` was corrected before the merge.
  - With the stored secret (never printed), `cmd/dbcheck` reported "Connected to Supabase project mkljczezkyqtuplzedpj Postgres as nurseflow_go".
- **2026-10-29, step 6:** [PR #2](https://github.com/pratham124/nurse-flow/pull/2) opened, and the user merged it (`37199f8`). Both workflows on `main` ran tests and the development deploys, then waited at `gcp-production`.
- **2026-10-30, step 7:** The user approved the solver, then the API. Both production deploys passed. The API is `https://nurseflow-api-prod-vfz2gnvpna-uk.a.run.app` (revision `nurseflow-api-prod-00001-fih`). Direct checks:
  - `/health` returns ok;
  - unauthenticated `/floor-templates` returns 401;
  - a request with `Origin: http://localhost:8081` returns 403 `origin_forbidden`;
  - an unauthenticated solver `POST /v1/solve` returns 401;
  - the revision's settings are the production ref, the `aws-1` host, empty origins, and the production solver URL.
- **2026-10-30, step 8:** The main folder `first-app` was fast-forwarded to `37199f8` and `npm ci` was run. Its `.env` gained the production `EXPO_PUBLIC_GO_API_URL`, and a new gitignored `.env.dev` holds the development values for `npm run start:dev`.
- **2026-10-30, step 9: production smoke checks, all passed.** Expo ran from the main folder against production. The charge was on the Pixel 7 Pro API 33 emulator and the nurse on the Pixel 5 API 34 emulator, with only Metro's port reversed.
  - Two reusable test accounts were created through the app: Smoke Charge (`nurseflow.smoke.charge.4djao8@example.com`) and Smoke Nurse (`nurseflow.smoke.nurse.7epi3n@example.com`). Their generated passwords are saved with Export-Clixml (DPAPI, the user's Windows account only) at `%LOCALAPPDATA%\NurseFlow\prod-smoke-accounts.xml` and were never displayed.
  - An earlier Smoke Charge signup succeeded, but its password was lost when the automation script crashed. That account was signed out before it had any data. Delete it from Supabase Auth: it is the `nurseflow.smoke.charge.*@example.com` user that is not `4djao8`.
  - The charge created the "Smoke Floor" template (rooms 401 East, 402 West) through Go. The charge then started a shift, added Ana and Raj (RN, Mid), set two patients' acuity, and ran assignment. The production solver answered `POST /v1/solve` 200 in 2.3 s (cold), and the board showed Ana → 401 and Raj → 402 (Team A / Team B), with Live.
  - The charge generated an invite for Raj and the nurse joined. The nurse saw only Room 402, Bed 1 (West), with Live.
  - The nurse's issue "Prod smoke issue" appeared live on the charge's Requests list. The charge's thread reply "Charge reply prod" showed on the nurse device.
  - End Shift: the nurse switched to "Shift ended". The nurse account's own workspace showed 0 templates, so it never saw the charge's template.
  - The first production Realtime connection after the project was restored returned `MissingPartition` once and was live about 1 s later, the same as in development.
  - Not exercised in production: manual moves, swaps, reconnect, access removal, and run concurrency. They use the same code and policies as the hosted development matrix (ticket 21), and production now matches development's catalog.

Ticket 22 is done. The legacy paths stay in place for rollback until ticket 23.

Development was re-bootstrapped

Development was re-bootstrapped on 2026-10-29 with the new script. Its GitHub environment now allows `main` and `codex/go-migration`, and Google's condition lists both refs.

### Rollback

| Stage | How to undo |
| --- | --- |
| Catalog comparison | Read-only, so nothing to undo. |
| Migrations | They only add roles, policies, grants, and functions. `main`'s current app ignores them, so nothing needs undoing. Each file runs in a transaction, and a failure undoes that file; stop and fix before continuing. |
| `nurseflow_go` password | `alter role nurseflow_go nologin;` in the production SQL editor. |
| Production bootstrap | Nothing is user-facing. Leave it, or delete the project. |
| Bad API update after the first production deploy | Run the command printed in the deploy summary: `gcloud run services update-traffic nurseflow-api-prod --region us-east4 --project nurseflow-512906 --to-revisions <previous>=100` |
| Go itself (any time after the merge) | `git revert -m 1 <merge commit>` on `main`, then restart Expo. The old direct-Supabase paths still work: the migrations were additive, Go writes the same tables, and ticket 23 has not removed anything. |
| Emergency stop | Block public traffic with `gcloud run services remove-iam-policy-binding nurseflow-api-prod --region us-east4 --project nurseflow-512906 --member allUsers --role roles/run.invoker`, or cut database access with `alter role nurseflow_go nologin;`. Undo either the same way. |

Roll back if a smoke check fails, if a charge or joined-nurse error appears that development did not show, or if isolation is in doubt.

### Production smoke checks

- The deploy summary shows candidate `/health` ok and a 401 without a token. A request with `Origin: http://localhost:8081` returns 403 `origin_forbidden`, which confirms the empty origins value took effect.
- With the two production test accounts:
  - sign in, and create and list a template;
  - start a shift, add nurses and patients, and run assignment through the production solver;
  - generate an invite, and join on the second account;
  - one live update and one refetch on the nurse;
  - an issue request with a thread message;
  - End Shift.
- Isolation: the nurse account cannot use the charge's template or shift.

## Ticket 23 notes

Before removing an RPC, policy, or the legacy Python route, prove that no
supported app version still calls it. The cutover happens before any store build
(proposed milestone 8), so no store version ever uses the legacy paths. Ticket 23
can therefore run after about a week of stable production use (ticket 22,
decision 14). Once store builds exist, old installed versions keep calling
whatever API they shipped with for months. From then on, Go API changes must keep
working for installed versions until a minimum supported version is decided.
