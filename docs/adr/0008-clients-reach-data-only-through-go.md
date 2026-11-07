# Clients reach application data only through Go

Accepted on 2026-11-07 for Go migration milestone 7 (ticket 23). After the
production cutover and a week of stable use, the database paths that only the
pre-Go app and the legacy Python route used are removed. Migration
`20261107051656_retire_legacy_client_paths` drops 16 workflow RPCs and 19 client
policies, revokes the client roles' table and sequence privileges, and takes
`active_shifts` and `nurse_request_messages` out of the `supabase_realtime`
publication. The Python service keeps only `/v1/solve`, and the
`/v1/assignment-runs` route that called Postgres with the Supabase secret key is
deleted.

The app's remaining direct Supabase use is deliberate:

- **Auth:** sign-up, sign-in, sign-out, and session refresh.
- **Realtime broadcast:** the private `nurseflow:*` channels, authorized by
  `can_receive_nurseflow_broadcast` and fed by the three broadcast triggers.
- **Deferred notifications (ticket 18):** the device-token RPCs and the
  notification-target read of `shift_nurse_access`. That read keeps `SELECT` on
  `shift_nurse_access` and `profiles` for `authenticated`, plus two owner-scoped
  policies, because the kept policy reads `profiles` as the signed-in user. Both
  paths are off behind `EXPO_PUBLIC_NOTIFICATIONS_ENABLED`. Ticket 18 should move
  them to Go and then remove these grants.

This covers the objects that exist now. Supabase's default privileges in
`public` still grant the client roles rights on new tables and functions, so a
follow-up migration should revoke them (decision 16 in hosted-development.md).

The database keeps every table, all data, RLS on all 11 public tables, the
swap-completion and notification triggers, and every `nurseflow_go` grant and
`go_*` policy.

We dropped the functions instead of revoking execute first and dropping later,
because production's `pg_stat_statements` showed no client calls after the
cutover, no store build exists, and the functions hold no data. A rollback script,
`supabase/rollback/20261107051656_restore_legacy_client_paths.sql`, re-creates
everything from the captured baseline. On development it restored a catalog
identical to the one before the drop, function definition hashes included. We
also deleted the Go integration tests that compared Go with the old RPCs. Go is
now the only implementation, and keeping retired functions alive only as a test
oracle would mean maintaining code we no longer run.

From milestone 8, installed store builds will depend on the Go API, so later
removals need a minimum supported app version. The first store build is that
minimum. This decision follows
[ADR 0005](0005-go-coordinates-assignment-runs.md) and
[ADR 0007](0007-production-cloud-run-promotion-with-approval.md).
