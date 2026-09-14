# Development destination and restore draft

Verified 2026-09-13 through a read-only dashboard catalog query.

- Project: `nurseflow-go-dev`, ref `nmitctyxtjmlakcsmnuj`, East US, healthy.
- PostgreSQL 17.6, current SQL role `postgres`.
- No public tables, sequences, views, or functions; no public/Realtime policies.
- Required Auth tables/functions, pgcrypto digest overloads, and Realtime send/topic functions exist.
- Five installed extensions match the source inventory and versions.
- Six public default ACL entries match the source's postgres and supabase_admin defaults; no global overrides returned.
- `supabase_realtime` exists with no tables. Supabase's managed message publication is not copied or manually created.

`development-target.json` contains the observed metadata and the exact read-only query used.

## Prepared draft

`restore-development.draft.sql` derives from the original pg_dump file. It:

1. Uses a transaction and checks the current role and empty public schema. These checks are safeguards, not proof of project identity; always verify the development project ref before execution.
2. Retains the existing public schema and omits 12 managed supabase_admin default-privilege statements. Destination managed defaults already match the capture.
3. Retains all application function bodies and table definitions from the dump.
4. Reconciles PUBLIC/anon/authenticated/service_role grants on all 41 application objects (29 functions, 11 tables, one sequence) against the captured ACLs. This removes extra privileges inherited from destination creation defaults, then grants the captured rights. Existing PUBLIC execution on five source functions is preserved, not silently redesigned.
5. Adds the scoped Realtime receive policy and two application publication members omitted from the public-only dump.

No database writes were performed. The draft is not yet validated by PostgreSQL. Before applying, verify the development project identity again, confirm the intended permissions/Realtime changes, use stop-on-error, and compare resulting catalog definitions and ACLs before creating synthetic users. Auth settings and app environment configuration are separate pending steps; the app has not been pointed at this project.

Static preparation checks: 29 functions, 11 tables, 41 ACL reconciliation targets; only the duplicate schema statement and 12 managed-role default statements were removed from the source dump. Original source dump preserved.
