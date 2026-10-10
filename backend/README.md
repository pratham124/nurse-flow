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

Use the configured port in the health request. The Go process reads the environment directly; it does not load the Expo `.env` file. Physical-device access will be configured when Expo integration is implemented.

The server allows five seconds to read request headers, ten seconds to read a request or write a response, and sixty seconds for an idle connection. These explicit limits keep connections from waiting indefinitely.

## How the code fits together

- `main` starts the program and exits with status 1 if `run` returns an error.
- `run` reads the address, creates an `http.Server` struct, and calls `ListenAndServe`, which waits for and serves requests.
- `newHandler` creates a `ServeMux`, Go's HTTP router, and registers the health handler.
- `healthHandler` receives a response writer and a pointer to the incoming request. It sets the response header before writing JSON. Writing without an explicit status sends HTTP 200.
- `:=` declares a variable and infers its type. `&http.Server{...}` creates a server struct and gives us a pointer to it. `if err := ...; err != nil` checks an operation's returned error explicitly. `%w` wraps an error with context while preserving the underlying error.

The server uses the Go standard library for HTTP. Authentication middleware and token verification live in `internal/auth`; the shared JSON response helpers live in `internal/httpresponse`. Database queries use GORM.

## Checks

Run from `backend`:

```powershell
go test ./...
go vet ./...
```

The handler tests use `httptest` to simulate requests and record responses. They check the successful status, JSON content type/body, unsupported method, and unknown route.

References: [Go HTTP server and routing documentation](https://pkg.go.dev/net/http), [Go HTTP testing documentation](https://pkg.go.dev/net/http/httptest).

## Development database

The database package and `go run ./cmd/dbcheck` are implemented separately from the health server. See [development database setup and verification](../docs/go-migration/database-connection.md) for the role migration, private environment variables, Go concepts, and completed local/live checks.

## Authentication

`GET /auth/check` requires a current development Supabase access token in the `Authorization: Bearer <token>` header and returns its verified Auth user ID. It verifies ES256 signatures using public discovery keys, expected issuer/audience, and expiry. It checks identity only; a regular nurse can authenticate too. Profile/charge-nurse authorization is the next ordered task.

Missing or invalid tokens return controlled JSON 401 errors. Required-key retrieval failures return JSON 503 errors. No database credentials, signing secrets, or API keys are needed to run the API for this task. The public `/health` endpoint does not depend on authentication availability. See [authentication design, errors, tests, and private manual requests](../docs/go-migration/api-authentication.md).

Public-key discovery, caching, and background refresh use `jwkset`. Startup attempts discovery for up to five seconds and can start even if retrieval fails. The server supplies a cancellation context to stop background refresh when `run` exits.
