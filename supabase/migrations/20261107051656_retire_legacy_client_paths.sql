-- Ticket 23: retire the legacy client and database workflow paths.
-- Apply only after the Go cutover (ticket 22) and its stable week. Every workflow
-- now reaches these tables through the Go API as nurseflow_go, so this removes:
--   1. 16 workflow RPCs that only the pre-Go app and the legacy Python route called;
--   2. the client table grants and policies that only direct app access used;
--   3. the two tables in the supabase_realtime publication (postgres_changes), which
--      the app never subscribes to. Broadcast uses realtime.messages instead.
-- Kept: Auth, Realtime broadcast triggers and authorization, the swap-completion and
-- notification triggers, the deferred device-token RPCs (ticket 18), the deferred
-- notification-target read (shift_nurse_access plus the profiles read its policy
-- needs), RLS on every table, all nurseflow_go grants and go_* policies, and all data.
-- Rollback: supabase/rollback/20261107051656_restore_legacy_client_paths.sql.
-- Design and evidence: docs/go-migration/hosted-development.md (ticket 23), ADR 0008.
BEGIN;

-- Preflight: refuse to run on a database that is not at the expected state.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nurseflow_go'
    AND NOT rolsuper AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'Expected limited Go role';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) <> 11 THEN
    RAISE EXCEPTION 'Expected all 11 public tables with RLS enabled';
  END IF;
  IF to_regprocedure('go_private.caller_is_thread_actor(uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Expected the milestone 5 Go migration to be applied';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Legacy workflow RPCs. Exact signatures, no IF EXISTS: a mismatch must fail.
-- ---------------------------------------------------------------------------
-- Invites and joining (Go: ticket 10).
DROP FUNCTION public.validate_shift_nurse_invite_code(text);
DROP FUNCTION public.accept_shift_nurse_invite_code(text);
-- Joined-nurse view (Go: ticket 11).
DROP FUNCTION public.get_joined_nurse_assignment_view();
-- Manual moves (Go: ticket 12).
DROP FUNCTION public.confirm_manual_assignment_override(uuid, text, text, text, text, jsonb, text, text);
-- Issue and swap requests (Go: tickets 13-14).
DROP FUNCTION public.submit_joined_nurse_issue_request(text);
DROP FUNCTION public.submit_joined_nurse_swap_request(text, text);
DROP FUNCTION public.update_shift_nurse_issue_status(text, text);
DROP FUNCTION public.resolve_shift_nurse_swap_request(text, text);
-- Request threads (Go: ticket 15). get_nurse_request_thread_actor stays, because
-- can_receive_nurseflow_broadcast (Realtime authorization) calls it.
DROP FUNCTION public.list_nurse_request_messages(uuid, text);
DROP FUNCTION public.append_nurse_request_message(uuid, text, text, text);
-- Reopen for editing (Go: ticket 06).
DROP FUNCTION public.reset_active_shift_for_editing(uuid, text);
-- Assignment runs (Go: tickets 16-17; the legacy Python route is removed).
DROP FUNCTION public.rerun_active_shift_assignment(uuid, text, jsonb);
DROP FUNCTION public.prepare_optimizer_run(uuid, text, timestamp with time zone, text);
DROP FUNCTION public.finalize_optimizer_run(uuid, text, text, jsonb, jsonb, jsonb);
DROP FUNCTION public.fail_optimizer_run(uuid, text);
-- Only finalize_optimizer_run called this; Go ports it in shifts.OutputValidationError.
DROP FUNCTION public.optimizer_output_validation_error(jsonb, jsonb, jsonb, jsonb);

-- ---------------------------------------------------------------------------
-- 2. Direct client table access. RLS stays enabled on every table.
-- ---------------------------------------------------------------------------
DROP POLICY "Charge nurses can create their own active shifts" ON public.active_shifts;
DROP POLICY "Charge nurses can read their own active shifts" ON public.active_shifts;
DROP POLICY "Charge nurses can update their own active shifts" ON public.active_shifts;

DROP POLICY "Charge nurses can create their own templates" ON public.floor_templates;
DROP POLICY "Charge nurses can delete their own templates" ON public.floor_templates;
DROP POLICY "Charge nurses can read their own templates" ON public.floor_templates;
DROP POLICY "Charge nurses can update their own templates" ON public.floor_templates;

DROP POLICY "Charge nurses can read override history for their shifts" ON public.manual_assignment_overrides;

DROP POLICY "Thread participants can read request messages" ON public.nurse_request_messages;

DROP POLICY "Charge nurses can create their own previous snapshots" ON public.previous_shift_snapshots;
DROP POLICY "Charge nurses can delete their own previous snapshots" ON public.previous_shift_snapshots;
DROP POLICY "Charge nurses can read their own previous snapshots" ON public.previous_shift_snapshots;

-- "Profiles can be read by their owner" stays: the kept shift_nurse_access policy
-- below reads profiles as the signed-in user.
DROP POLICY "Profiles can be created by their owner" ON public.profiles;
DROP POLICY "Profiles can be updated by their owner" ON public.profiles;

-- "Joined users can read their own access row" stays for the deferred
-- notification-target lookup (ticket 18), which is off behind a feature flag.
DROP POLICY "Charge nurses can manage access for their own shifts" ON public.shift_nurse_access;

DROP POLICY "Charge nurses can create invites for their own active shifts" ON public.shift_nurse_invites;
DROP POLICY "Charge nurses can delete invites for their own shifts" ON public.shift_nurse_invites;
DROP POLICY "Charge nurses can read invites for their own shifts" ON public.shift_nurse_invites;
DROP POLICY "Charge nurses can update invites for their own shifts" ON public.shift_nurse_invites;

-- Table-level REVOKE also removes any column privileges these roles held.
REVOKE ALL ON TABLE
  public.active_shifts, public.device_push_tokens, public.floor_templates,
  public.manual_assignment_overrides, public.notification_events,
  public.nurse_request_messages, public.optimizer_runs,
  public.previous_shift_snapshots, public.profiles,
  public.shift_nurse_access, public.shift_nurse_invites
  FROM anon, authenticated;
-- server_sequence is an identity column, so inserts never needed this.
REVOKE ALL ON SEQUENCE public.manual_assignment_overrides_server_sequence_seq FROM anon, authenticated;

-- The deferred notification-target read (and its policy's profiles subquery).
GRANT SELECT ON TABLE public.shift_nurse_access, public.profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Row-change Realtime. The app listens only to private broadcast channels.
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime DROP TABLE public.active_shifts, public.nurse_request_messages;

-- ---------------------------------------------------------------------------
-- Postflight: what must survive.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  kept text[] := ARRAY[
    'public.broadcast_nurseflow_access_change()',
    'public.broadcast_nurseflow_active_shift_change()',
    'public.broadcast_nurseflow_request_message()',
    'public.can_receive_nurseflow_broadcast(text)',
    'public.get_nurse_request_thread_actor(uuid, text)',
    'public.complete_swap_request_from_override()',
    'public.enqueue_active_shift_change_notifications()',
    'public.enqueue_notification_event(uuid, uuid, uuid, text, text, text, text, text, text)',
    'public.enqueue_nurse_request_message_notification()',
    'public.enqueue_request_activity_notification(uuid, text, uuid, text, text, text)',
    'public.enqueue_request_lifecycle_notifications()',
    'public.register_device_push_token(uuid, uuid, text, text, text)',
    'public.disable_current_device_push_token(uuid, uuid)'];
  fn text;
BEGIN
  FOREACH fn IN ARRAY kept LOOP
    IF to_regprocedure(fn) IS NULL THEN
      RAISE EXCEPTION 'Retained function missing: %', fn;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT t.tgisinternal) <> 7 THEN
    RAISE EXCEPTION 'Expected the 7 public triggers to remain';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) <> 11 THEN
    RAISE EXCEPTION 'RLS must stay enabled on all 11 public tables';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
      AND NOT ('nurseflow_go' = ANY (roles))) <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 client policies to remain';
  END IF;
  IF has_table_privilege('authenticated', 'public.floor_templates', 'SELECT')
     OR has_table_privilege('anon', 'public.profiles', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.shift_nurse_access', 'SELECT') THEN
    RAISE EXCEPTION 'Unexpected client table privileges';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.register_device_push_token(uuid, uuid, text, text, text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.can_receive_nurseflow_broadcast(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Retained client function grants changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'realtime'
      AND tablename = 'messages' AND policyname = 'NurseFlow users can receive scoped broadcasts') THEN
    RAISE EXCEPTION 'Realtime broadcast policy missing';
  END IF;
END $$;

COMMIT;
