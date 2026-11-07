-- Read-only check for migration 20261107212029_account_deletion.
-- After it: restrict_fks_to_profiles = 0; the three keys are CASCADE ("c");
-- function_exists = true; only nurseflow_go may execute it.
select jsonb_build_object(
  'restrict_fks_to_profiles', (select count(*) from pg_constraint
     where contype = 'f' and confrelid = 'public.profiles'::regclass and confdeltype = 'r'),
  'changed_fks', (select jsonb_object_agg(conname, confdeltype::text) from pg_constraint where conname in (
     'nurse_request_messages_author_profile_id_fkey',
     'manual_assignment_overrides_created_by_profile_id_fkey',
     'optimizer_runs_requested_by_profile_id_fkey')),
  'function_exists', to_regprocedure('go_private.delete_current_account()') is not null,
  'function_execute', case when to_regprocedure('go_private.delete_current_account()') is null then null else jsonb_build_object(
     'nurseflow_go', has_function_privilege('nurseflow_go', 'go_private.delete_current_account()', 'EXECUTE'),
     'authenticated', has_function_privilege('authenticated', 'go_private.delete_current_account()', 'EXECUTE'),
     'anon', has_function_privilege('anon', 'go_private.delete_current_account()', 'EXECUTE')) end,
  'profiles', (select count(*) from public.profiles)
) as account_deletion;
