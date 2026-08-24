-- NurseFlow Phase 9 Tasks 2.1-2.4 and 3.4
-- Run in Supabase after the Phase 5 active-shift tables and Phase 8 manual
-- assignment override setup exist.

create extension if not exists pgcrypto with schema extensions;

-- Task 3.4: the Phase 8 rerun RPC accepted a complete assignment snapshot
-- authored by the phone. Keep the historical function available for rollback,
-- but remove every mobile-role grant now that reruns use the optimizer service.
do $$
begin
  if to_regprocedure(
    'public.rerun_active_shift_assignment(uuid,text,jsonb)'
  ) is not null then
    execute 'revoke all on function public.rerun_active_shift_assignment(uuid, text, jsonb) from public, anon, authenticated';
  end if;
end;
$$;

create table if not exists public.optimizer_runs (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.active_shifts(id) on delete cascade,
  requested_by_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  client_mutation_id text not null check (btrim(client_mutation_id) <> ''),
  expected_shift_revision timestamptz not null,
  expected_baseline_assignment_result_id text,
  request_fingerprint text not null check (btrim(request_fingerprint) <> ''),
  input_fingerprint text
    check (input_fingerprint is null or btrim(input_fingerprint) <> ''),
  optimizer_version text
    check (optimizer_version is null or btrim(optimizer_version) <> ''),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed', 'stale')),
  result_id text,
  outcome_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(outcome_summary) = 'object'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now(),
  check (
    (status = 'succeeded' and result_id is not null)
    or (status <> 'succeeded' and result_id is null)
  ),
  check (
    (status = 'running' and completed_at is null)
    or (status <> 'running' and completed_at is not null)
  )
);

-- One mutation ID always has one meaning for one caller and shift.
create unique index if not exists optimizer_runs_idempotency
on public.optimizer_runs (
  shift_id,
  requested_by_profile_id,
  client_mutation_id
);

-- Initial runs have a NULL baseline, so they need a separate partial index.
create unique index if not exists optimizer_runs_one_running_initial
on public.optimizer_runs (shift_id, expected_shift_revision)
where status = 'running'
  and expected_baseline_assignment_result_id is null;

create unique index if not exists optimizer_runs_one_running_rerun
on public.optimizer_runs (
  shift_id,
  expected_shift_revision,
  expected_baseline_assignment_result_id
)
where status = 'running'
  and expected_baseline_assignment_result_id is not null;

create index if not exists optimizer_runs_shift_history
on public.optimizer_runs (shift_id, created_at desc);

create index if not exists optimizer_runs_status_started
on public.optimizer_runs (status, started_at desc);

alter table public.optimizer_runs enable row level security;
revoke all on table public.optimizer_runs from anon, authenticated;


