# Local Go API

From the repository root, start the API in PowerShell:

```powershell
Set-Location backend
go run ./cmd/api
```

In a second terminal, request the health endpoint:

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:8080/health -UseBasicParsing
```

Expect HTTP 200, `Content-Type: application/json`, and `{"status":"ok"}`. This is a liveness response: it shows that the API can answer requests. It does not check database availability or authentication. POST requests to this route receive HTTP 405; unknown routes receive HTTP 404. Go's GET route also supports HEAD requests.

Stop the server with Ctrl+C. If the address is invalid or its port is occupied, startup prints an error and exits with a nonzero status.

## Server configuration

The default address is `127.0.0.1:8080`, reachable on the development computer. To use another local port, set the process environment variable before starting:

```powershell
$env:NURSEFLOW_HTTP_ADDR = '127.0.0.1:8081'
go run ./cmd/api
```

Use the configured port in the health request. The Go process reads the environment directly; it does not load the Expo `.env` file. For physical-device access, explicitly bind to `0.0.0.0:8080` and use the computer's LAN address in Expo, as described in [Expo-to-Go setup](../docs/go-migration/expo-template-read.md).

Browser requests are allowed from `http://localhost:8081` and `http://127.0.0.1:8081` by default. `NURSEFLOW_WEB_ORIGINS` overrides this exact, comma-separated list; an explicitly empty value disables browser origins. CORS permits GET/POST/PUT/DELETE preflight with Authorization/Accept/Content-Type and uses no cookies. Actual requests still require token verification and charge authorization. Native requests without an Origin header do not use CORS.

The server allows five seconds to read request headers, ten seconds to read a request or write a response, and sixty seconds for an idle connection. These explicit limits keep connections from waiting indefinitely. The one exception is `POST /active-shifts/{id}/assignment-runs`, which extends its own write deadline to 140 seconds because a solve may take about two minutes.

### Supabase project configuration

`NURSEFLOW_SUPABASE_PROJECT_REF` is required. The API and `cmd/dbcheck` refuse to start unless it is exactly one of two allowed project refs, so the same container image can move from development to production by configuration alone:

- `nmitctyxtjmlakcsmnuj`: development (the only value to use today; `scripts/development.ps1` sets it).
- `mkljczezkyqtuplzedpj`: production. Unused until the approved cutover (ticket 22).

The ref picks the token issuer (`https://<ref>.supabase.co/auth/v1`), the database direct host (`db.<ref>.supabase.co`), and the pooler user suffix (`nurseflow_go.<ref>`). A direct host belonging to the other project is rejected. Live integration tests use the development ref directly and do not read this variable.

### Hosted development

`Dockerfile` builds a static, non-root image with the public Supabase CA at `/etc/nurseflow/` and `NURSEFLOW_HTTP_ADDR=:8080`. GitHub Actions deploys it to Cloud Run from `codex/go-migration` (`.github/workflows/deploy-api-development.yml`). Setup, verification, and rollback are in [hosted development](../docs/go-migration/hosted-development.md).

### Optimizer (solver) configuration

The API refuses to start unless both of these are set, so a missing token is found at startup rather than by the first optimizer run:

- `NURSEFLOW_SOLVER_URL`: base address of the Python optimizer service, for example `http://127.0.0.1:8090` (an `http` or `https` URL; the API appends `/v1/solve`).
- `NURSEFLOW_SOLVER_TOKEN`: the shared secret the API sends as `Authorization: Bearer ...`. It must equal the solver's own `NURSEFLOW_SOLVER_TOKEN`. Keep it server-side; it is never logged.

Local example, with the Python solver started separately (see `optimizer-service/README.md`) on port 8090:

```powershell
$env:NURSEFLOW_SOLVER_URL = 'http://127.0.0.1:8090'
$env:NURSEFLOW_SOLVER_TOKEN = 'a-long-random-local-secret'
go run ./cmd/api
```

