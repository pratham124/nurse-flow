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

Browser reads are allowed from `http://localhost:8081` and `http://127.0.0.1:8081` by default. `NURSEFLOW_WEB_ORIGINS` overrides this exact, comma-separated list; an explicitly empty value disables browser origins. CORS permits GET preflight with Authorization/Accept and uses no cookies. Actual requests still require token verification and charge authorization. Native requests without an Origin header do not use CORS.

The server allows five seconds to read request headers, ten seconds to read a request or write a response, and sixty seconds for an idle connection. These explicit limits keep connections from waiting indefinitely.

## How the code fits together

- `main` starts the program and exits with status 1 if `run` returns an error.
- `run` reads the address, creates an `http.Server` struct, and calls `ListenAndServe`, which waits for and serves requests.
- `httpapi.NewHandler` creates a `ServeMux`, Go's HTTP router, and connects routes to their handlers and authentication checks.
- `healthHandler` receives a response writer and a pointer to the incoming request. It sets the response header before writing JSON. Writing without an explicit status sends HTTP 200.
- `:=` declares a variable and infers its type. `&http.Server{...}` creates a server struct and gives us a pointer to it. `if err := ...; err != nil` checks an operation's returned error explicitly. `%w` wraps an error with context while preserving the underlying error.

The server uses the Go standard library for HTTP. `cmd/api/main.go` owns startup, configuration, and dependency wiring. Routes, HTTP handlers, response types, and their tests live together in `internal/httpapi`. Authentication middleware and token verification live in `internal/auth`; shared JSON response helpers live in `internal/httpresponse`. Database queries use GORM in `internal/database`.

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

An empty list returns HTTP 200 with `{ "templates": [] }`. Template query failures return a controlled HTTP 503 `database_unavailable` error, without partial results. Query parameters and headers cannot select a different owner. Expo now uses this endpoint for template lists; its other reads and writes retain their existing paths.

See [the endpoint contract](../docs/go-migration/template-list.md) and [Expo integration/setup](../docs/go-migration/expo-template-read.md). Task 9 is complete. Task 10's implementation and Alpha browser check passed; its remaining manual checks are recorded in the migration plan. The full milestone walkthrough remains Task 11.

## Windows private credential helper

From `backend`, run `./scripts/development.ps1 Save` once. It uses the current certificate environment setting or prompts for its path, then privately prompts for the working `nurseflow_go` password. It runs `dbcheck` before saving; a failed connection does not create or overwrite the saved credential.

The password is encrypted using Windows DPAPI in `%LOCALAPPDATA%/NurseFlow/go-dev-credential.xml`, outside the repository. Host and certificate-path metadata are stored alongside it. Only the Windows user account and computer that saved it can decrypt it. Other programs running as that same account can also decrypt it; this is local credential storage, not an isolation boundary between those programs. No administrator password is saved.

Subsequent commands load the credential only into the child command's process environment, then restore previous values:

```powershell
./scripts/development.ps1 Check
./scripts/development.ps1 TestTemplates
./scripts/development.ps1 Api
```

`TestTemplates` clears any local database override and runs the development-only template isolation test with the documented synthetic account IDs. An agent must run this helper through approved commands as the Windows account that saved the credential; the sandbox account cannot decrypt it. The helper never prints the password or a credential-bearing connection string.

Synthetic helper checks are in `scripts/test-development.ps1`. They mock the Go command and use a separate temporary credential, covering DPAPI round trips, absence of plaintext passwords in saved data/output, environment restoration, and preservation of an existing credential after a failed save. They do not verify a real password or contact Supabase.

Reference: [Microsoft's Windows credential encryption documentation](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/export-clixml#example-3-encrypt-an-exported-credential-object-on-windows).
