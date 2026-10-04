# 01: Run the local Go health endpoint

**What to build:** A developer can start the local Go API with explicit server configuration and request a successful health response without a database connection. This covers ordered migration task 5.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Use the agreed Go standard-library HTTP server and a documented health route and response.
- [ ] Server configuration supports local development, and startup failures produce clear errors without exposing secrets.
- [ ] The health response reports liveness without depending on Postgres availability.
- [ ] A small meaningful handler test verifies the health response.
- [ ] Relevant Go checks pass, and the documented manual request succeeds.
- [ ] Explain the implementation and verification results, and mark ordered task 5 complete when its criteria pass.

## Implementation guidance

Preserve the approved migration scope and learning workflow. Before implementation, explain the design and use grill-with-docs to settle only unresolved decisions. No mandatory understanding quiz is required.
