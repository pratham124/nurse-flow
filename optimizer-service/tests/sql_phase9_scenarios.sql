\set ON_ERROR_STOP on

insert into public.profiles (id, auth_user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'charge_nurse'),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'regular_nurse');

insert into public.active_shifts (
  id,
  charge_profile_id,
  status,
  updated_at,
  shift_snapshot
)
values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'setup',
  '2026-08-22 12:00:00+00',
  jsonb_build_object(
    'id', '30000000-0000-0000-0000-000000000001',
    'floorName', 'Synthetic SQL Floor',
    'status', 'setup',
    'doctorSides', jsonb_build_array(
      jsonb_build_object('id', 'side-a', 'name', 'Side A')
    ),
    'admittingDoctorSideId', 'side-a',
    'sideLoadLimits', jsonb_build_object(
      'admitting', jsonb_build_object('minimum', 1, 'maximum', 2),
      'nonAdmitting', jsonb_build_object('minimum', 1, 'maximum', 2)
    ),
    'rooms', jsonb_build_array(
      jsonb_build_object('id', 'room-a', 'doctorSideId', 'side-a')
    ),
    'beds', jsonb_build_array(
      jsonb_build_object('id', 'bed-a', 'roomId', 'room-a')
    ),
    'bedStates', jsonb_build_array(
      jsonb_build_object(
        'id', 'state-a',
        'bedId', 'bed-a',
        'patient', jsonb_build_object('initials', 'PT'),
        'acuity', 'red'
      )
    ),
    'nurses', jsonb_build_array(
      jsonb_build_object(
        'id', 'nurse-rn',
        'name', 'Synthetic RN',
        'licenseType', 'RN',
        'experienceLevel', 'experienced',
        'maxPatientLoad', 1
      )
    ),
    'flags', '[]'::jsonb
  )
);

do $$
declare
  prepared jsonb;
  retried jsonb;
  recovered jsonb;
  conflicted jsonb;
begin
  perform set_config('app.test_uid', '20000000-0000-0000-0000-000000000001', false);
  perform set_config('app.test_role', 'authenticated', false);

  prepared := public.prepare_optimizer_run(
    '30000000-0000-0000-0000-000000000001',
    'mutation-initial',
    '2026-08-22 12:00:00+00',
    null
  );
  if prepared ->> 'status' <> 'prepared' then
    raise exception 'Expected prepared, received %', prepared;
  end if;

  retried := public.prepare_optimizer_run(
    '30000000-0000-0000-0000-000000000001',
    'mutation-initial',
    '2026-08-22 12:00:00+00',
    null
  );
  if retried ->> 'status' <> 'existing'
    or retried ->> 'runId' <> prepared ->> 'runId' then
    raise exception 'Expected identical retry to reuse the run: %', retried;
  end if;

  update public.optimizer_runs
  set started_at = now() - interval '91 seconds'
  where id = (prepared ->> 'runId')::uuid;
  recovered := public.prepare_optimizer_run(
    '30000000-0000-0000-0000-000000000001',
    'mutation-initial',
    '2026-08-22 12:00:00+00',
    null
  );
  if recovered ->> 'status' <> 'prepared'
    or recovered ->> 'runId' <> prepared ->> 'runId' then
    raise exception 'Expected expired lease recovery to reuse the run: %', recovered;
  end if;

  conflicted := public.prepare_optimizer_run(
    '30000000-0000-0000-0000-000000000001',
    'mutation-initial',
    '2026-08-22 12:00:01+00',
    null
  );
  if conflicted ->> 'status' <> 'conflict' then
    raise exception 'Expected mutation conflict, received %', conflicted;
  end if;

  if (select count(*) from public.optimizer_runs) <> 1 then
    raise exception 'Prepare retry created a duplicate run.';
  end if;
end;
$$;

