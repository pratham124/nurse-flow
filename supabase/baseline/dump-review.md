# Public schema dump review

Reviewed `public-schema-20260912-215152.sql` on 2026-09-13. This is a successful schema export, not yet a validated development restore. The original dump is unchanged.

## Verified

- Source PostgreSQL 17.6; exporter pg_dump 17.0; dump completion footer present.
- 29 function bodies match the earlier catalog capture after line-ending normalization. The validation function uses a different dollar-quote delimiter in the dump; this is formatting, not a body change.
- 11 tables, 21 public policies, seven triggers, and 11 RLS-enable statements.
- All 65 captured constraint names appear in the dump.
- 27 indexes: 14 explicit CREATE INDEX statements plus 13 primary-key/unique constraint indexes.
- Identity declaration for `manual_assignment_overrides.server_sequence` is present.
- No top-level COPY, INSERT, UPDATE, or DELETE data statements were found after excluding function bodies. SQL inside functions is their definition, not an executed data migration.

These are static comparisons, not proof of runtime equivalence. Full column/constraint/policy/ACL comparison belongs in the destination restore validation.

## Required restore adjustments

1. **Existing public schema.** Line 24 creates `public`, which a fresh Supabase project already supplies. The reviewed restore should retain the destination schema, confirm it has no application objects, and omit the duplicate CREATE SCHEMA statement. Do not drop the schema to work around this.
2. **Managed-role defaults.** The dump contains 12 ALTER DEFAULT PRIVILEGES statements for `supabase_admin`. Do not assume the normal destination `postgres` role can execute these. Preserve the raw export as evidence; compare the managed defaults separately and exclude these statements from the application restore where appropriate.
3. **Exact object access.** Destination defaults can grant privileges when objects are created. Later GRANT statements in a dump do not necessarily remove such extra access. Reconcile the restored objects' effective ACLs with the source, including service-only functions/tables and SELECT-only access to messages/overrides. Do not treat a successful SQL run or matching RLS policies as proof of matching grants. Inspect global and per-schema defaults first.
4. **Ownership.** The export uses --no-owner. Restore application objects as `postgres`, matching captured source ownership; this matters for SECURITY DEFINER behavior. Do not restore them under the future limited Go runtime role.
5. **Cross-schema dependencies.** Confirm `auth.users`, `auth.uid()`, `auth.role()`, `extensions.digest()` (pgcrypto), and the used `realtime.send()` signature in the destination. Supabase supplies managed Auth and Realtime objects; do not reconstruct their internal tables from public-schema SQL.
6. **Realtime additions.** The public-only dump does not contain the captured receive policy on `realtime.messages` or publication membership. Add the scoped receive policy using a qualified `public.can_receive_nurseflow_broadcast(realtime.topic())` call, preserving its broadcast condition. Include `public.active_shifts` and `public.nurse_request_messages` in `supabase_realtime`. Compare destination membership first; never copy the dated Supabase-managed message partitions.
7. **Atomic application.** Once adapted and reviewed for the specific destination, apply with stop-on-error in one transaction where supported, then compare schema/ACLs and test with synthetic users. No destination has been inspected or changed in this review.

## Next step

Inspect the separate development Supabase project's managed dependencies and default privileges using `inspect-restore-target.sql`. Its results determine the final restore script; do not run the raw dump directly. Auth observations and still-unverified settings are recorded in `docs/go-migration/auth-and-restore-preparation.md`.

## References

- [PostgreSQL default privileges: global and per-schema behavior](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html)
- [Supabase hosted role limitations](https://supabase.com/docs/guides/database/postgres/roles-superuser)
