-- Read-only catalog check for milestone 4 (20261024120000_go_profiles_invites_access.sql).
-- Safe to run against nurseflow-go-dev; it changes nothing.
SELECT 'policy' AS kind, tablename || '.' || policyname AS name, permissive || ' ' || cmd AS detail
FROM pg_policies
WHERE schemaname = 'public' AND 'nurseflow_go' = ANY (roles)
  AND (policyname LIKE 'go_invite_hash_%' OR policyname LIKE 'go_joined_%' OR policyname LIKE 'go_guard_%'
    OR policyname IN ('go_profile_owner_insert', 'go_charge_shift_nurse_invites_insert'))
UNION ALL
SELECT 'column_grant', table_name || '.' || column_name, string_agg(privilege_type, ',' ORDER BY privilege_type)
FROM information_schema.column_privileges
WHERE grantee = 'nurseflow_go' AND table_schema = 'public'
  AND table_name IN ('profiles', 'shift_nurse_invites', 'shift_nurse_access')
  AND privilege_type IN ('INSERT', 'UPDATE')
GROUP BY table_name, column_name
UNION ALL
SELECT 'helper', p.proname,
  'definer=' || p.prosecdef
  || ' go=' || has_function_privilege('nurseflow_go', p.oid, 'EXECUTE')
  || ' authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
  || ' anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'go_private'
UNION ALL
SELECT 'denied_write', t, (
  has_table_privilege('nurseflow_go', 'public.' || t, 'DELETE')
  OR (t = 'profiles' AND has_table_privilege('nurseflow_go', 'public.profiles', 'UPDATE')))::text
FROM unnest(ARRAY['profiles', 'shift_nurse_invites', 'shift_nurse_access']) AS t
UNION ALL
SELECT 'role', rolname, 'super=' || rolsuper || ' bypassrls=' || rolbypassrls
FROM pg_roles WHERE rolname = 'nurseflow_go'
ORDER BY 1, 2;
