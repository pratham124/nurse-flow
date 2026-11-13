-- A joined nurse can leave the shift they joined.
-- Additive, so it is applied (development, then production) before the Go code
-- that uses it is merged and deployed.
--   Leaving sets the nurse's own linked access row to 'removed', the same state
--   account deletion and a charge nurse's shift edits already use, so the charge
--   nurse can invite someone new to that slot. Until now nurseflow_go could only
--   change an access row through the invite flow or as the shift's charge owner.
--   The existing column grant (status, updated_at) and the restrictive guard
--   (new status must be 'removed' or a valid link) already cover this write;
--   only a permissive policy for "my own linked row" is missing.
-- Rollback: supabase/rollback/20261113090000_drop_joined_nurse_leave.sql.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nurseflow_go'
    AND NOT rolsuper AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'Expected limited Go role';
  END IF;
  IF NOT has_column_privilege('nurseflow_go', 'public.shift_nurse_access', 'status', 'UPDATE')
     OR NOT has_column_privilege('nurseflow_go', 'public.shift_nurse_access', 'updated_at', 'UPDATE') THEN
    RAISE EXCEPTION 'Expected the milestone 3 status/updated_at UPDATE grant';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'shift_nurse_access' AND policyname = 'go_guard_shift_nurse_access_update') THEN
    RAISE EXCEPTION 'Expected the restrictive access update guard';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'shift_nurse_access' AND policyname = 'go_joined_shift_nurse_access_leave') THEN
    RAISE EXCEPTION 'Leave policy already exists; review before re-running';
  END IF;
END $$;

-- The caller may move only their own linked access row to 'removed'. The
-- profile check matches every other go_* policy: the caller comes from the
-- transaction setting Go sets from the verified token (ADR 0001).
CREATE POLICY go_joined_shift_nurse_access_leave ON public.shift_nurse_access
  FOR UPDATE TO nurseflow_go
  USING (
    status = 'linked'
    AND nurse_profile_id = (
      SELECT p.id FROM public.profiles p
      WHERE p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
        AND p.role = 'charge_nurse'
    )
  )
  WITH CHECK (
    status = 'removed'
    AND nurse_profile_id = (
      SELECT p.id FROM public.profiles p
      WHERE p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
        AND p.role = 'charge_nurse'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'shift_nurse_access' AND policyname = 'go_joined_shift_nurse_access_leave'
    AND cmd = 'UPDATE' AND roles = '{nurseflow_go}' AND permissive = 'PERMISSIVE') THEN
    RAISE EXCEPTION 'Leave policy was not created as expected';
  END IF;
END $$;

COMMIT;