Go coordinates each run (prepare, solve, finalize) and the solver only solves; see [assignment runs](../docs/go-migration/assignment-runs.md) and ADR 0005. Migration `20261025120000` gives the Go role the `optimizer_runs` access it needs. The run workflow lives in `internal/assignmentruns`, the Python call in `internal/solver`, the database steps in `internal/database/assignment_runs.go`, and the ported output validation in `internal/shifts/run_output.go`.

## How the code fits together

- `main` starts the program and exits with status 1 if `run` returns an error.
- `run` reads the address, creates an `http.Server` struct, and calls `ListenAndServe`, which waits for and serves requests.
- `httpapi.NewHandler` creates a `ServeMux`, Go's HTTP router, and connects routes to their handlers and authentication checks.
- `healthHandler` receives a response writer and a pointer to the incoming request. It sets the response header before writing JSON. Writing without an explicit status sends HTTP 200.
- `:=` declares a variable and infers its type. `&http.Server{...}` creates a server struct and gives us a pointer to it. `if err := ...; err != nil` checks an operation's returned error explicitly. `%w` wraps an error with context while preserving the underlying error.

The server uses the Go standard library for HTTP. `cmd/api/main.go` owns startup, configuration, and dependency wiring. Routes, HTTP handlers, response types, and their tests live together in `internal/httpapi`. Authentication middleware and token verification live in `internal/auth`; shared JSON response helpers live in `internal/httpresponse`. Database queries use GORM in `internal/database`.

Charge shift reads and lifecycle operations also use Go. See the
[milestone 3 contract, transactions, and verification](../docs/go-migration/shift-lifecycle.md)
before enabling them against development: migration `20261018160805` is required
and has only been applied to isolated local PostgreSQL in this session. Shift
rules live in `internal/shifts`; Expo uses `shiftRepository.ts` and
`shiftSchemas.ts` through the shared Axios client.

Manual moves (`POST /shifts/{id}/assignment-moves`), nurse requests
(`/joined-workspace/issue-requests`, `/joined-workspace/swap-requests`, and the
charge `issue-status`/`swap-resolution` routes), and request threads
(`/shifts/{id}/requests/{requestId}/messages`) are milestone 5; see
[moves, requests, and threads](../docs/go-migration/moves-requests-threads.md)
for contracts and migration `20261024180000`. Pure move and request rules live in
`internal/shifts` (`moves.go`, `requests.go`, `threads.go`).

## Checks

Run from `backend`:

```powershell
go test ./...
go vet ./...
```

The handler tests use `httptest` to simulate requests and record responses. They check the successful status, JSON content type/body, unsupported method, and unknown route.

