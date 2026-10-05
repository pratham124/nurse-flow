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

All code currently uses the Go standard library. The handlers and server remain in one executable package for this small first increment.

## Checks

Run from `backend`:

```powershell
go test ./...
go vet ./...
```

The handler tests use `httptest` to simulate requests and record responses. They check the successful status, JSON content type/body, unsupported method, and unknown route.

References: [Go HTTP server and routing documentation](https://pkg.go.dev/net/http), [Go HTTP testing documentation](https://pkg.go.dev/net/http/httptest).
