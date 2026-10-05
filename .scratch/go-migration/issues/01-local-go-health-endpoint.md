# 01: Run the local Go health endpoint

**What to build:** A developer can start the local Go API with explicit server configuration and request a successful health response without a database connection. This covers ordered migration task 5.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Use the agreed Go standard-library HTTP server and a documented health route and response.
- [x] Server configuration supports local development, and startup failures produce clear errors without exposing secrets.
- [x] The health response reports liveness without depending on Postgres availability.
- [x] A small meaningful handler test verifies the health response.
- [x] Relevant Go checks pass, and the documented manual request succeeds.
- [x] Explain the implementation and verification results, and mark ordered task 5 complete when its criteria pass.

## Verification — 2026-10-04

`go test ./...` and `go vet ./...` passed. A real HTTP request returned 200 with JSON content type and the expected status body. Starting a second server on the occupied address returned a clear error and a nonzero exit. The test server was stopped. Run instructions, configuration, and Go concept explanations are documented in the backend guide.

## Implementation guidance

Preserve the approved migration scope and learning workflow. Before implementation, explain the design and use grill-with-docs to settle only unresolved decisions. No mandatory understanding quiz is required.
