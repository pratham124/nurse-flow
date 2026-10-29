-- Read-only milestone 2 verification. Target nurseflow-go-dev explicitly.
SELECT json_build_object(
  'limited_role', (SELECT NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname='nurseflow_go'),
  'template_rls', (SELECT relrowsecurity FROM pg_class WHERE oid='public.floor_templates'::regclass),
  'go_policies', (SELECT json_agg(p) FROM (
    SELECT policyname, cmd, qual, with_check FROM pg_policies
    WHERE schemaname='public' AND tablename='floor_templates' AND 'nurseflow_go'=ANY(roles)
    ORDER BY policyname
  ) p),
  'template_column_grants', (SELECT json_agg(g) FROM (
    SELECT privilege_type, column_name FROM information_schema.column_privileges
    WHERE table_schema='public' AND table_name='floor_templates' AND grantee='nurseflow_go'
    ORDER BY privilege_type, column_name
  ) g),
  'delete_allowed', has_table_privilege('nurseflow_go','public.floor_templates','DELETE'),
  'profile_write', has_any_column_privilege('nurseflow_go','public.profiles','INSERT,UPDATE')
    OR has_table_privilege('nurseflow_go','public.profiles','DELETE,TRUNCATE,TRIGGER,REFERENCES'),
  'unrelated_table_access', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT IN ('profiles','floor_templates')
      AND (has_table_privilege('nurseflow_go',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege('nurseflow_go',c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))),
  'public_function_execution', (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND has_function_privilege('nurseflow_go',p.oid,'EXECUTE')),
  'retained_client_template_policies', (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND tablename='floor_templates' AND 'authenticated'=ANY(roles)),
  'foreign_keys', (SELECT json_agg(f) FROM (
    SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE contype='f' AND confrelid='public.floor_templates'::regclass ORDER BY conname
  ) f)
) AS template_write_verification;