-- Finalize the initial run, then prove the same old request still returns its
-- saved result even though success changed the current revision and baseline.
do $$
declare
  run_id uuid;
  finalized jsonb;
  retry_after_save jsonb;
  output jsonb := jsonb_build_object(
    'id', 'result-1',
    'generatedTeams', jsonb_build_array(
      jsonb_build_object('id', 'result-1-team-a', 'label', 'A', 'nurseIds', jsonb_build_array('nurse-rn'))
    ),
    'roomCoverage', jsonb_build_array(
      jsonb_build_object('id', 'result-1-room-a', 'roomId', 'room-a', 'nurseIds', jsonb_build_array('nurse-rn'))
    ),
    'bedAssignments', jsonb_build_array(
      jsonb_build_object('id', 'result-1-bed-a', 'bedId', 'bed-a', 'nurseId', 'nurse-rn')
    )
  );
  objectives jsonb := jsonb_build_object(
    'unassignedCount', 0,
    'maxNurseAcuityLoad', 3,
    'maxNursePatientCount', 1,
    'redBedOwnerRankSum', 0,
    'sideGuidanceTotalExcess', 0,
    'sideGuidanceNurseCount', 0,
    'teamWeightedAcuityGap', 0,
    'teamPatientCountGap', 0,
    'teamRnCountGap', 0,
    'teamExperienceDistributionGap', 0,
    'teamCapacityGap', 0
  );
