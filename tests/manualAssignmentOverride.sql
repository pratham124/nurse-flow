begin;

create or replace function auth.uid()
returns uuid
language sql
stable
as 'select ''11111111-1111-4111-8111-111111111111''::uuid';

insert into public.profiles (id, auth_user_id, role)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'charge_nurse'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'charge_nurse'
  );

insert into public.active_shifts (
  id,
  charge_profile_id,
  status,
  shift_snapshot
)
values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'assigned',
  '{
    "id": "shift-1",
    "status": "assigned",
    "admittingDoctorSideId": "side-1",
    "sideLoadLimits": {
      "admitting": { "min": 1, "max": 2 },
      "nonAdmitting": { "min": 1, "max": 2 }
    },
    "rooms": [
      { "id": "room-1", "doctorSideId": "side-1", "label": "401", "bedCount": 2 }
    ],
    "beds": [
      { "id": "bed-a", "roomId": "room-1", "label": "401-A", "bedNumber": 1 },
      { "id": "bed-b", "roomId": "room-1", "label": "401-B", "bedNumber": 2 }
    ],
    "bedStates": [
      { "id": "state-a", "bedId": "bed-a", "patient": { "initials": "AA" }, "acuity": "green" },
      { "id": "state-b", "bedId": "bed-b", "patient": { "initials": "BB" }, "acuity": "green" }
    ],
    "nurses": [
      { "id": "nurse-a", "name": "Avery", "licenseType": "RN", "maxPatientLoad": 2 },
      { "id": "nurse-b", "name": "Blake", "licenseType": "RN", "maxPatientLoad": 2 }
    ],
    "nurseRequests": [],
    "assignmentResult": {
      "id": "baseline-1",
      "generatedTeams": [],
      "roomCoverage": [
        { "id": "coverage-1", "roomId": "room-1", "nurseIds": ["nurse-a", "nurse-b"] }
      ],
      "bedAssignments": [
        { "id": "assignment-a", "bedId": "bed-a", "nurseId": "nurse-a" },
        { "id": "assignment-b", "bedId": "bed-b", "nurseId": "nurse-b" }
      ]
    }
  }'::jsonb
);

do $$
declare
  result jsonb;
begin
  result := public.confirm_manual_assignment_override(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'baseline-1',
    'bed-a',
    'nurse-a',
    'nurse-b',
    '[]'::jsonb,
    null,
    'mutation-1'
  );

  if result ->> 'status' <> 'saved' then
    raise exception 'Expected the first move to be saved.';
  end if;

  if result #>> '{activeAssignmentOverridesByBedId,bed-a,toNurseId}' <> 'nurse-b' then
    raise exception 'Expected the active projection to contain nurse-b.';
  end if;
end;
$$;

do $$
declare
  result jsonb;
begin
  result := public.confirm_manual_assignment_override(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'baseline-1',
    'bed-a',
    'nurse-b',
    'nurse-a',
    '[]'::jsonb,
    null,
    'mutation-2'
  );

  if result ->> 'status' <> 'saved' then
    raise exception 'Expected the replacement move to be saved.';
  end if;

  if (
    select count(*)
    from public.manual_assignment_overrides
    where shift_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      and bed_id = 'bed-a'
      and status = 'active'
  ) <> 1 then
    raise exception 'Expected exactly one active same-bed override.';
  end if;

  if (
    select count(*)
    from public.manual_assignment_overrides
    where shift_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      and bed_id = 'bed-a'
      and status = 'superseded'
  ) <> 1 then
    raise exception 'Expected the prior same-bed override to remain in history.';
  end if;
end;
$$;

do $$
declare
  before_count integer;
  result jsonb;
begin
  select count(*) into before_count
  from public.manual_assignment_overrides;

  result := public.confirm_manual_assignment_override(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'old-baseline',
    'bed-a',
    'nurse-a',
    'nurse-b',
    '[]'::jsonb,
    null,
    'mutation-stale-baseline'
  );

  if result ->> 'status' <> 'stale' then
    raise exception 'Expected a stale baseline result.';
  end if;

  if (select count(*) from public.manual_assignment_overrides) <> before_count then
    raise exception 'A stale move changed override history.';
  end if;
end;
$$;

do $$
declare
  before_count integer;
  result jsonb;
