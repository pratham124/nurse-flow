-- Milestone 2. Apply only to nurseflow-go-dev after the read-role migration.
-- Preserve existing authenticated policies, schema, foreign keys, and triggers.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nurseflow_go'
    AND NOT rolsuper AND NOT rolbypassrls)
    OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.floor_templates'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'Expected limited Go role and existing template RLS';
  END IF;
END $$;

GRANT INSERT (owner_profile_id, name, template_snapshot)
  ON public.floor_templates TO nurseflow_go;
GRANT UPDATE (name, template_snapshot, updated_at)
  ON public.floor_templates TO nurseflow_go;
GRANT DELETE ON public.floor_templates TO nurseflow_go;

CREATE POLICY go_charge_template_owner_insert ON public.floor_templates
  FOR INSERT TO nurseflow_go
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = floor_templates.owner_profile_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ));

CREATE POLICY go_charge_template_owner_update ON public.floor_templates
  FOR UPDATE TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = floor_templates.owner_profile_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = floor_templates.owner_profile_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ));

CREATE POLICY go_charge_template_owner_delete ON public.floor_templates
  FOR DELETE TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = floor_templates.owner_profile_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ));

COMMIT;