-- Task 2.1: authorize the user, coordinate retries, and release only the
-- current server-owned snapshot needed by the Python optimizer.
create or replace function public.prepare_optimizer_run(
  p_shift_id uuid,
  p_client_mutation_id text,
  p_expected_shift_revision timestamptz,
  p_expected_baseline_assignment_result_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid;
  shift_row public.active_shifts%rowtype;
  existing_run public.optimizer_runs%rowtype;
  other_running_run public.optimizer_runs%rowtype;
  created_run public.optimizer_runs%rowtype;
  current_baseline_id text;
  normalized_baseline_id text;
  normalized_mutation_id text;
  request_fingerprint text;
  existing_run_found boolean;
  current_preconditions_match boolean;
begin
  normalized_mutation_id := nullif(btrim(p_client_mutation_id), '');
  normalized_baseline_id := nullif(
    btrim(p_expected_baseline_assignment_result_id),
    ''
  );

  if p_shift_id is null
    or normalized_mutation_id is null
    or p_expected_shift_revision is null then
    return jsonb_build_object('status', 'conflict');
  end if;

  select profiles.id
  into current_profile_id
  from public.profiles
  where profiles.auth_user_id = (select auth.uid())
    and profiles.role = 'charge_nurse'
  limit 1;

  if current_profile_id is null then
    raise exception using
      errcode = '42501',
      message = 'The signed-in account cannot prepare optimizer runs.';
  end if;

  request_fingerprint := encode(
    extensions.digest(
      concat_ws(
        E'\x1f',
        p_shift_id::text,
        p_expected_shift_revision::text,
        coalesce(normalized_baseline_id, '')
      ),
      'sha256'
    ),
    'hex'
  );

  -- Lock order is always optimizer run, then active shift. Finalization uses
  -- the same order, which avoids a retry/finalization deadlock.
  select optimizer_runs.*
  into existing_run
  from public.optimizer_runs
  where optimizer_runs.shift_id = p_shift_id
    and optimizer_runs.requested_by_profile_id = current_profile_id
    and optimizer_runs.client_mutation_id = normalized_mutation_id
  for update;

  existing_run_found := found;

  select active_shifts.*
  into shift_row
  from public.active_shifts
  where active_shifts.id = p_shift_id
  for update;

  if not found or shift_row.charge_profile_id <> current_profile_id then
    raise exception using
      errcode = '42501',
      message = 'The signed-in account does not own this shift.';
  end if;

  -- Two requests with the same new mutation can both miss the first lookup.
  -- Once this request owns the shift lock, recheck without taking the run lock.
  -- A finalizer cannot change that run while waiting for this same shift lock.
  if not existing_run_found then
    select optimizer_runs.*
    into existing_run
    from public.optimizer_runs
    where optimizer_runs.shift_id = p_shift_id
      and optimizer_runs.requested_by_profile_id = current_profile_id
      and optimizer_runs.client_mutation_id = normalized_mutation_id;

    existing_run_found := found;
  end if;

  current_baseline_id := nullif(
    btrim(shift_row.shift_snapshot #>> '{assignmentResult,id}'),
    ''
  );
  current_preconditions_match := shift_row.ended_at is null
    and shift_row.status in ('setup', 'assigned')
    and p_expected_shift_revision is not distinct from shift_row.updated_at
    and normalized_baseline_id is not distinct from current_baseline_id;

  -- Compare the mutation before current preconditions. A completed run changed
  -- the revision and baseline, but its retry must return the saved result.
  if existing_run_found then
    if existing_run.request_fingerprint <> request_fingerprint then
      return jsonb_build_object(
        'status', 'conflict',
        'runId', existing_run.id
      );
    end if;

    -- A process or network failure can leave a run marked `running`. Immediate
    -- retries must not duplicate its solve, but after the 90-second lease (past
    -- the 75-second host cutoff) the same mutation may safely reclaim it.
    if existing_run.status = 'running'
      and existing_run.started_at <= now() - interval '90 seconds' then
      if not current_preconditions_match then
        update public.optimizer_runs
        set
          status = 'stale',
          outcome_summary = jsonb_build_object('errorCode', 'stale'),
          completed_at = now(),
          duration_ms = greatest(
            0,
            floor(extract(epoch from (now() - existing_run.started_at)) * 1000)::integer
          )
        where id = existing_run.id;

        return jsonb_build_object(
          'status', 'stale',
          'runId', existing_run.id
        );
      end if;

      update public.optimizer_runs
      set
        started_at = now(),
        outcome_summary = '{}'::jsonb
      where id = existing_run.id;

      return jsonb_build_object(
        'status', 'prepared',
        'runId', existing_run.id,
        'runStatus', 'running',
        'shiftId', existing_run.shift_id,
        'expectedShiftRevision', existing_run.expected_shift_revision,
        'expectedBaselineAssignmentResultId',
          existing_run.expected_baseline_assignment_result_id,
        'requestFingerprint', existing_run.request_fingerprint,
        'shiftSnapshot', shift_row.shift_snapshot
      );
    end if;

    return jsonb_build_object(
      'status', 'existing',
      'runId', existing_run.id,
      'runStatus', existing_run.status,
      'shiftId', existing_run.shift_id,
      'expectedShiftRevision', existing_run.expected_shift_revision,
      'expectedBaselineAssignmentResultId',
        existing_run.expected_baseline_assignment_result_id,
      'requestFingerprint', existing_run.request_fingerprint,
      'resultId', existing_run.result_id,
      'outcomeSummary', existing_run.outcome_summary
    );
  end if;

  if not current_preconditions_match then
    return jsonb_build_object('status', 'stale');
  end if;

  select optimizer_runs.*
  into other_running_run
  from public.optimizer_runs
  where optimizer_runs.shift_id = p_shift_id
    and optimizer_runs.expected_shift_revision = shift_row.updated_at
    and optimizer_runs.expected_baseline_assignment_result_id
      is not distinct from current_baseline_id
    and optimizer_runs.status = 'running'
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'status', 'in_progress',
      'runId', other_running_run.id,
      'runStatus', other_running_run.status
    );
  end if;

  insert into public.optimizer_runs (
    shift_id,
    requested_by_profile_id,
    client_mutation_id,
    expected_shift_revision,
    expected_baseline_assignment_result_id,
    request_fingerprint
  )
  values (
    shift_row.id,
    current_profile_id,
    normalized_mutation_id,
    shift_row.updated_at,
    current_baseline_id,
    request_fingerprint
  )
  returning * into created_run;

  return jsonb_build_object(
    'status', 'prepared',
    'runId', created_run.id,
    'runStatus', created_run.status,
    'shiftId', created_run.shift_id,
    'expectedShiftRevision', created_run.expected_shift_revision,
    'expectedBaselineAssignmentResultId',
      created_run.expected_baseline_assignment_result_id,
    'requestFingerprint', created_run.request_fingerprint,
    'shiftSnapshot', shift_row.shift_snapshot
  );
end;
$$;

revoke all on function public.prepare_optimizer_run(uuid, text, timestamptz, text)
from public;
grant execute on function public.prepare_optimizer_run(uuid, text, timestamptz, text)
to authenticated;


-- Return NULL for a structurally safe result, otherwise a stable failure code.
-- Python already performs the full independent objective/flag validation; this
-- second boundary rechecks saved IDs, eligibility, capacity, and coverage.
create or replace function public.optimizer_output_validation_error(
  p_shift_snapshot jsonb,
  p_assignment_result jsonb,
  p_flags jsonb,
  p_objectives jsonb
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  assignment_record jsonb;
  bed_record jsonb;
  bed_state jsonb;
  coverage_record jsonb;
  nurse_record jsonb;
  room_record jsonb;
  objective_name text;
  result_id text;
  assigned_count integer;
  match_count integer;
begin
  if jsonb_typeof(p_assignment_result) <> 'object'
    or jsonb_typeof(p_flags) <> 'array'
    or jsonb_typeof(p_objectives) <> 'object' then
    return 'invalid_output_shape';
  end if;

  result_id := nullif(btrim(p_assignment_result ->> 'id'), '');
  if result_id is null
    or jsonb_typeof(p_assignment_result -> 'generatedTeams') <> 'array'
    or jsonb_typeof(p_assignment_result -> 'roomCoverage') <> 'array'
    or jsonb_typeof(p_assignment_result -> 'bedAssignments') <> 'array' then
    return 'invalid_assignment_result';
  end if;

  if exists (
    select 1
    from (
      select item ->> 'id' as id
      from jsonb_array_elements(p_assignment_result -> 'generatedTeams') item
      union all
      select item ->> 'id'
      from jsonb_array_elements(p_assignment_result -> 'roomCoverage') item
      union all
      select item ->> 'id'
      from jsonb_array_elements(p_assignment_result -> 'bedAssignments') item
      union all
      select item ->> 'id'
      from jsonb_array_elements(p_flags) item
    ) child_ids
    group by child_ids.id
    having child_ids.id is null
      or btrim(child_ids.id) = ''
      or child_ids.id not like result_id || '-%'
      or count(*) > 1
  ) then
    return 'invalid_output_ids';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignment_result -> 'generatedTeams') team
    where nullif(btrim(team ->> 'label'), '') is null
      or jsonb_typeof(team -> 'nurseIds') <> 'array'
  ) then
    return 'invalid_team_shape';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignment_result -> 'roomCoverage') coverage
    where nullif(btrim(coverage ->> 'roomId'), '') is null
      or jsonb_typeof(coverage -> 'nurseIds') <> 'array'
  ) then
    return 'invalid_coverage_shape';
  end if;

  -- Every current nurse must appear on exactly one generated team.
  for nurse_record in
    select value from jsonb_array_elements(p_shift_snapshot -> 'nurses')
  loop
    select count(*)
    into match_count
    from jsonb_array_elements(p_assignment_result -> 'generatedTeams') team,
      lateral jsonb_array_elements_text(team -> 'nurseIds') nurse_id
    where nurse_id = nurse_record ->> 'id';

    if match_count <> 1 then
      return 'invalid_team_membership';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_assignment_result -> 'generatedTeams') team,
      lateral jsonb_array_elements_text(team -> 'nurseIds') nurse_id
    where not exists (
      select 1
      from jsonb_array_elements(p_shift_snapshot -> 'nurses') current_nurse
      where current_nurse ->> 'id' = nurse_id
    )
  ) then
    return 'unknown_team_nurse';
  end if;

  -- Every room has one coverage record. Empty rooms may have no nurse IDs.
  for room_record in
    select value from jsonb_array_elements(p_shift_snapshot -> 'rooms')
  loop
    select count(*)
    into match_count
    from jsonb_array_elements(p_assignment_result -> 'roomCoverage') coverage
    where coverage ->> 'roomId' = room_record ->> 'id';

    if match_count <> 1 then
      return 'invalid_room_coverage';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_assignment_result -> 'roomCoverage') coverage
    where not exists (
      select 1
      from jsonb_array_elements(p_shift_snapshot -> 'rooms') current_room
      where current_room ->> 'id' = coverage ->> 'roomId'
    )
  ) then
    return 'unknown_coverage_room';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignment_result -> 'roomCoverage') coverage,
      lateral jsonb_array_elements_text(coverage -> 'nurseIds') nurse_id
    where not exists (
      select 1
      from jsonb_array_elements(p_shift_snapshot -> 'nurses') current_nurse
      where current_nurse ->> 'id' = nurse_id
    )
  ) then
    return 'unknown_coverage_nurse';
  end if;

  -- Each saved bed assignment must target one occupied bed and current nurse.
  for assignment_record in
    select value
    from jsonb_array_elements(p_assignment_result -> 'bedAssignments')
  loop
    select value
    into bed_record
    from jsonb_array_elements(p_shift_snapshot -> 'beds')
    where value ->> 'id' = assignment_record ->> 'bedId'
    limit 1;

    if not found then
      return 'unknown_assignment_bed';
    end if;

    select value
    into bed_state
    from jsonb_array_elements(p_shift_snapshot -> 'bedStates')
    where value ->> 'bedId' = assignment_record ->> 'bedId'
    limit 1;

    if not found
      or nullif(btrim(bed_state #>> '{patient,initials}'), '') is null
      or bed_state ->> 'acuity' not in ('green', 'yellow', 'red') then
      return 'assignment_to_empty_bed';
    end if;

    select value
    into nurse_record
    from jsonb_array_elements(p_shift_snapshot -> 'nurses')
    where value ->> 'id' = assignment_record ->> 'nurseId'
    limit 1;

    if not found then
      return 'unknown_assignment_nurse';
    end if;

    if bed_state ->> 'acuity' = 'red'
      and nurse_record ->> 'licenseType' <> 'RN' then
      return 'red_bed_requires_rn';
    end if;

    select value
    into coverage_record
    from jsonb_array_elements(p_assignment_result -> 'roomCoverage')
    where value ->> 'roomId' = bed_record ->> 'roomId'
    limit 1;

    if not found or not exists (
      select 1
      from jsonb_array_elements_text(coverage_record -> 'nurseIds') nurse_id
      where nurse_id = assignment_record ->> 'nurseId'
    ) then
      return 'assignment_without_coverage';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_assignment_result -> 'bedAssignments') assignment
    group by assignment ->> 'bedId'
    having count(*) > 1
  ) then
    return 'duplicate_bed_assignment';
  end if;

  for nurse_record in
    select value from jsonb_array_elements(p_shift_snapshot -> 'nurses')
  loop
    if coalesce(nurse_record ->> 'maxPatientLoad', '') !~ '^[0-9]+$' then
      return 'invalid_nurse_capacity';
    end if;

    select count(*)
    into assigned_count
    from jsonb_array_elements(p_assignment_result -> 'bedAssignments') assignment
    where assignment ->> 'nurseId' = nurse_record ->> 'id';

    if assigned_count > (nurse_record ->> 'maxPatientLoad')::integer then
      return 'nurse_capacity_exceeded';
    end if;
  end loop;

  foreach objective_name in array array[
    'unassignedCount',
    'maxNurseAcuityLoad',
    'maxNursePatientCount',
    'redBedOwnerRankSum',
    'sideGuidanceTotalExcess',
    'sideGuidanceNurseCount',
    'teamWeightedAcuityGap',
    'teamPatientCountGap',
    'teamRnCountGap',
    'teamExperienceDistributionGap',
    'teamCapacityGap'
  ]
  loop
    if jsonb_typeof(p_objectives -> objective_name) <> 'number' then
      return 'invalid_objective_summary';
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public.optimizer_output_validation_error(
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public;


-- Tasks 2.2-2.3: record a safe non-commit failure using only a stable code.
create or replace function public.fail_optimizer_run(
  p_run_id uuid,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  finished_at timestamptz := now();
  run_row public.optimizer_runs%rowtype;
  normalized_error_code text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Only the optimizer service may record run failures.';
  end if;

  normalized_error_code := nullif(btrim(p_error_code), '');
  if p_run_id is null or normalized_error_code is null then
    return jsonb_build_object('status', 'failed');
  end if;

  select optimizer_runs.*
  into run_row
  from public.optimizer_runs
  where optimizer_runs.id = p_run_id
  for update;

  if not found then
    return jsonb_build_object('status', 'failed');
  end if;

  if run_row.status = 'running' then
    update public.optimizer_runs
    set
      status = 'failed',
      outcome_summary = jsonb_build_object('errorCode', normalized_error_code),
      completed_at = finished_at,
      duration_ms = greatest(
        0,
        floor(extract(epoch from (finished_at - run_row.started_at)) * 1000)::integer
      )
    where id = run_row.id;
  end if;

  return jsonb_build_object('status', 'recorded', 'runId', run_row.id);
end;
$$;

revoke all on function public.fail_optimizer_run(uuid, text) from public;
grant execute on function public.fail_optimizer_run(uuid, text) to service_role;


-- Task 2.3: recheck current state, validate the output again, and commit the
-- baseline, flags, run result, and rerun override supersession atomically.
create or replace function public.finalize_optimizer_run(
  p_run_id uuid,
  p_input_fingerprint text,
  p_optimizer_version text,
  p_assignment_result jsonb,
  p_flags jsonb,
  p_objectives jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  finished_at timestamptz := now();
  run_row public.optimizer_runs%rowtype;
  shift_row public.active_shifts%rowtype;
  current_baseline_id text;
  new_result_id text;
  validation_error text;
  next_shift_snapshot jsonb;
  occupied_bed_count integer;
  assigned_bed_count integer;
  shift_exists boolean;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Only the optimizer service may finalize runs.';
  end if;

  new_result_id := nullif(btrim(p_assignment_result ->> 'id'), '');
  if p_run_id is null
    or nullif(btrim(p_input_fingerprint), '') is null
    or nullif(btrim(p_optimizer_version), '') is null
    or new_result_id is null then
    return jsonb_build_object('status', 'failed');
  end if;

  select optimizer_runs.*
  into run_row
  from public.optimizer_runs
  where optimizer_runs.id = p_run_id
  for update;

  if not found then
    return jsonb_build_object('status', 'failed');
  end if;

  -- A repeated finalization of the same completed run is idempotent.
  if run_row.status = 'succeeded' then
    if run_row.result_id = new_result_id
      and run_row.input_fingerprint = p_input_fingerprint
      and run_row.optimizer_version = p_optimizer_version then
      return jsonb_build_object(
        'status', 'saved',
        'runId', run_row.id,
        'resultId', run_row.result_id
      );
    end if;
    return jsonb_build_object('status', 'failed', 'runId', run_row.id);
  end if;

  if run_row.status = 'stale' then
    return jsonb_build_object('status', 'stale', 'runId', run_row.id);
  end if;
  if run_row.status = 'failed' then
    return jsonb_build_object('status', 'failed', 'runId', run_row.id);
  end if;

  select active_shifts.*
  into shift_row
  from public.active_shifts
  where active_shifts.id = run_row.shift_id
  for update;

  shift_exists := found;

  current_baseline_id := nullif(
    btrim(shift_row.shift_snapshot #>> '{assignmentResult,id}'),
    ''
  );

  if not shift_exists
    or shift_row.charge_profile_id <> run_row.requested_by_profile_id
    or shift_row.ended_at is not null
    or shift_row.status not in ('setup', 'assigned')
    or shift_row.updated_at is distinct from run_row.expected_shift_revision
    or current_baseline_id is distinct from
      run_row.expected_baseline_assignment_result_id then
    update public.optimizer_runs
    set
      status = 'stale',
      input_fingerprint = p_input_fingerprint,
      optimizer_version = p_optimizer_version,
      outcome_summary = jsonb_build_object('errorCode', 'stale'),
      completed_at = finished_at,
      duration_ms = greatest(
        0,
        floor(extract(epoch from (finished_at - run_row.started_at)) * 1000)::integer
      )
    where id = run_row.id;

    return jsonb_build_object('status', 'stale', 'runId', run_row.id);
  end if;

  validation_error := public.optimizer_output_validation_error(
    shift_row.shift_snapshot,
    p_assignment_result,
    p_flags,
    p_objectives
  );

  if validation_error is not null
    or new_result_id is not distinct from
      run_row.expected_baseline_assignment_result_id then
    update public.optimizer_runs
    set
      status = 'failed',
      input_fingerprint = p_input_fingerprint,
      optimizer_version = p_optimizer_version,
      outcome_summary = jsonb_build_object(
        'errorCode',
        coalesce(validation_error, 'result_id_reused')
      ),
      completed_at = finished_at,
      duration_ms = greatest(
        0,
        floor(extract(epoch from (finished_at - run_row.started_at)) * 1000)::integer
      )
    where id = run_row.id;

    return jsonb_build_object('status', 'failed', 'runId', run_row.id);
  end if;

  next_shift_snapshot := jsonb_set(
    jsonb_set(
      jsonb_set(
        shift_row.shift_snapshot,
        '{assignmentResult}',
        p_assignment_result,
        true
      ),
      '{flags}',
      p_flags,
      true
    ),
    '{status}',
    to_jsonb('assigned'::text),
    true
  );

  -- This is the only active_shifts write in the success path. Existing
  -- realtime and notification triggers observe it after the transaction
  -- commits. Stale and failed paths never touch active_shifts.
  update public.active_shifts
  set
    status = 'assigned',
    shift_snapshot = next_shift_snapshot,
    updated_at = finished_at
  where id = shift_row.id;

  if run_row.expected_baseline_assignment_result_id is not null then
    update public.manual_assignment_overrides
    set
      status = 'superseded',
      superseded_at = finished_at
    where shift_id = shift_row.id
      and status = 'active';
  end if;

  select count(*)
  into occupied_bed_count
  from jsonb_array_elements(shift_row.shift_snapshot -> 'bedStates') bed_state
  where nullif(btrim(bed_state #>> '{patient,initials}'), '') is not null
    and bed_state ->> 'acuity' in ('green', 'yellow', 'red');

  assigned_bed_count := jsonb_array_length(
    p_assignment_result -> 'bedAssignments'
  );

  update public.optimizer_runs
  set
    status = 'succeeded',
    input_fingerprint = p_input_fingerprint,
    optimizer_version = p_optimizer_version,
    result_id = new_result_id,
    outcome_summary = jsonb_build_object(
      'assignedBedCount', assigned_bed_count,
      'unassignedBedCount', greatest(0, occupied_bed_count - assigned_bed_count),
      'objectiveSummary', p_objectives
    ),
    completed_at = finished_at,
    duration_ms = greatest(
      0,
      floor(extract(epoch from (finished_at - run_row.started_at)) * 1000)::integer
    )
  where id = run_row.id;

  return jsonb_build_object(
    'status', 'saved',
    'runId', run_row.id,
    'resultId', new_result_id
  );
end;
$$;

revoke all on function public.finalize_optimizer_run(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb
) from public;
grant execute on function public.finalize_optimizer_run(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb
) to service_role;
