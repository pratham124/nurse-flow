-- Ticket 25: in-app account deletion (milestone 8, decision 6; ADR 0009).
-- Additive, so it is applied before the Go code that calls it.
--   1. The three ON DELETE RESTRICT references to profiles become CASCADE, so
--      deleting a profile also removes the messages, manual moves, and assignment
--      runs that person created. Before, any one of them blocked the deletion.
--   2. go_private.delete_current_account() deletes the signed-in user's Supabase
--      Auth user. Deleting from auth.users cascades to profiles and then to
--      everything that person owns. It takes no arguments: the user comes from
--      the same transaction setting Go sets from the verified token for every
--      go_* policy (ADR 0001), so it can never delete anyone else. Only
--      nurseflow_go may call it; Go never holds Supabase's admin key.
-- Rollback: supabase/rollback/20261107212029_restore_before_account_deletion.sql.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nurseflow_go'
    AND NOT rolsuper AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'Expected limited Go role';
  END IF;
  IF to_regnamespace('go_private') IS NULL THEN
    RAISE EXCEPTION 'Expected the go_private schema (milestone 4 migration)';
  END IF;
  IF to_regprocedure('go_private.delete_current_account()') IS NOT NULL THEN
    RAISE EXCEPTION 'delete_current_account already exists; review before re-running';
  END IF;
  -- The constraints this migration replaces must still be RESTRICT.
  IF (SELECT count(*) FROM pg_constraint
      WHERE contype = 'f' AND confdeltype = 'r' AND conname IN (
        'nurse_request_messages_author_profile_id_fkey',
        'manual_assignment_overrides_created_by_profile_id_fkey',
        'optimizer_runs_requested_by_profile_id_fkey')) <> 3 THEN
    RAISE EXCEPTION 'Expected the three RESTRICT foreign keys to profiles';
  END IF;
  IF NOT has_table_privilege('postgres', 'auth.users', 'DELETE') THEN
    RAISE EXCEPTION 'postgres must be able to delete from auth.users';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Delete rules. Same columns and names; only ON DELETE changes.
-- ---------------------------------------------------------------------------
ALTER TABLE public.nurse_request_messages
  DROP CONSTRAINT nurse_request_messages_author_profile_id_fkey,
  ADD CONSTRAINT nurse_request_messages_author_profile_id_fkey
    FOREIGN KEY (author_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.manual_assignment_overrides
  DROP CONSTRAINT manual_assignment_overrides_created_by_profile_id_fkey,
  ADD CONSTRAINT manual_assignment_overrides_created_by_profile_id_fkey
    FOREIGN KEY (created_by_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.optimizer_runs
  DROP CONSTRAINT optimizer_runs_requested_by_profile_id_fkey,
  ADD CONSTRAINT optimizer_runs_requested_by_profile_id_fkey
    FOREIGN KEY (requested_by_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. The deletion function.
-- ---------------------------------------------------------------------------
CREATE FUNCTION go_private.delete_current_account()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid;
  deleted_count integer;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'No verified identity for this transaction' USING ERRCODE = '42501';
  END IF;

  -- Deletes send no Realtime broadcasts, so first make the same updates the app
  -- already reacts to. Ending the caller's open shifts tells every joined nurse
  -- live (broadcast_nurseflow_active_shift_change), as End Shift does.
  UPDATE public.active_shifts AS shift
  SET ended_at = now(), updated_at = now()
  FROM public.profiles AS profile
  WHERE profile.id = shift.charge_profile_id
    AND profile.auth_user_id = caller
    AND shift.ended_at IS NULL;

  -- The caller's slots on other charges' shifts become "removed", as when a
  -- charge edits an active shift, so those charges can invite someone new. The
  -- access row itself stays; the profile delete below unlinks it (SET NULL).
  UPDATE public.shift_nurse_access AS access
  SET status = 'removed', updated_at = now()
  FROM public.profiles AS profile
  WHERE profile.id = access.nurse_profile_id
    AND profile.auth_user_id = caller
    AND access.status IN ('pending_link', 'linked');

  -- Cascades: auth sessions and identities, then profiles, then templates,
  -- shifts, snapshots, invites, runs, moves, messages, and device tokens.
  DELETE FROM auth.users WHERE id = caller;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count = 1;
END;
$$;

ALTER FUNCTION go_private.delete_current_account() OWNER TO postgres;
REVOKE ALL ON FUNCTION go_private.delete_current_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION go_private.delete_current_account() FROM anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION go_private.delete_current_account() TO nurseflow_go;

-- ---------------------------------------------------------------------------
-- Postflight.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_constraint
      WHERE contype = 'f' AND confrelid = 'public.profiles'::regclass AND confdeltype = 'r') <> 0 THEN
    RAISE EXCEPTION 'A RESTRICT reference to profiles remains';
  END IF;
  IF NOT has_function_privilege('nurseflow_go', 'go_private.delete_current_account()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'go_private.delete_current_account()', 'EXECUTE')
     OR has_function_privilege('anon', 'go_private.delete_current_account()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected execute privileges on delete_current_account';
  END IF;
END $$;

COMMIT;
