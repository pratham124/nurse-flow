-- Reviewed addition for the isolated development project. No data/table changes.
-- Apply once after the existing baseline. Login/password are provisioned separately.
BEGIN;

-- These five existing functions have explicit anon/authenticated/service_role grants.
-- PUBLIC also grants access to every future database role. Remove only that blanket
-- grant so the Go reader cannot invoke unrelated privileged workflows.
REVOKE EXECUTE ON FUNCTION public.accept_shift_nurse_invite_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_shift_nurse_invite_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_shift_nurse_swap_request(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_joined_nurse_issue_request(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_joined_nurse_swap_request(text, text) FROM PUBLIC;

CREATE ROLE nurseflow_go NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO nurseflow_go;
GRANT SELECT ON public.profiles, public.floor_templates TO nurseflow_go;

CREATE POLICY go_profile_owner_read ON public.profiles
  FOR SELECT TO nurseflow_go
  USING (auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid);

CREATE POLICY go_charge_template_owner_read ON public.floor_templates
  FOR SELECT TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = floor_templates.owner_profile_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ));

-- Fail rather than silently accept inherited public access beyond this read-only role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.profiles'::regclass AND relrowsecurity)
     OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.floor_templates'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'Both mapped tables must already have RLS enabled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND (has_table_privilege('nurseflow_go', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR (c.relname NOT IN ('profiles', 'floor_templates')
          AND has_table_privilege('nurseflow_go', c.oid, 'SELECT')))
  ) THEN
    RAISE EXCEPTION 'Unexpected inherited table privileges; review before enabling Go';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND has_function_privilege('nurseflow_go', p.oid, 'EXECUTE')
  ) OR has_schema_privilege('nurseflow_go', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'Unexpected public function/schema privileges; review before enabling Go';
  END IF;
END $$;

COMMIT;
