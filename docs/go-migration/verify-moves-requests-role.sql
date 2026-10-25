-- Read-only catalog check for migration 20261024180000 (milestone 5). Run as the
-- project administrator, e.g. supabase db query --linked --project-ref <ref> --file <this file>.
SELECT 'policy' AS kind, tablename || '.' || policyname AS name, cmd AS detail
FROM pg_policies WHERE schemaname = 'public' AND policyname IN (
  'go_charge_manual_assignment_overrides_insert', 'go_joined_active_shifts_update',
  'go_thread_nurse_request_messages_select', 'go_thread_nurse_request_messages_insert')
UNION ALL
SELECT 'function', 'go_private.caller_is_thread_actor',
  CASE WHEN has_function_privilege('nurseflow_go', 'go_private.caller_is_thread_actor(uuid,text)', 'EXECUTE') THEN 'go:yes' ELSE 'go:no' END
  || CASE WHEN has_function_privilege('authenticated', 'go_private.caller_is_thread_actor(uuid,text)', 'EXECUTE') THEN ' authenticated:YES' ELSE ' authenticated:no' END
UNION ALL
SELECT 'column-grant', table_name || '.' || privilege_type, string_agg(column_name, ',' ORDER BY column_name)
FROM information_schema.column_privileges
WHERE grantee = 'nurseflow_go' AND table_name IN ('manual_assignment_overrides', 'nurse_request_messages')
  AND privilege_type IN ('INSERT', 'SELECT', 'UPDATE')
GROUP BY table_name, privilege_type
UNION ALL
SELECT 'table-priv', t, CASE WHEN has_table_privilege('nurseflow_go', t, 'DELETE') THEN 'DELETE:YES' ELSE 'DELETE:no' END
FROM unnest(ARRAY['public.manual_assignment_overrides', 'public.nurse_request_messages']) t
UNION ALL
SELECT 'role', rolname, 'super=' || rolsuper || ' bypassrls=' || rolbypassrls FROM pg_roles WHERE rolname = 'nurseflow_go'
ORDER BY 1, 2;
