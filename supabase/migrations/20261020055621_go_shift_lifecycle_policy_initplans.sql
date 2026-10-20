-- Evaluate the verified transaction identity once per statement in lifecycle RLS.
-- Preserve all existing roles, grants, ownership predicates, and WITH CHECK rules.
BEGIN;
ALTER POLICY go_charge_active_shifts_select ON public.active_shifts
  TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = active_shifts.charge_profile_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ));

ALTER POLICY go_charge_active_shifts_insert ON public.active_shifts
  TO nurseflow_go
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = active_shifts.charge_profile_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ) AND EXISTS (
    SELECT 1 FROM public.floor_templates t
    WHERE t.id = active_shifts.floor_template_id AND t.owner_profile_id = active_shifts.charge_profile_id
  ));

ALTER POLICY go_charge_active_shifts_update ON public.active_shifts
  TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = active_shifts.charge_profile_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = active_shifts.charge_profile_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ));

ALTER POLICY go_charge_previous_shift_snapshots_select ON public.previous_shift_snapshots
  TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = previous_shift_snapshots.charge_profile_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ));

ALTER POLICY go_charge_previous_shift_snapshots_insert ON public.previous_shift_snapshots
  TO nurseflow_go
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = previous_shift_snapshots.charge_profile_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ) AND EXISTS (
    SELECT 1 FROM public.floor_templates t
    WHERE t.id = previous_shift_snapshots.floor_template_id AND t.owner_profile_id = previous_shift_snapshots.charge_profile_id
  ));

ALTER POLICY go_charge_previous_shift_snapshots_delete ON public.previous_shift_snapshots
  TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = previous_shift_snapshots.charge_profile_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ));

ALTER POLICY go_charge_manual_assignment_overrides_select ON public.manual_assignment_overrides
  TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = manual_assignment_overrides.shift_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ));

ALTER POLICY go_charge_manual_assignment_overrides_update ON public.manual_assignment_overrides
  TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = manual_assignment_overrides.shift_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = manual_assignment_overrides.shift_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ));

ALTER POLICY go_charge_shift_nurse_access_select ON public.shift_nurse_access
  TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = shift_nurse_access.shift_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ));

ALTER POLICY go_charge_shift_nurse_access_update ON public.shift_nurse_access
  TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = shift_nurse_access.shift_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = shift_nurse_access.shift_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ));

ALTER POLICY go_charge_shift_nurse_invites_select ON public.shift_nurse_invites
  TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = shift_nurse_invites.shift_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ));

ALTER POLICY go_charge_shift_nurse_invites_update ON public.shift_nurse_invites
  TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = shift_nurse_invites.shift_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = shift_nurse_invites.shift_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ));

COMMIT;
