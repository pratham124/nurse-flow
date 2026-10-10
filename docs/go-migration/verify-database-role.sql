-- Read-only checks before recording the already-applied Go-role migration.
-- Run against nurseflow-go-dev only. Login is enabled separately by the user.
WITH role_checks AS (
SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole,
       rolreplication, rolbypassrls,
       has_schema_privilege(rolname, 'public', 'USAGE') AS schema_usage,
       has_schema_privilege(rolname, 'public', 'CREATE') AS schema_create,
       has_table_privilege(rolname, 'public.profiles', 'SELECT') AS profile_read,
       has_table_privilege(rolname, 'public.floor_templates', 'SELECT') AS template_read,
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
          AND (has_table_privilege(rolname, c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            OR (c.relname NOT IN ('profiles', 'floor_templates')
              AND has_table_privilege(rolname, c.oid, 'SELECT')))) AS unexpected_table_grants,
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND has_function_privilege(rolname, p.oid, 'EXECUTE')) AS executable_public_functions
FROM pg_roles WHERE rolname = 'nurseflow_go'
), rls_checks AS (

SELECT relname, relrowsecurity
FROM pg_class WHERE oid IN ('public.profiles'::regclass, 'public.floor_templates'::regclass)
), policy_checks AS (

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE policyname IN ('go_profile_owner_read', 'go_charge_template_owner_read')
ORDER BY policyname
), function_checks AS (

SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
       EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
               WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS public_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
    'accept_shift_nurse_invite_code', 'validate_shift_nurse_invite_code',
    'resolve_shift_nurse_swap_request', 'submit_joined_nurse_issue_request',
    'submit_joined_nurse_swap_request')
ORDER BY p.proname
)
SELECT jsonb_build_object(
    'role', (SELECT jsonb_agg(r) FROM role_checks r),
    'rls', (SELECT jsonb_agg(r) FROM rls_checks r),
    'policies', (SELECT jsonb_agg(r) FROM policy_checks r),
    'functions', (SELECT jsonb_agg(r) FROM function_checks r)
) AS verification;