begin
  select id into run_id
  from public.optimizer_runs
  where client_mutation_id = 'mutation-initial';

  perform set_config('app.test_role', 'service_role', false);
  finalized := public.finalize_optimizer_run(
    run_id,
    'input-fingerprint-1',
    'test-version',
    output,
    '[]'::jsonb,
    objectives
  );
  if finalized ->> 'status' <> 'saved' then
    raise exception 'Expected saved initial result, received %', finalized;
  end if;
  if (select status from public.optimizer_runs where id = run_id) <> 'succeeded'
    or (select shift_snapshot #>> '{assignmentResult,id}' from public.active_shifts) <> 'result-1' then
    raise exception 'Run and baseline did not commit together.';
  end if;

  perform set_config('app.test_uid', '20000000-0000-0000-0000-000000000001', false);
  perform set_config('app.test_role', 'authenticated', false);
  retry_after_save := public.prepare_optimizer_run(
    '30000000-0000-0000-0000-000000000001',
    'mutation-initial',
    '2026-08-22 12:00:00+00',
    null
  );
  if retry_after_save ->> 'status' <> 'existing'
    or retry_after_save ->> 'runStatus' <> 'succeeded'
    or retry_after_save ->> 'resultId' <> 'result-1' then
    raise exception 'Completed retry did not return saved result: %', retry_after_save;
  end if;
end;
$$;

-- A successful rerun replaces the baseline and supersedes active overrides in
-- the same transaction.
do $$
declare
  shift_revision timestamptz;
  prepared jsonb;
  finalized jsonb;
begin
  select updated_at into shift_revision from public.active_shifts;
  perform set_config('app.test_uid', '20000000-0000-0000-0000-000000000001', false);
  perform set_config('app.test_role', 'authenticated', false);
  prepared := public.prepare_optimizer_run(
    '30000000-0000-0000-0000-000000000001',
    'mutation-rerun',
    shift_revision,
    'result-1'
  );
  if prepared ->> 'status' <> 'prepared' then
    raise exception 'Expected rerun to prepare, received %', prepared;
  end if;

  insert into public.manual_assignment_overrides (id, shift_id, status)
  values (
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'active'
  );

  perform set_config('app.test_role', 'service_role', false);
  finalized := public.finalize_optimizer_run(
    (prepared ->> 'runId')::uuid,
    'input-fingerprint-2',
    'test-version',
    jsonb_build_object(
      'id', 'result-2',
      'generatedTeams', jsonb_build_array(
        jsonb_build_object('id', 'result-2-team-a', 'label', 'A', 'nurseIds', jsonb_build_array('nurse-rn'))
      ),
      'roomCoverage', jsonb_build_array(
        jsonb_build_object('id', 'result-2-room-a', 'roomId', 'room-a', 'nurseIds', jsonb_build_array('nurse-rn'))
      ),
      'bedAssignments', jsonb_build_array(
        jsonb_build_object('id', 'result-2-bed-a', 'bedId', 'bed-a', 'nurseId', 'nurse-rn')
      )
    ),
    '[]'::jsonb,
    jsonb_build_object(
      'unassignedCount', 0, 'maxNurseAcuityLoad', 3,
      'maxNursePatientCount', 1, 'redBedOwnerRankSum', 0,
      'sideGuidanceTotalExcess', 0, 'sideGuidanceNurseCount', 0,
      'teamWeightedAcuityGap', 0, 'teamPatientCountGap', 0,
      'teamRnCountGap', 0, 'teamExperienceDistributionGap', 0,
      'teamCapacityGap', 0
    )
  );

  if finalized ->> 'status' <> 'saved'
    or (select shift_snapshot #>> '{assignmentResult,id}' from public.active_shifts) <> 'result-2'
    or (select status from public.manual_assignment_overrides where id = '40000000-0000-0000-0000-000000000001') <> 'superseded' then
    raise exception 'Rerun baseline and overrides did not commit together: %', finalized;
  end if;
end;
$$;

-- An intervening revision change makes finalization stale and preserves the
-- previously committed snapshot.
do $$
declare
  shift_revision timestamptz;
  before_snapshot jsonb;
  prepared jsonb;
  finalized jsonb;
begin
  select updated_at, shift_snapshot
  into shift_revision, before_snapshot
  from public.active_shifts;
  perform set_config('app.test_uid', '20000000-0000-0000-0000-000000000001', false);
  perform set_config('app.test_role', 'authenticated', false);
  prepared := public.prepare_optimizer_run(
    '30000000-0000-0000-0000-000000000001',
    'mutation-stale',
    shift_revision,
    'result-2'
  );

  update public.active_shifts set updated_at = updated_at + interval '1 second';
  perform set_config('app.test_role', 'service_role', false);
  finalized := public.finalize_optimizer_run(
    (prepared ->> 'runId')::uuid,
    'input-fingerprint-stale',
    'test-version',
    jsonb_build_object(
      'id', 'result-stale',
      'generatedTeams', '[]'::jsonb,
      'roomCoverage', '[]'::jsonb,
      'bedAssignments', '[]'::jsonb
    ),
    '[]'::jsonb,
    '{}'::jsonb
  );

  if finalized ->> 'status' <> 'stale'
    or (select shift_snapshot from public.active_shifts) is distinct from before_snapshot
    or (select status from public.optimizer_runs where id = (prepared ->> 'runId')::uuid) <> 'stale' then
    raise exception 'Stale finalization changed committed assignment state: %', finalized;
  end if;
end;
$$;

-- A corrupt output relationship fails the second validation boundary without
-- replacing the current baseline.
do $$
declare
  shift_revision timestamptz;
  before_snapshot jsonb;
  prepared jsonb;
  finalized jsonb;
begin
  select updated_at, shift_snapshot
  into shift_revision, before_snapshot
  from public.active_shifts;
  perform set_config('app.test_uid', '20000000-0000-0000-0000-000000000001', false);
  perform set_config('app.test_role', 'authenticated', false);
  prepared := public.prepare_optimizer_run(
    '30000000-0000-0000-0000-000000000001',
    'mutation-invalid-output',
    shift_revision,
    'result-2'
  );

  perform set_config('app.test_role', 'service_role', false);
  finalized := public.finalize_optimizer_run(
    (prepared ->> 'runId')::uuid,
    'input-fingerprint-invalid',
    'test-version',
    jsonb_build_object(
      'id', 'result-invalid',
      'generatedTeams', jsonb_build_array(
        jsonb_build_object('id', 'result-invalid-team-a', 'label', 'A', 'nurseIds', jsonb_build_array('nurse-rn'))
      ),
      'roomCoverage', jsonb_build_array(
        jsonb_build_object('id', 'result-invalid-room-a', 'roomId', 'room-a', 'nurseIds', jsonb_build_array('nurse-rn'))
      ),
      'bedAssignments', jsonb_build_array(
        jsonb_build_object('id', 'result-invalid-bed-a', 'bedId', 'bed-a', 'nurseId', 'unknown-nurse')
      )
    ),
    '[]'::jsonb,
    jsonb_build_object(
      'unassignedCount', 0, 'maxNurseAcuityLoad', 3,
      'maxNursePatientCount', 1, 'redBedOwnerRankSum', 0,
      'sideGuidanceTotalExcess', 0, 'sideGuidanceNurseCount', 0,
      'teamWeightedAcuityGap', 0, 'teamPatientCountGap', 0,
      'teamRnCountGap', 0, 'teamExperienceDistributionGap', 0,
      'teamCapacityGap', 0
    )
  );

  if finalized ->> 'status' <> 'failed'
    or (select shift_snapshot from public.active_shifts) is distinct from before_snapshot
    or (select status from public.optimizer_runs where id = (prepared ->> 'runId')::uuid) <> 'failed' then
    raise exception 'Invalid output changed committed assignment state: %', finalized;
  end if;
end;
$$;

-- Force a failure after the active-shift UPDATE would have run. PostgreSQL must
-- roll the entire finalization statement back, including baseline and override
-- changes, leaving the run available for a safe retry.
create or replace function public.test_reject_optimizer_success()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'succeeded' then
    raise exception 'synthetic finalization failure';
  end if;
  return new;
end;
$$;

create trigger test_reject_optimizer_success
before update on public.optimizer_runs
for each row execute function public.test_reject_optimizer_success();

do $$
declare
  shift_revision timestamptz;
  before_snapshot jsonb;
  prepared jsonb;
begin
  select updated_at, shift_snapshot
  into shift_revision, before_snapshot
  from public.active_shifts;
  insert into public.manual_assignment_overrides (id, shift_id, status)
  values (
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    'active'
  );

  perform set_config('app.test_uid', '20000000-0000-0000-0000-000000000001', false);
  perform set_config('app.test_role', 'authenticated', false);
  prepared := public.prepare_optimizer_run(
    '30000000-0000-0000-0000-000000000001',
    'mutation-rollback',
    shift_revision,
    'result-2'
  );

  perform set_config('app.test_role', 'service_role', false);
  begin
    perform public.finalize_optimizer_run(
      (prepared ->> 'runId')::uuid,
      'input-fingerprint-rollback',
      'test-version',
      jsonb_build_object(
        'id', 'result-rollback',
        'generatedTeams', jsonb_build_array(
          jsonb_build_object('id', 'result-rollback-team-a', 'label', 'A', 'nurseIds', jsonb_build_array('nurse-rn'))
        ),
        'roomCoverage', jsonb_build_array(
          jsonb_build_object('id', 'result-rollback-room-a', 'roomId', 'room-a', 'nurseIds', jsonb_build_array('nurse-rn'))
        ),
        'bedAssignments', jsonb_build_array(
          jsonb_build_object('id', 'result-rollback-bed-a', 'bedId', 'bed-a', 'nurseId', 'nurse-rn')
        )
      ),
      '[]'::jsonb,
      jsonb_build_object(
        'unassignedCount', 0, 'maxNurseAcuityLoad', 3,
        'maxNursePatientCount', 1, 'redBedOwnerRankSum', 0,
        'sideGuidanceTotalExcess', 0, 'sideGuidanceNurseCount', 0,
        'teamWeightedAcuityGap', 0, 'teamPatientCountGap', 0,
        'teamRnCountGap', 0, 'teamExperienceDistributionGap', 0,
        'teamCapacityGap', 0
      )
    );
    raise exception 'Synthetic database failure was not raised.';
  exception
    when others then
      if sqlerrm <> 'synthetic finalization failure' then
        raise;
      end if;
  end;

  if (select shift_snapshot from public.active_shifts) is distinct from before_snapshot
    or (select status from public.manual_assignment_overrides where id = '40000000-0000-0000-0000-000000000002') <> 'active'
    or (select status from public.optimizer_runs where id = (prepared ->> 'runId')::uuid) <> 'running' then
    raise exception 'Database failure left a partial finalization.';
  end if;
end;
$$;

drop trigger test_reject_optimizer_success on public.optimizer_runs;
drop function public.test_reject_optimizer_success();

do $$
begin
  perform set_config('app.test_uid', '20000000-0000-0000-0000-000000000002', false);
  begin
    perform public.prepare_optimizer_run(
      '30000000-0000-0000-0000-000000000001',
      'mutation-joined-nurse',
      '2026-08-22 12:00:00+00',
      null
    );
    raise exception 'Joined nurse unexpectedly prepared a run.';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

do $$
begin
  if has_table_privilege('authenticated', 'public.optimizer_runs', 'select') then
    raise exception 'Authenticated unexpectedly has optimizer run table access.';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.finalize_optimizer_run(uuid,text,text,jsonb,jsonb,jsonb)',
    'execute'
  ) then
    raise exception 'Authenticated unexpectedly has finalize access.';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.finalize_optimizer_run(uuid,text,text,jsonb,jsonb,jsonb)',
    'execute'
  ) then
    raise exception 'Service role is missing finalize access.';
  end if;
end;
$$;

select 'phase9 task 2 SQL scenarios passed' as result;
