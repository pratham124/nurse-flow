# Go coordinates assignment runs; Python is a stateless solver

Accepted on 2026-10-25 for Go migration milestone 6. Today Expo calls the Python
service, which verifies the user's token and calls `prepare_optimizer_run` as the
user. Python then solves the assignment and calls `finalize_optimizer_run` or
`fail_optimizer_run` with the Supabase secret key. On the migration branch, Expo
calls Go instead. Go does prepare, finalize, and fail in its own short transactions
under the caller's verified identity, with owner policies on `optimizer_runs`.
Python gets a solver-only `POST /v1/solve` that takes a shift snapshot and returns
the result. Go authenticates to it with a shared secret bearer token.

We rejected a thin Go proxy in front of the unchanged Python endpoint, and Go
calling the existing RPCs. Both would leave the run workflow in PL/pgSQL, which
this migration exists to retire. Finalizing under the caller's identity instead
of a privileged key keeps ADR 0001's database ownership checks. It also removes
the Supabase secret key from the solver path. A Cloud Run IAM identity token was
deferred because it ties the boundary to a host before milestone 7 picks one.

The change is additive. The legacy Python route and RPCs keep serving the
production app until the cutover in ticket 23. Until then, the run rules
(precondition checks, the recovery lease, output validation) exist in both Go and
SQL.
