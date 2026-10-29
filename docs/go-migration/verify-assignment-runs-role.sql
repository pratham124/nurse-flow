-- Read-only catalog check for migration 20261025120000 (milestone 6). Run as the
-- project administrator, e.g. supabase db query --linked --project-ref <ref> --file <this file>.
SELECT 'policy' AS kind, tablename || '.' || policyname AS name, cmd AS detail
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'optimizer_runs'
UNION ALL
SELECT 'column-grant', table_name || '.' || privilege_type, string_agg(column_name, ',' ORDER BY column_name)
FROM information_schema.column_privileges
WHERE grantee = 'nurseflow_go' AND table_name = 'optimizer_runs'
  AND privilege_type IN ('INSERT', 'SELECT', 'UPDATE')
GROUP BY table_name, privilege_type
UNION ALL
SELECT 'table-priv', 'public.optimizer_runs',
  CASE WHEN has_table_privilege('nurseflow_go', 'public.optimizer_runs', 'DELETE') THEN 'DELETE:YES' ELSE 'DELETE:no' END
  || CASE WHEN has_table_privilege('authenticated', 'public.optimizer_runs', 'SELECT') THEN ' authenticated-select:YES' ELSE ' authenticated-select:no' END
UNION ALL
SELECT 'rls', relname, 'enabled=' || relrowsecurity FROM pg_class WHERE oid = 'public.optimizer_runs'::regclass
UNION ALL
SELECT 'role', rolname, 'super=' || rolsuper || ' bypassrls=' || rolbypassrls FROM pg_roles WHERE rolname = 'nurseflow_go'
ORDER BY 1, 2;
