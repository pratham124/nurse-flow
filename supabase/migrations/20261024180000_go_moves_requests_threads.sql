-- Milestone 5: manual moves, nurse requests, and request threads for the Go API.
-- Isolated development only, after the milestone 4 migration. No table or data
-- changes. Existing client policies, triggers, constraints, and RPC grants are kept.
-- Design: docs/go-migration/moves-requests-threads.md and ADR 0004.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nurseflow_go'
    AND NOT rolsuper AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'Expected limited Go role';
  END IF;
  -- The thread predicate below reads shifts and access rows without RLS.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user
    AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Run this migration as a role that bypasses RLS';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity
        AND c.relname IN ('active_shifts', 'manual_assignment_overrides',
          'nurse_request_messages')) <> 3 THEN
    RAISE EXCEPTION 'Expected all three tables with RLS enabled';
  END IF;
  -- Milestone 4 must already be applied; this one extends its helpers.
  IF to_regprocedure('go_private.caller_has_linked_access(uuid)') IS NULL
     OR (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
      AND policyname IN ('go_charge_active_shifts_update', 'go_joined_active_shifts_select',
        'go_charge_manual_assignment_overrides_update')) <> 3 THEN
    RAISE EXCEPTION 'Apply the shift-lifecycle and milestone 4 migrations first';
  END IF;
  IF to_regprocedure('go_private.caller_is_thread_actor(uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Thread predicate already exists; review before re-running';
  END IF;
  IF has_table_privilege('nurseflow_go', 'public.manual_assignment_overrides', 'INSERT,DELETE')
     OR has_table_privilege('nurseflow_go', 'public.nurse_request_messages', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Unexpected existing privileges; review before enabling Go';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Thread predicate (ADR 0004). Mirrors get_nurse_request_thread_actor, which
-- reads auth.uid() and therefore cannot see Go's transaction identity: the caller
-- is the unended shift's charge owner, or holds linked access to the slot of the
-- nurse who made the request. Answers yes/no and returns no row data.
-- ---------------------------------------------------------------------------
CREATE FUNCTION go_private.caller_is_thread_actor(p_shift_id uuid, p_request_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH caller AS (
    SELECT p.id FROM public.profiles p
    WHERE p.auth_user_id = NULLIF(current_setting('nurseflow.auth_user_id', true), '')::uuid
      AND p.role = 'charge_nurse'
  ), request AS (
    SELECT s.charge_profile_id, item.value ->> 'requestingNurseId' AS nurse_id
    FROM public.active_shifts s
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(s.shift_snapshot -> 'nurseRequests', '[]'::jsonb)) item(value)
    WHERE s.id = p_shift_id
      AND s.ended_at IS NULL
      AND item.value ->> 'id' = btrim(p_request_id)
    LIMIT 1
  )
  SELECT EXISTS (
    SELECT 1 FROM request r, caller c
    WHERE COALESCE(r.nurse_id, '') <> ''
      AND (
        r.charge_profile_id = c.id
        OR EXISTS (
          SELECT 1 FROM public.shift_nurse_access a
          WHERE a.shift_id = p_shift_id
            AND a.nurse_id = r.nurse_id
            AND a.nurse_profile_id = c.id
            AND a.status = 'linked'
        )
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION go_private.caller_is_thread_actor(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION go_private.caller_is_thread_actor(uuid, text)
  FROM anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION go_private.caller_is_thread_actor(uuid, text) TO nurseflow_go;

-- ---------------------------------------------------------------------------
-- Column-limited grants. Milestone 3 already grants override status/superseded_at
-- updates and active_shifts snapshot/updated_at updates.
-- ---------------------------------------------------------------------------
-- Manual moves insert one override; id and server_sequence stay database-generated.
GRANT INSERT (shift_id, baseline_assignment_result_id, bed_id, from_nurse_id, to_nurse_id,
  created_by_profile_id, created_at, status, related_swap_request_id,
  warning_acknowledgements, client_mutation_id)
  ON public.manual_assignment_overrides TO nurseflow_go;

-- Messages are append-only: no UPDATE or DELETE.
GRANT SELECT (id, shift_id, request_id, author_profile_id, body, created_at, client_mutation_id)
  ON public.nurse_request_messages TO nurseflow_go;
GRANT INSERT (shift_id, request_id, author_profile_id, body, client_mutation_id)
  ON public.nurse_request_messages TO nurseflow_go;

-- ---------------------------------------------------------------------------
-- Charge nurse: confirm a move on an owned, unended, assigned shift
-- ---------------------------------------------------------------------------
CREATE POLICY go_charge_manual_assignment_overrides_insert ON public.manual_assignment_overrides
  FOR INSERT TO nurseflow_go
  WITH CHECK (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.active_shifts s
      JOIN public.profiles p ON p.id = s.charge_profile_id
      WHERE s.id = manual_assignment_overrides.shift_id
        AND s.ended_at IS NULL
        AND s.status = 'assigned'
        AND p.id = manual_assignment_overrides.created_by_profile_id
        AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
        AND p.role = 'charge_nurse'
    )
  );

-- ---------------------------------------------------------------------------
-- Joined nurse: lock and update the unended shift they are linked to (ADR 0004).
-- Go appends exactly one nurse request; RLS cannot limit which JSON keys change.
-- ---------------------------------------------------------------------------
CREATE POLICY go_joined_active_shifts_update ON public.active_shifts
  FOR UPDATE TO nurseflow_go
  USING (ended_at IS NULL AND go_private.caller_has_linked_access(id))
  WITH CHECK (ended_at IS NULL AND go_private.caller_has_linked_access(id));

-- ---------------------------------------------------------------------------
-- Request threads: both participants read and append through the predicate.
-- ---------------------------------------------------------------------------
CREATE POLICY go_thread_nurse_request_messages_select ON public.nurse_request_messages
  FOR SELECT TO nurseflow_go
  USING (go_private.caller_is_thread_actor(shift_id, request_id));

CREATE POLICY go_thread_nurse_request_messages_insert ON public.nurse_request_messages
  FOR INSERT TO nurseflow_go
  WITH CHECK (
    author_profile_id = (
      SELECT p.id FROM public.profiles p
      WHERE p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
        AND p.role = 'charge_nurse'
    )
    AND go_private.caller_is_thread_actor(shift_id, request_id)
  );

-- Fail rather than leave Go with more than this milestone intends.
DO $$
BEGIN
  IF has_table_privilege('nurseflow_go', 'public.manual_assignment_overrides', 'DELETE')
     OR has_table_privilege('nurseflow_go', 'public.nurse_request_messages', 'UPDATE,DELETE')
     OR has_column_privilege('nurseflow_go', 'public.manual_assignment_overrides', 'server_sequence', 'INSERT')
     OR has_column_privilege('nurseflow_go', 'public.manual_assignment_overrides', 'to_nurse_id', 'UPDATE')
     OR has_column_privilege('nurseflow_go', 'public.nurse_request_messages', 'id', 'INSERT')
     OR has_column_privilege('nurseflow_go', 'public.nurse_request_messages', 'created_at', 'INSERT')
     OR has_column_privilege('nurseflow_go', 'public.active_shifts', 'charge_profile_id', 'UPDATE') THEN
    RAISE EXCEPTION 'nurseflow_go holds an unexpected write privilege';
  END IF;
  IF has_function_privilege('authenticated', 'go_private.caller_is_thread_actor(uuid,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'go_private.caller_is_thread_actor(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client roles must not execute the Go predicate helpers';
  END IF;
END $$;

COMMIT;