References: [Go HTTP server and routing documentation](https://pkg.go.dev/net/http), [Go HTTP testing documentation](https://pkg.go.dev/net/http/httptest).

## Development database

The API now opens one development database pool at startup. Set the private Task 6 database environment variables before `go run ./cmd/api`; startup exits with a controlled error if configuration or connectivity fails. `go run ./cmd/dbcheck` remains available as a separate connection check. See [development database setup and verification](../docs/go-migration/database-connection.md) for configuration.

## Authentication

`GET /auth/check` requires a current development Supabase access token in the `Authorization: Bearer <token>` header and returns its verified Auth user ID. It verifies ES256 signatures using public discovery keys, expected issuer/audience, and expiry. It checks identity only; a regular nurse can authenticate too.

Missing or invalid tokens return controlled JSON 401 errors. Required-key retrieval failures return JSON 503 errors. The public `/health` handler does not query authentication or the database. See [authentication design and checks](../docs/go-migration/api-authentication.md).

`GET /auth/charge-check` additionally resolves the application profile from the verified Auth user ID and requires its database role to be `charge_nurse`. Success returns `profile_id` and `role`; missing profiles and forbidden roles return distinct JSON 403 errors, and database lookup failures return JSON 503. See [profile authorization and manual requests](../docs/go-migration/profile-authorization.md).

Public-key discovery, caching, and background refresh use `jwkset`. Startup attempts discovery for up to five seconds and can start even if retrieval fails. The server supplies a cancellation context to stop background refresh when `run` exits.

## Floor templates

`GET /floor-templates` uses the same token and charge-nurse checks, then reads only the authorized profile's templates in `updated_at DESC` order. It returns `{ "templates": [...] }` with the six existing snake_case database fields. `template_snapshot` remains raw JSON; the frontend's existing mapper validates and adapts it in `src/services/floorTemplateRepository.ts`.

An empty list returns HTTP 200 with `{ "templates": [] }`. Template query failures return a controlled HTTP 503 `database_unavailable` error, without partial results. Query parameters and headers cannot select a different owner. Expo uses Go for template lists, saves, deletes, the charge shift lifecycle, profiles, invites and joining, the joined-nurse view, manual moves, nurse requests, and request threads. The optimizer and device notifications retain their existing paths.

`POST /floor-templates` creates a reusable layout; `PUT /floor-templates/{id}` replaces an owned layout. Both accept `{ "template_snapshot": { ... } }` and return `{ "template": { ... } }` with HTTP 201/200. The server validates layout consistency and owns IDs, owner, and timestamps. Creation and snapshot-ID synchronization commit together. `DELETE /floor-templates/{id}` returns 204; missing/foreign update/delete requests return the same 404. Existing UI restrictions and database reference actions remain. See [template writes](../docs/go-migration/template-writes.md), [list contract](../docs/go-migration/template-list.md), and [Expo setup](../docs/go-migration/expo-template-read.md).

## Windows private credential helper

From `backend`, run `./scripts/development.ps1 Save` once. It uses the current certificate environment setting or prompts for its path, then privately prompts for the working `nurseflow_go` password. It runs `dbcheck` before saving; a failed connection does not create or overwrite the saved credential.

The password is encrypted using Windows DPAPI in `%LOCALAPPDATA%/NurseFlow/go-dev-credential.xml`, outside the repository. Host and certificate-path metadata are stored alongside it. Only the Windows user account and computer that saved it can decrypt it. Other programs running as that same account can also decrypt it; this is local credential storage, not an isolation boundary between those programs. No administrator password is saved.

Subsequent commands load the credential only into the child command's process environment, then restore previous values:

```powershell
./scripts/development.ps1 Check
./scripts/development.ps1 TestTemplates
./scripts/development.ps1 TestTemplateWrites
./scripts/development.ps1 TestShifts
./scripts/development.ps1 Api
```

`TestTemplates` clears any local database override and runs the development-only template isolation test with the documented synthetic account IDs. An agent must run this helper through approved commands as the Windows account that saved the credential; the sandbox account cannot decrypt it. The helper never prints the password or a credential-bearing connection string.

`TestTemplateWrites` uses the same development-only configuration. It creates, updates, and removes its own temporary synthetic templates, checks ownership/role isolation and immutable fields, and leaves the existing fixture templates unchanged. The injected rollback trigger/reference checks run only against the isolated local test database.

`TestShifts` performs read-only active-shift/carry-over ownership and role checks
using the same fixture identities. It requires the milestone 3 migration. The
staged lifecycle, failure-injection, and HTTP/client demo tests run only with an
explicit isolated loopback test URL; they never stage fixtures in development.

Synthetic helper checks are in `scripts/test-development.ps1`. They mock the Go command and use a separate temporary credential, covering DPAPI round trips, absence of plaintext passwords in saved data/output, environment restoration, and preservation of an existing credential after a failed save. They do not verify a real password or contact Supabase.

Reference: [Microsoft's Windows credential encryption documentation](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/export-clixml#example-3-encrypt-an-exported-credential-object-on-windows).

## GitHub Actions database checks

Backend changes pushed to `codex/go-migration` run the existing read-only template isolation test on a GitHub-hosted runner. The workflow first checks direct development database connectivity, then uses verified TLS and the limited development credential from the branch-restricted `nurseflow-go-development` GitHub environment. This works independently of the laptop and does not depend on Codex Cloud's direct database networking.

See [CI setup and verification](../docs/go-migration/ci-database-checks.md) for configuration names, scope, and how to view or rerun the test. No schema or fixture changes are made by this workflow.
