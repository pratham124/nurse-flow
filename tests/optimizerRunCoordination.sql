-- Phase 9 Tasks 2.1-2.4 manual database checks.
-- Run in a disposable Supabase project after applying:
-- optimizer-service/sql/phase9_optimizer_server.sql
--
-- These checks need real auth sessions and existing Phase 5-8 records, so they
-- intentionally use placeholders instead of manufacturing a production-like
-- identity setup in this repository. Record the observed values in the Phase 9
-- regression report before deployment.

-- ---------------------------------------------------------------------------
-- 1. Schema and grants
-- ---------------------------------------------------------------------------

-- The run table must contain coordination metadata but no shift snapshot.
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'optimizer_runs'
order by ordinal_position;

-- The idempotency and one-running-run indexes should exist.
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'optimizer_runs'
order by indexname;

-- `authenticated` should have prepare only. Finalize/fail are service-only.
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'prepare_optimizer_run',
    'finalize_optimizer_run',
    'fail_optimizer_run'
  )
order by routine_name, grantee;

-- ---------------------------------------------------------------------------
-- 2. Prepare, retry, and authorization
-- ---------------------------------------------------------------------------

-- As the owning charge nurse, call once and save the returned runId. Repeat the
-- exact call. Both calls must return one run ID and one database row.
select public.prepare_optimizer_run(
  '<shift-id>'::uuid,
  '<mutation-id>',
  '<active-shifts.updated_at>'::timestamptz,
  null
);

select count(*)
from public.optimizer_runs
where shift_id = '<shift-id>'::uuid
  and client_mutation_id = '<mutation-id>';

-- Reuse the same mutation with a different revision or baseline. It must return
-- `conflict` and create no second row.
select public.prepare_optimizer_run(
  '<shift-id>'::uuid,
  '<same-mutation-id>',
  '<different-revision>'::timestamptz,
  null
);

-- Repeat the valid prepare as a joined nurse and an unrelated charge account.
-- Both calls must fail authorization and create no optimizer run.

-- ---------------------------------------------------------------------------
-- 3. Protected finalization and atomicity
-- ---------------------------------------------------------------------------

-- Calling finalize_optimizer_run with an authenticated mobile token must fail.
-- Use the service secret only for the remaining finalization checks.

-- Finalize a valid initial result. In one committed state verify:
--   * active_shifts.shift_snapshot.assignmentResult.id = optimizer_runs.result_id
--   * active_shifts.shift_snapshot.flags are the submitted matching flags
--   * optimizer_runs.status = 'succeeded'
--   * completed_at, duration_ms, input_fingerprint, and optimizer_version exist
select
  optimizer_runs.status,
  optimizer_runs.result_id,
  optimizer_runs.completed_at,
  optimizer_runs.duration_ms,
  optimizer_runs.input_fingerprint,
  optimizer_runs.optimizer_version,
  active_shifts.shift_snapshot #>> '{assignmentResult,id}' as baseline_result_id
from public.optimizer_runs
join public.active_shifts on active_shifts.id = optimizer_runs.shift_id
where optimizer_runs.id = '<run-id>'::uuid;

-- Prepare a rerun against the current baseline, create one active manual
-- override, and finalize successfully. The baseline ID must change and every
-- formerly active override must now be superseded.
select status, count(*)
from public.manual_assignment_overrides
where shift_id = '<shift-id>'::uuid
group by status
order by status;

-- Prepare another run, then change active_shifts.updated_at or its baseline
-- before finalization. Finalize must return `stale`; compare the saved baseline,
-- flags, and active overrides with their before-values to prove no partial write.

-- Submit one deliberately invalid owner/RN/capacity/coverage relationship.
-- Finalize must return `failed`, update only the run record, and leave the same
-- baseline, flags, and overrides untouched.

-- Force a database exception inside a disposable transaction and roll it back.
-- No result, flag, run success, or override supersession may survive.

-- ---------------------------------------------------------------------------
-- 4. Existing signals and nurse-scoped reads
-- ---------------------------------------------------------------------------

-- Observe connected charge and joined-nurse sessions during one successful
-- finalize. Both should receive the existing active-shift signal and refetch.

-- Compare notification events before/after success. Only affected linked nurses
-- should receive the generic assignment update. Repeat for stale and failed
-- finalization; neither may create an assignment-updated event.
select id, recipient_profile_id, event_type, created_at
from public.notification_events
where shift_id = '<shift-id>'::uuid
  and event_type = 'assignment_updated'
order by created_at;

-- As each joined nurse, call the established scoped reader. Verify it returns
-- only that nurse's effective beds, including active overrides, and contains no
-- optimizer run metadata or full assignment board.
select public.get_joined_nurse_assignment_view();

-- Direct joined-nurse reads of optimizer_runs must be denied/empty according to
-- the revoked table grants, even when the nurse is linked to the shift.
