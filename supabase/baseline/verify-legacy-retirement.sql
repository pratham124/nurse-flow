-- Read-only check for ticket 23 (migration 20261107051656_retire_legacy_client_paths).
-- Run before and after the migration. Expected values after it are in the comments;
-- before it, the dropped/policy/grant/publication rows show the legacy state instead.
select jsonb_build_object(
  -- After: [] (the 16 legacy RPCs are gone).
  'legacy_rpcs_present', (select coalesce(jsonb_agg(p.proname order by p.proname), '[]')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in (
       'validate_shift_nurse_invite_code', 'accept_shift_nurse_invite_code',
       'get_joined_nurse_assignment_view', 'confirm_manual_assignment_override',
       'submit_joined_nurse_issue_request', 'submit_joined_nurse_swap_request',
       'update_shift_nurse_issue_status', 'resolve_shift_nurse_swap_request',
       'list_nurse_request_messages', 'append_nurse_request_message',
       'reset_active_shift_for_editing', 'rerun_active_shift_assignment',
       'prepare_optimizer_run', 'finalize_optimizer_run', 'fail_optimizer_run',
       'optimizer_output_validation_error')),
  -- After: all 13 names (Realtime, triggers, deferred device tokens).
  'retained_functions', (select jsonb_agg(p.proname order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'),
  -- After: 7.
  'public_triggers', (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal),
  -- After: 11 of 11.
  'rls_enabled_tables', (select count(*) filter (where c.relrowsecurity) || ' of ' || count(*)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'),
  -- After: the two kept policies only.
  'client_policies', (select jsonb_agg(tablename || ': ' || policyname order by tablename)
     from pg_policies where schemaname = 'public' and not ('nurseflow_go' = any (roles))),
  -- After: 37.
  'go_policies', (select count(*) from pg_policies where schemaname = 'public' and 'nurseflow_go' = any (roles)),
  -- After: authenticated SELECT on profiles and shift_nurse_access only.
  'client_table_grants', (select coalesce(jsonb_agg(grantee || ' ' || privilege_type || ' ' || table_name
       order by table_name, grantee, privilege_type), '[]')
     from information_schema.role_table_grants
     where table_schema = 'public' and grantee in ('anon', 'authenticated')),
  -- After: [].
  'row_change_publication', (select coalesce(jsonb_agg(tablename order by tablename), '[]')
     from pg_publication_tables where pubname = 'supabase_realtime'),
  -- After: true.
  'broadcast_policy', exists (select 1 from pg_policies where schemaname = 'realtime'
     and tablename = 'messages' and policyname = 'NurseFlow users can receive scoped broadcasts'),
  -- Data is untouched: compare these counts before and after.
  'row_counts', jsonb_build_object(
     'profiles', (select count(*) from public.profiles),
     'floor_templates', (select count(*) from public.floor_templates),
     'active_shifts', (select count(*) from public.active_shifts),
     'previous_shift_snapshots', (select count(*) from public.previous_shift_snapshots),
     'shift_nurse_access', (select count(*) from public.shift_nurse_access),
     'nurse_request_messages', (select count(*) from public.nurse_request_messages),
     'optimizer_runs', (select count(*) from public.optimizer_runs))
) as retirement;