begin
  select count(*) into before_count
  from public.manual_assignment_overrides;

  result := public.confirm_manual_assignment_override(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'baseline-1',
    'bed-a',
    'nurse-b',
    'nurse-a',
    '[]'::jsonb,
    null,
    'mutation-stale-owner'
  );

  if result ->> 'status' <> 'stale' then
    raise exception 'Expected a stale source-nurse result.';
  end if;

  if (select count(*) from public.manual_assignment_overrides) <> before_count then
    raise exception 'A stale move changed override history.';
  end if;
end;
$$;

update public.active_shifts
set shift_snapshot = jsonb_set(
  jsonb_set(shift_snapshot, '{bedStates,0,acuity}', '"red"'::jsonb),
  '{nurses,1,licenseType}',
  '"LPN"'::jsonb
)
where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

do $$
begin
  perform public.confirm_manual_assignment_override(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'baseline-1',
    'bed-a',
    'nurse-a',
    'nurse-b',
    '[]'::jsonb,
    null,
    'mutation-red-lpn'
  );
  raise exception 'Expected a red-to-LPN move to fail.';
exception
  when others then
    if sqlerrm not like '%red-acuity bed must be assigned to an RN%' then
      raise;
    end if;
end;
$$;

update public.active_shifts
set shift_snapshot = jsonb_set(
  jsonb_set(
    jsonb_set(shift_snapshot, '{bedStates,0,acuity}', '"green"'::jsonb),
    '{nurses,1,licenseType}',
    '"RN"'::jsonb
  ),
  '{nurses,1,maxPatientLoad}',
  '1'::jsonb
)
where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

update public.active_shifts
set shift_snapshot = jsonb_set(
  jsonb_set(shift_snapshot, '{sideLoadLimits,admitting,max}', '1'::jsonb),
  '{sideLoadLimits,nonAdmitting,max}',
  '1'::jsonb
)
where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

do $$
begin
  perform public.confirm_manual_assignment_override(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'baseline-1',
    'bed-a',
    'nurse-a',
    'nurse-b',
    '[]'::jsonb,
    null,
    'mutation-warning-missing'
  );
  raise exception 'Expected an unacknowledged overload to fail.';
exception
  when others then
    if sqlerrm not like '%Acknowledge the max-load warning%' then
      raise;
    end if;
end;
$$;

do $$
declare
  result jsonb;
begin
  result := public.confirm_manual_assignment_override(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'baseline-1',
    'bed-a',
    'nurse-a',
    'nurse-b',
    '[
      { "id": "ack-max", "warningType": "over_max_load" },
      { "id": "ack-side", "warningType": "over_side_load_limit" }
    ]'::jsonb,
    null,
    'mutation-warning-acknowledged'
  );

  if result ->> 'status' <> 'saved' then
    raise exception 'Expected the acknowledged overload to be saved.';
  end if;

  if result #>> '{override,warningAcknowledgements,0,acknowledgedByProfileId}'
    <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then
    raise exception 'Expected the server to own acknowledgement identity.';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(
      result #> '{override,warningAcknowledgements}'
    ) acknowledgement
    where acknowledgement.value ->> 'warningType' = 'over_max_load'
      and acknowledgement.value ->> 'message' =
        'Blake has 2 assigned patients, above their max load of 1.'
  ) then
    raise exception 'Expected the server-generated max-load message.';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(
      result #> '{override,warningAcknowledgements}'
    ) acknowledgement
    where acknowledgement.value ->> 'warningType' = 'over_side_load_limit'
      and acknowledgement.value ->> 'message' =
        'Blake has 2 assigned patients, above the side load limit of 1.'
  ) then
    raise exception 'Expected the server-generated side-load message.';
  end if;
end;
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as 'select ''22222222-2222-4222-8222-222222222222''::uuid';

do $$
begin
  perform public.confirm_manual_assignment_override(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'baseline-1',
    'bed-a',
    'nurse-b',
    'nurse-a',
    '[]'::jsonb,
    null,
    'mutation-wrong-owner'
  );
  raise exception 'Expected an unrelated charge account to fail.';
exception
  when others then
    if sqlerrm not like '%belongs to another charge nurse%' then
      raise;
    end if;
end;
$$;

rollback;
