-- Read-only catalog review for nurseflow-go-dev after migration 20261018160805.
-- Run as development administrator; no credentials or application data returned.
SELECT rolname, rolsuper, rolinherit, rolbypassrls
FROM pg_roles WHERE rolname = 'nurseflow_go';

SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN (
  'active_shifts', 'previous_shift_snapshots', 'manual_assignment_overrides',
  'shift_nurse_access', 'shift_nurse_invites'
) ORDER BY c.relname;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public'
  AND 'nurseflow_go' = ANY(roles)
ORDER BY tablename, policyname;

SELECT table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND grantee = 'nurseflow_go'
ORDER BY table_name, column_name, privilege_type;

SELECT count(*) AS unexpected_public_function_execution
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND has_function_privilege('nurseflow_go', p.oid, 'EXECUTE');

SELECT has_table_privilege('nurseflow_go', 'public.active_shifts', 'DELETE') AS can_delete_shift,
  has_column_privilege('nurseflow_go', 'public.active_shifts', 'charge_profile_id', 'UPDATE') AS can_change_owner,
  has_column_privilege('nurseflow_go', 'public.shift_nurse_invites', 'token_hash', 'SELECT') AS can_read_invite_hash,
  has_column_privilege('nurseflow_go', 'public.shift_nurse_access', 'nurse_email', 'SELECT') AS can_read_nurse_email;

SELECT c.relname AS table_name, t.tgname, pg_get_triggerdef(t.oid)
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;
