# Captured Supabase schema

Read-only catalog capture from NurseFlow project `mkljczezkyqtuplzedpj`, production, on 2026-09-12 in America/Vancouver (catalog timestamp: 2026-09-13 04:20:22 UTC). PostgreSQL reports version 17.6.

The original capture remains a review reference. The adapted restore has now been applied to the isolated development project and its schema compared with the source; see [development verification](development-verification/README.md). End-to-end app validation remains pending. No application records, Auth users, credential values, or sequence counters were exported.

## Files

- `functions.json`: all 29 public function definitions, identity arguments, owners, ACLs, and per-function settings.
- `functions.sql`: the same definitions formatted as readable SQL for review. It omits grants/ownership and dependency ordering; do not use it alone to initialize a database.
- `catalog.json`: table/column metadata, constraints, indexes, RLS policies, triggers, permissions, extensions, sequences, and publication metadata.
- `capture-functions.sql` and `capture-catalog.sql`: repeatable catalog queries. Both use `BEGIN READ ONLY`; they inspect definitions without invoking the captured application functions.
- `manifest.json`: file hashes and observed object counts for checking capture integrity.

To repeat the capture, run each capture query in the source project's SQL Editor and choose Results → Export → Copy as JSON. Save each result separately. Queries ran separately, so these files are not one atomic database snapshot. Repeat during a period without schema changes before finalizing the restore baseline.

## Captured inventory

| Object | Count |
| --- | ---: |
| Public tables | 11 |
| Public columns | 108 |
| Public constraints | 65 |
| Public indexes | 27 |
| Public functions | 29 |
| Application triggers | 7 |
| Public RLS policies | 21 |
| Realtime RLS policies | 1 |
| Public sequences | 1 |
| Extensions | 5 |
| Publications | 2 |

The catalog's `tables` section contains 12 relations: 11 tables and one sequence. All 11 public tables have RLS enabled. All seven captured triggers are enabled in normal origin sessions (`O`). No public enum/domain types or views were returned.

Use the individual identifiers inside `metadata` when reviewing objects. Some composite `name` labels were truncated by PostgreSQL's `name` concatenation; the underlying table, constraint, policy, trigger, and publication table identifiers remain intact in `metadata`.

## Migration details revealed by the capture

- `profiles.auth_user_id` references `auth.users.id` with `ON DELETE CASCADE`. Application profile IDs remain separate from Auth IDs.
- Two notification triggers on `active_shifts` run `AFTER UPDATE OF shift_snapshot` only when the old and new snapshots differ.
- The swap completion trigger runs only when `related_swap_request_id` is non-null.
- `manual_assignment_overrides_one_active_bed` is a unique partial index for rows whose status is `active`.
- `realtime.messages` has a scoped broadcast receive policy calling `can_receive_nurseflow_broadcast(realtime.topic())`.
- The application publication includes `public.active_shifts` and `public.nurse_request_messages`. The other publication is managed by Supabase and reports six dated Realtime partitions; do not recreate these dated partitions as application schema.
- Object ACLs, schema ACLs, and default privileges are preserved as metadata. Existing access must be reviewed before defining the Go connection role.

## Remaining work before development restore

1. Obtain a conventional schema-only dump through a database connection, or explicitly review a reconstruction of these catalogs. `pg_dump` 17 is installed locally, but no database password/connection is configured for it. The app's Supabase API key is not a Postgres connection password.
2. Review dependency ordering, ownership, grants, identity sequence ownership, and any custom objects/dependencies outside the captured schemas. The capture is scoped; it does not claim to cover every PostgreSQL object class or role membership.
3. Record Auth/project settings separately: sign-in providers, email confirmation, redirect/site URLs, signing configuration, API schema exposure, Realtime settings, and relevant service configuration. These are not all represented by SQL schema. Dashboard Auth settings were not captured in this step.
4. Restore into the isolated development Supabase project, compare schema and permissions, and verify the existing app using synthetic data. Keep the full baseline task pending until this is complete.

## Capture checks

The two successful dashboard exports returned 29 function rows and 269 structural metadata rows. Both files parse as JSON. Function definitions have complete CREATE statements; counts match the previously inspected 11 tables, 27 indexes, and seven triggers. A targeted credential-pattern scan found no matches; no application data query was executed. App tests were not run because this step changes only schema reference files and documentation.

## References

- [PostgreSQL catalog definition functions](https://www.postgresql.org/docs/17/functions-info.html)
- [Supabase database backup guidance](https://supabase.com/docs/guides/platform/backups)


## Restore status update (2026-09-13)

The user produced the conventional dump, and the adapted script was applied to `nurseflow-go-dev`. Earlier remaining-work notes describe the original capture stage; the authoritative execution record is `development-verification/result.json`. Auth settings and app behavior checks remain unfinished.
