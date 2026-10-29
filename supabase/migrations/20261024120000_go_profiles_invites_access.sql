-- Milestone 4: profiles, nurse invites, and joined-nurse access for the Go API.
-- Isolated development only, after the shift-lifecycle migrations. No table or data
-- changes. Existing client policies, triggers, constraints, and RPC grants are kept.
-- Design: docs/go-migration/profiles-invites-access.md and ADR 0003.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nurseflow_go'
    AND NOT rolsuper AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'Expected limited Go role';
  END IF;
  -- The two predicate helpers below must read invite and access rows without
  -- RLS. Their owner (the migration role) therefore has to bypass it.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user
    AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Run this migration as a role that bypasses RLS';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity
        AND c.relname IN ('profiles', 'active_shifts', 'manual_assignment_overrides',
          'shift_nurse_access', 'shift_nurse_invites')) <> 5 THEN
    RAISE EXCEPTION 'Expected all five tables with RLS enabled';
  END IF;
  -- The lifecycle migrations must already be applied; this one extends them.
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
      AND policyname IN ('go_profile_owner_read', 'go_charge_active_shifts_select',
        'go_charge_shift_nurse_access_select', 'go_charge_shift_nurse_invites_select',
        'go_charge_shift_nurse_invites_update', 'go_charge_shift_nurse_access_update',
        'go_charge_manual_assignment_overrides_select')) <> 7 THEN
    RAISE EXCEPTION 'Apply the template and shift-lifecycle migrations first';
  END IF;
  -- Nothing here should exist yet, and Go must not hold hidden extra access.
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'go_private') THEN
    RAISE EXCEPTION 'Schema go_private already exists; review before re-running';
  END IF;
  IF has_table_privilege('nurseflow_go', 'public.profiles', 'INSERT,UPDATE,DELETE')
     OR has_table_privilege('nurseflow_go', 'public.shift_nurse_invites', 'INSERT,DELETE')
     OR has_table_privilege('nurseflow_go', 'public.shift_nurse_access', 'INSERT,DELETE') THEN
    RAISE EXCEPTION 'Unexpected inherited write privileges; review before enabling Go';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND has_function_privilege('nurseflow_go', p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'Unexpected public function privileges; review before enabling Go';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Predicate helpers. Postgres rejects a policy cycle (active_shifts -> invites
-- -> active_shifts), so the two checks that would close a cycle run as
-- SECURITY DEFINER predicates in a schema that is not exposed to clients.
-- Each helper only answers yes/no for one shift and returns no row data.
-- ---------------------------------------------------------------------------
CREATE SCHEMA go_private;
REVOKE ALL ON SCHEMA go_private FROM PUBLIC;
GRANT USAGE ON SCHEMA go_private TO nurseflow_go;

-- True when the presented invite code's hash belongs to an invite for this shift.
CREATE FUNCTION go_private.invite_hash_unlocks_shift(p_shift_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shift_nurse_invites i
    WHERE i.shift_id = p_shift_id
      AND i.token_hash = NULLIF(current_setting('nurseflow.invite_token_hash', true), '')
  );
$$;

-- True when the verified caller's profile has linked nurse access to this shift.
CREATE FUNCTION go_private.caller_has_linked_access(p_shift_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shift_nurse_access a
    JOIN public.profiles p ON p.id = a.nurse_profile_id
    WHERE a.shift_id = p_shift_id
      AND a.status = 'linked'
      AND p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  );
$$;

REVOKE EXECUTE ON FUNCTION go_private.invite_hash_unlocks_shift(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION go_private.caller_has_linked_access(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION go_private.invite_hash_unlocks_shift(uuid), go_private.caller_has_linked_access(uuid)
  FROM anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION go_private.invite_hash_unlocks_shift(uuid) TO nurseflow_go;
GRANT EXECUTE ON FUNCTION go_private.caller_has_linked_access(uuid) TO nurseflow_go;

-- ---------------------------------------------------------------------------
-- Column-limited grants. FOR UPDATE row locks need UPDATE privilege as well.
-- ---------------------------------------------------------------------------
-- Profiles: Go creates only the caller's own charge-nurse profile.
GRANT INSERT (auth_user_id, display_name, role) ON public.profiles TO nurseflow_go;

-- Invites: every column is readable (token_hash only to match a presented hash;
-- the API never returns it). Charge nurses create invites and revoke them.
GRANT SELECT (id, shift_id, nurse_id, created_by_profile_id, token_hash, status,
  created_at, expires_at, used_at, used_by_profile_id, revoked_at, updated_at)
  ON public.shift_nurse_invites TO nurseflow_go;
GRANT INSERT (shift_id, nurse_id, created_by_profile_id, token_hash, status, expires_at)
  ON public.shift_nurse_invites TO nurseflow_go;
GRANT UPDATE (revoked_at, used_at, used_by_profile_id) ON public.shift_nurse_invites TO nurseflow_go;

-- Access: every column is readable; joining inserts or relinks a slot's row.
GRANT SELECT (id, shift_id, nurse_id, nurse_name, nurse_profile_id, nurse_email,
  status, created_at, updated_at) ON public.shift_nurse_access TO nurseflow_go;
GRANT INSERT (shift_id, nurse_id, nurse_name, nurse_profile_id, nurse_email, status, updated_at)
  ON public.shift_nurse_access TO nurseflow_go;
GRANT UPDATE (nurse_name, nurse_profile_id, nurse_email) ON public.shift_nurse_access TO nurseflow_go;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
CREATE POLICY go_profile_owner_insert ON public.profiles
  FOR INSERT TO nurseflow_go
  WITH CHECK (
    auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
    AND role = 'charge_nurse'
  );

-- ---------------------------------------------------------------------------
-- Charge nurse: create invites for an owned, unended shift's own nurses
-- ---------------------------------------------------------------------------
CREATE POLICY go_charge_shift_nurse_invites_insert ON public.shift_nurse_invites
  FOR INSERT TO nurseflow_go
  WITH CHECK (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.active_shifts s
      JOIN public.profiles p ON p.id = s.charge_profile_id
      WHERE s.id = shift_nurse_invites.shift_id
        AND s.ended_at IS NULL
        AND p.id = shift_nurse_invites.created_by_profile_id
        AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
        AND p.role = 'charge_nurse'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(s.shift_snapshot -> 'nurses', '[]'::jsonb)) nurse(value)
          WHERE nurse.value ->> 'id' = shift_nurse_invites.nurse_id
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Invite-code capability (ADR 0003): the presented code's hash, set by Go as
-- the transaction-local nurseflow.invite_token_hash, unlocks only its own rows.
-- ---------------------------------------------------------------------------
CREATE POLICY go_invite_hash_invites_select ON public.shift_nurse_invites
  FOR SELECT TO nurseflow_go
  USING (token_hash = NULLIF((SELECT current_setting('nurseflow.invite_token_hash', true)), ''));

-- Marking the invite used. USING also lets accept lock a revoked or used invite
-- (SELECT ... FOR UPDATE) so it can report why the code was refused.
CREATE POLICY go_invite_hash_invites_update ON public.shift_nurse_invites
  FOR UPDATE TO nurseflow_go
  USING (token_hash = NULLIF((SELECT current_setting('nurseflow.invite_token_hash', true)), ''))
  WITH CHECK (
    token_hash = NULLIF((SELECT current_setting('nurseflow.invite_token_hash', true)), '')
    AND status = 'used'
    AND used_by_profile_id = (
      SELECT p.id FROM public.profiles p
      WHERE p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
        AND p.role = 'charge_nurse'
    )
  );

CREATE POLICY go_invite_hash_active_shifts_select ON public.active_shifts
  FOR SELECT TO nurseflow_go
  USING (go_private.invite_hash_unlocks_shift(id));

-- Existing access rows for the invite's own nurse slot (to detect an earlier join).
CREATE POLICY go_invite_hash_shift_nurse_access_select ON public.shift_nurse_access
  FOR SELECT TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.shift_nurse_invites i
    WHERE i.shift_id = shift_nurse_access.shift_id
      AND i.nurse_id = shift_nurse_access.nurse_id
      AND i.token_hash = NULLIF((SELECT current_setting('nurseflow.invite_token_hash', true)), '')
  ));

-- Linking the slot to the caller's own profile, only while the invite is usable.
CREATE POLICY go_invite_hash_shift_nurse_access_insert ON public.shift_nurse_access
  FOR INSERT TO nurseflow_go
  WITH CHECK (
    status = 'linked'
    AND nurse_email IS NULL
    AND nurse_profile_id = (
      SELECT p.id FROM public.profiles p
      WHERE p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
        AND p.role = 'charge_nurse'
    )
    AND EXISTS (
      SELECT 1 FROM public.shift_nurse_invites i
      WHERE i.shift_id = shift_nurse_access.shift_id
        AND i.nurse_id = shift_nurse_access.nurse_id
        AND i.token_hash = NULLIF((SELECT current_setting('nurseflow.invite_token_hash', true)), '')
        AND i.status = 'active'
        AND i.expires_at > now()
    )
  );

CREATE POLICY go_invite_hash_shift_nurse_access_update ON public.shift_nurse_access
  FOR UPDATE TO nurseflow_go
  USING (
    (
      status IN ('pending_link', 'removed')
      OR (
        status = 'linked'
        AND nurse_profile_id = (
          SELECT p.id FROM public.profiles p
          WHERE p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
            AND p.role = 'charge_nurse'
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.shift_nurse_invites i
      WHERE i.shift_id = shift_nurse_access.shift_id
        AND i.nurse_id = shift_nurse_access.nurse_id
        AND i.token_hash = NULLIF((SELECT current_setting('nurseflow.invite_token_hash', true)), '')
    )
  )
  WITH CHECK (
    status = 'linked'
    AND nurse_email IS NULL
    AND nurse_profile_id = (
      SELECT p.id FROM public.profiles p
      WHERE p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
        AND p.role = 'charge_nurse'
    )
    AND EXISTS (
      SELECT 1 FROM public.shift_nurse_invites i
      WHERE i.shift_id = shift_nurse_access.shift_id
        AND i.nurse_id = shift_nurse_access.nurse_id
        AND i.token_hash = NULLIF((SELECT current_setting('nurseflow.invite_token_hash', true)), '')
        AND i.status = 'active'
        AND i.expires_at > now()
    )
  );

-- ---------------------------------------------------------------------------
-- Joined nurse: read own access rows, and the shift and moves they are linked to
-- ---------------------------------------------------------------------------
CREATE POLICY go_joined_shift_nurse_access_select ON public.shift_nurse_access
  FOR SELECT TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = shift_nurse_access.nurse_profile_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ));

CREATE POLICY go_joined_active_shifts_select ON public.active_shifts
  FOR SELECT TO nurseflow_go
  USING (go_private.caller_has_linked_access(id));

CREATE POLICY go_joined_manual_assignment_overrides_select ON public.manual_assignment_overrides
  FOR SELECT TO nurseflow_go
  USING (go_private.caller_has_linked_access(shift_id));

-- ---------------------------------------------------------------------------
-- Restrictive guards. The new UPDATE column grants also apply under milestone 3's
-- ownership-only UPDATE policies, so a charge owner could otherwise point an
-- access row or a used invite at any profile. Restrictive policies are ANDed
-- with every permissive policy. Milestone 3 only ever sets access to 'removed'
-- and invites to 'expired'; this milestone revokes and uses invites and links access.
-- ---------------------------------------------------------------------------
CREATE POLICY go_guard_shift_nurse_access_update ON public.shift_nurse_access
  AS RESTRICTIVE FOR UPDATE TO nurseflow_go
  USING (true)
  WITH CHECK (
    status = 'removed'
    OR (
      status = 'linked'
      AND nurse_email IS NULL
      AND nurse_profile_id = (
        SELECT p.id FROM public.profiles p
        WHERE p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
          AND p.role = 'charge_nurse'
      )
    )
  );

CREATE POLICY go_guard_shift_nurse_invites_update ON public.shift_nurse_invites
  AS RESTRICTIVE FOR UPDATE TO nurseflow_go
  USING (true)
  WITH CHECK (
    status IN ('revoked', 'expired')
    OR (
      status = 'used'
      AND used_by_profile_id = (
        SELECT p.id FROM public.profiles p
        WHERE p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
          AND p.role = 'charge_nurse'
      )
    )
  );

-- Fail rather than leave Go with more than this milestone intends.
DO $$
BEGIN
  IF has_table_privilege('nurseflow_go', 'public.profiles', 'UPDATE,DELETE')
     OR has_table_privilege('nurseflow_go', 'public.shift_nurse_invites', 'DELETE')
     OR has_table_privilege('nurseflow_go', 'public.shift_nurse_access', 'DELETE')
     OR has_column_privilege('nurseflow_go', 'public.profiles', 'role', 'UPDATE')
     OR has_column_privilege('nurseflow_go', 'public.shift_nurse_invites', 'token_hash', 'UPDATE')
     OR has_column_privilege('nurseflow_go', 'public.shift_nurse_invites', 'shift_id', 'UPDATE')
     OR has_column_privilege('nurseflow_go', 'public.shift_nurse_access', 'shift_id', 'UPDATE') THEN
    RAISE EXCEPTION 'nurseflow_go holds an unexpected write privilege';
  END IF;
  IF has_function_privilege('authenticated', 'go_private.caller_has_linked_access(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'go_private.invite_hash_unlocks_shift(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client roles must not execute the Go predicate helpers';
  END IF;
END $$;

COMMIT;
