-- Milestone 3: isolated development only, after the template-write migration.
-- Preserve all existing client policies, triggers, constraints, and RPC grants.
-- No schema or data changes; Go receives only the lifecycle permissions below.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nurseflow_go'
    AND NOT rolsuper AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'Expected limited Go role';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity
        AND c.relname IN ('active_shifts', 'previous_shift_snapshots',
          'manual_assignment_overrides', 'shift_nurse_access', 'shift_nurse_invites')) <> 5 THEN
    RAISE EXCEPTION 'Expected all five lifecycle tables with RLS enabled';
  END IF;
END $$;

GRANT SELECT ON public.active_shifts, public.previous_shift_snapshots,
  public.manual_assignment_overrides TO nurseflow_go;
GRANT INSERT (id, charge_profile_id, floor_template_id, status, shift_snapshot, created_at, updated_at)
  ON public.active_shifts TO nurseflow_go;
GRANT UPDATE (status, shift_snapshot, updated_at, ended_at)
  ON public.active_shifts TO nurseflow_go;
GRANT INSERT (charge_profile_id, floor_template_id, completed_at, nurse_suggestions, patient_suggestions)
  ON public.previous_shift_snapshots TO nurseflow_go;
GRANT DELETE ON public.previous_shift_snapshots TO nurseflow_go;
GRANT UPDATE (status, superseded_at) ON public.manual_assignment_overrides TO nurseflow_go;
-- No access to invite hashes, nurse identity/contact details, or invite issuance.
GRANT SELECT (shift_id, status, updated_at) ON public.shift_nurse_access,
  public.shift_nurse_invites TO nurseflow_go;
GRANT UPDATE (status, updated_at) ON public.shift_nurse_access,
  public.shift_nurse_invites TO nurseflow_go;

CREATE POLICY go_charge_active_shifts_select ON public.active_shifts
  FOR SELECT TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = active_shifts.charge_profile_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ));

CREATE POLICY go_charge_active_shifts_insert ON public.active_shifts
  FOR INSERT TO nurseflow_go
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = active_shifts.charge_profile_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ) AND EXISTS (
    SELECT 1 FROM public.floor_templates t
    WHERE t.id = active_shifts.floor_template_id AND t.owner_profile_id = active_shifts.charge_profile_id
  ));

CREATE POLICY go_charge_active_shifts_update ON public.active_shifts
  FOR UPDATE TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = active_shifts.charge_profile_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = active_shifts.charge_profile_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ));

CREATE POLICY go_charge_previous_shift_snapshots_select ON public.previous_shift_snapshots
  FOR SELECT TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = previous_shift_snapshots.charge_profile_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ));

CREATE POLICY go_charge_previous_shift_snapshots_insert ON public.previous_shift_snapshots
  FOR INSERT TO nurseflow_go
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = previous_shift_snapshots.charge_profile_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ) AND EXISTS (
    SELECT 1 FROM public.floor_templates t
    WHERE t.id = previous_shift_snapshots.floor_template_id AND t.owner_profile_id = previous_shift_snapshots.charge_profile_id
  ));

CREATE POLICY go_charge_previous_shift_snapshots_delete ON public.previous_shift_snapshots
  FOR DELETE TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = previous_shift_snapshots.charge_profile_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ));

CREATE POLICY go_charge_manual_assignment_overrides_select ON public.manual_assignment_overrides
  FOR SELECT TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = manual_assignment_overrides.shift_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ));

CREATE POLICY go_charge_manual_assignment_overrides_update ON public.manual_assignment_overrides
  FOR UPDATE TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = manual_assignment_overrides.shift_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = manual_assignment_overrides.shift_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ));

CREATE POLICY go_charge_shift_nurse_access_select ON public.shift_nurse_access
  FOR SELECT TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = shift_nurse_access.shift_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ));

CREATE POLICY go_charge_shift_nurse_access_update ON public.shift_nurse_access
  FOR UPDATE TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = shift_nurse_access.shift_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = shift_nurse_access.shift_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ));

CREATE POLICY go_charge_shift_nurse_invites_select ON public.shift_nurse_invites
  FOR SELECT TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = shift_nurse_invites.shift_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ));

CREATE POLICY go_charge_shift_nurse_invites_update ON public.shift_nurse_invites
  FOR UPDATE TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = shift_nurse_invites.shift_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = shift_nurse_invites.shift_id
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ));

COMMIT;
