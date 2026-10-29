-- Milestone 6: assignment runs coordinated by Go.
-- Isolated development only, after the milestone 5 migration. No table or data
-- changes. Existing client policies, triggers, constraints, and RPC grants are kept,
-- and the unique indexes on optimizer_runs stay the final guard against races.
-- Design: docs/go-migration/assignment-runs.md and ADR 0005.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nurseflow_go'
    AND NOT rolsuper AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'Expected limited Go role';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity
        AND c.relname IN ('active_shifts', 'manual_assignment_overrides', 'optimizer_runs')) <> 3 THEN
    RAISE EXCEPTION 'Expected all three tables with RLS enabled';
  END IF;
  -- Milestones 3 and 5 grant the active_shifts and override updates this one reuses.
  IF NOT has_column_privilege('nurseflow_go', 'public.active_shifts', 'shift_snapshot', 'UPDATE')
     OR NOT has_column_privilege('nurseflow_go', 'public.active_shifts', 'status', 'UPDATE')
     OR NOT has_column_privilege('nurseflow_go', 'public.active_shifts', 'updated_at', 'UPDATE')
     OR NOT has_column_privilege('nurseflow_go', 'public.manual_assignment_overrides', 'status', 'UPDATE')
     OR NOT has_column_privilege('nurseflow_go', 'public.manual_assignment_overrides', 'superseded_at', 'UPDATE') THEN
    RAISE EXCEPTION 'Apply the shift-lifecycle migration first';
  END IF;
  IF has_table_privilege('nurseflow_go', 'public.optimizer_runs', 'SELECT,INSERT,UPDATE,DELETE')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'optimizer_runs' AND policyname LIKE 'go\_%') THEN
    RAISE EXCEPTION 'Unexpected existing optimizer_runs access; review before enabling Go';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Column-limited grants. Go reads runs, creates them with the request
-- identity only, and records outcomes. It never deletes a run and can never
-- change who requested it or which shift or revision it belongs to.
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.optimizer_runs TO nurseflow_go;
GRANT INSERT (shift_id, requested_by_profile_id, client_mutation_id,
  expected_shift_revision, expected_baseline_assignment_result_id, request_fingerprint)
  ON public.optimizer_runs TO nurseflow_go;
GRANT UPDATE (status, input_fingerprint, optimizer_version, result_id,
  outcome_summary, started_at, completed_at, duration_ms)
  ON public.optimizer_runs TO nurseflow_go;

-- ---------------------------------------------------------------------------
-- Charge nurse: only the caller's own runs on a shift the caller owns.
-- The shift sub-select is itself limited by the active_shifts policies.
-- ---------------------------------------------------------------------------
CREATE POLICY go_charge_optimizer_runs_select ON public.optimizer_runs
  FOR SELECT TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = optimizer_runs.shift_id
      AND p.id = optimizer_runs.requested_by_profile_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ));

CREATE POLICY go_charge_optimizer_runs_insert ON public.optimizer_runs
  FOR INSERT TO nurseflow_go
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = optimizer_runs.shift_id
      AND p.id = optimizer_runs.requested_by_profile_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ));

CREATE POLICY go_charge_optimizer_runs_update ON public.optimizer_runs
  FOR UPDATE TO nurseflow_go
  USING (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = optimizer_runs.shift_id
      AND p.id = optimizer_runs.requested_by_profile_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.active_shifts s
    JOIN public.profiles p ON p.id = s.charge_profile_id
    WHERE s.id = optimizer_runs.shift_id
      AND p.id = optimizer_runs.requested_by_profile_id
      AND p.auth_user_id = NULLIF((SELECT current_setting('nurseflow.auth_user_id', true)), '')::uuid
      AND p.role = 'charge_nurse'
  ));

-- Fail rather than leave Go with more than this milestone intends.
DO $$
BEGIN
  IF has_table_privilege('nurseflow_go', 'public.optimizer_runs', 'DELETE,TRUNCATE')
     OR has_column_privilege('nurseflow_go', 'public.optimizer_runs', 'id', 'INSERT')
     OR has_column_privilege('nurseflow_go', 'public.optimizer_runs', 'started_at', 'INSERT')
     OR has_column_privilege('nurseflow_go', 'public.optimizer_runs', 'status', 'INSERT')
     OR has_column_privilege('nurseflow_go', 'public.optimizer_runs', 'shift_id', 'UPDATE')
     OR has_column_privilege('nurseflow_go', 'public.optimizer_runs', 'requested_by_profile_id', 'UPDATE')
     OR has_column_privilege('nurseflow_go', 'public.optimizer_runs', 'client_mutation_id', 'UPDATE')
     OR has_column_privilege('nurseflow_go', 'public.optimizer_runs', 'expected_shift_revision', 'UPDATE')
     OR has_column_privilege('nurseflow_go', 'public.optimizer_runs', 'request_fingerprint', 'UPDATE')
     OR has_table_privilege('nurseflow_go', 'public.manual_assignment_overrides', 'DELETE')
     OR has_column_privilege('nurseflow_go', 'public.active_shifts', 'charge_profile_id', 'UPDATE') THEN
    RAISE EXCEPTION 'nurseflow_go holds an unexpected write privilege';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'optimizer_runs' AND policyname LIKE 'go\_charge\_optimizer\_runs\_%') <> 3 THEN
    RAISE EXCEPTION 'Expected exactly three Go optimizer_runs policies';
  END IF;
END $$;

COMMIT;
