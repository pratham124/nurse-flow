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
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '33333333-3333-4333-8333-333333333333',
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
    "floorName": "4 West",
    "admittingDoctorSideId": "side-1",
    "sideLoadLimits": {
      "admitting": { "min": 1, "max": 3 },
      "nonAdmitting": { "min": 1, "max": 3 }
    },
    "doctorSides": [
      { "id": "side-1", "name": "Hospitalist A" }
    ],
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
      { "id": "nurse-a", "name": "Avery", "licenseType": "RN", "maxPatientLoad": 3 },
      { "id": "nurse-b", "name": "Blake", "licenseType": "RN", "maxPatientLoad": 3 }
    ],
    "flags": [],
    "nurseRequests": [
      {
        "id": "issue-1",
        "type": "issue",
        "status": "pending",
        "requestingNurseId": "nurse-a",
        "requestingNurseName": "Avery",
        "message": "Please review this issue.",
        "createdAt": "2026-08-08T12:00:00Z"
      },
      {
        "id": "swap-1",
        "type": "swap",
        "status": "accepted",
        "requestingNurseId": "nurse-a",
        "requestingNurseName": "Avery",
        "message": "Please move bed A.",
        "sourceBedId": "bed-a",
        "createdAt": "2026-08-08T12:05:00Z"
      },
      {
        "id": "swap-2",
        "type": "swap",
        "status": "accepted",
        "requestingNurseId": "nurse-b",
        "requestingNurseName": "Blake",
        "message": "Please move bed A back.",
        "sourceBedId": "bed-a",
        "createdAt": "2026-08-08T12:10:00Z"
      }
    ],
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

insert into public.shift_nurse_access (
  id,
  shift_id,
  nurse_id,
  nurse_name,
  nurse_profile_id,
  status
)
values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'nurse-a',
  'Avery',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'linked'
);

insert into public.device_push_tokens (
  profile_id,
  device_id,
  platform,
  push_token,
  status,
  permission_status
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000001',
    'ios',
    'ExponentPushToken[charge]',
    'active',
    'granted'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '10000000-0000-4000-8000-000000000002',
    'ios',
    'ExponentPushToken[nurse]',
    'active',
    'granted'
  );

do $$
declare
  assignment_before jsonb;
  issue_request jsonb;
begin
  select shift_snapshot -> 'assignmentResult'
  into assignment_before
  from public.active_shifts
  where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  perform public.update_shift_nurse_issue_status('issue-1', 'reviewed');

  select request_item.value
  into issue_request
  from public.active_shifts active_shift
  cross join lateral jsonb_array_elements(
    active_shift.shift_snapshot -> 'nurseRequests'
  ) request_item
  where active_shift.id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    and request_item.value ->> 'id' = 'issue-1';

  if issue_request ->> 'issueReviewStatus' <> 'reviewed'
    or coalesce(issue_request ->> 'reviewedAt', '') = ''
    or coalesce(issue_request ->> 'reviewedByProfileId', '') <>
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then
    raise exception 'Expected the issue to be reviewed by the charge profile.';
  end if;

  if (
    select shift_snapshot -> 'assignmentResult'
    from public.active_shifts
    where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  ) is distinct from assignment_before then
    raise exception 'Issue review changed assignment data.';
  end if;

  perform public.update_shift_nurse_issue_status('issue-1', 'resolved');
  perform public.update_shift_nurse_issue_status('issue-1', 'open');

  select request_item.value
  into issue_request
  from public.active_shifts active_shift
  cross join lateral jsonb_array_elements(
    active_shift.shift_snapshot -> 'nurseRequests'
  ) request_item
  where active_shift.id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    and request_item.value ->> 'id' = 'issue-1';

  if issue_request ->> 'issueReviewStatus' <> 'open'
    or issue_request ? 'reviewedAt'
    or issue_request ? 'issueResolvedAt' then
    raise exception 'Expected reopening to start a clean open lifecycle.';
  end if;
end;
$$;

do $$
declare
  result jsonb;
  swap_request jsonb;
begin
  result := public.confirm_manual_assignment_override(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'baseline-1',
    'bed-a',
    'nurse-a',
    'nurse-b',
    '[]'::jsonb,
    'swap-1',
    'mutation-complete-swap'
  );

  if result ->> 'status' <> 'saved' then
    raise exception 'Expected the accepted swap move to save.';
  end if;

  select request_item.value
  into swap_request
  from public.active_shifts active_shift
  cross join lateral jsonb_array_elements(
    active_shift.shift_snapshot -> 'nurseRequests'
  ) request_item
  where active_shift.id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    and request_item.value ->> 'id' = 'swap-1';

  if coalesce(swap_request ->> 'completedOverrideId', '') = ''
    or coalesce(swap_request ->> 'swapCompletedAt', '') = ''
    or swap_request ->> 'swapCompletedByProfileId' <>
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then
    raise exception 'Expected atomic swap completion metadata.';
  end if;

  if not exists (
    select 1
    from public.manual_assignment_overrides override_row
    where override_row.id::text = swap_request ->> 'completedOverrideId'
      and override_row.related_swap_request_id = 'swap-1'
  ) then
    raise exception 'Expected the request to link to its saved override.';
  end if;
end;
$$;

do $$
begin
  perform public.confirm_manual_assignment_override(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'baseline-1',
    'bed-a',
    'nurse-b',
    'nurse-a',
    '[]'::jsonb,
    'swap-2',
    'mutation-complete-later-swap'
  );
end;
$$;

do $$
declare
  completed_request_count integer;
  active_related_request_id text;
begin
  select count(*)
  into completed_request_count
  from public.active_shifts active_shift
  cross join lateral jsonb_array_elements(
    active_shift.shift_snapshot -> 'nurseRequests'
  ) request_item
  where active_shift.id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    and request_item.value ->> 'id' in ('swap-1', 'swap-2')
    and coalesce(request_item.value ->> 'completedOverrideId', '') <> '';

  select override_row.related_swap_request_id
  into active_related_request_id
  from public.manual_assignment_overrides override_row
  where override_row.shift_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    and override_row.bed_id = 'bed-a'
    and override_row.superseded_at is null;

  if completed_request_count <> 2 then
    raise exception 'Expected both completed swap histories to remain linked.';
  end if;

  if active_related_request_id <> 'swap-2' then
    raise exception 'Expected only the later completed swap override to remain active.';
  end if;
end;
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as 'select ''22222222-2222-4222-8222-222222222222''::uuid';

do $$
declare
  assignment_view jsonb;
begin
  assignment_view := public.get_joined_nurse_assignment_view();

  if not exists (
    select 1
    from jsonb_array_elements(assignment_view -> 'requestHistory') request_item
    where request_item.value ->> 'id' = 'swap-1'
      and request_item.value ->> 'completedAssignmentChangedLater' = 'true'
  ) then
    raise exception 'Expected the joined view to derive the later assignment change.';
  end if;
end;
$$;

insert into public.nurse_request_messages (
  shift_id,
  request_id,
  author_profile_id,
  body,
  client_mutation_id
)
values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'issue-1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Sensitive message body that must not enter notification copy.',
  'message-notification-test'
);

do $$
begin
  if not exists (
    select 1
    from public.notification_events event
    where event.event_type = 'request_message_added'
      and event.recipient_profile_id =
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and event.related_request_id = 'issue-1'
      and event.recipient_access_id is null
  ) then
    raise exception 'Expected the charge nurse message notification.';
  end if;

  if exists (
    select 1
    from public.notification_events event
    where event.title ilike '%Sensitive message body%'
      or event.body ilike '%Sensitive message body%'
  ) then
    raise exception 'Notification copy leaked the request message body.';
  end if;

  if not exists (
    select 1
    from public.notification_events event
    where event.event_type = 'request_status_changed'
      and event.recipient_profile_id =
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and event.recipient_access_id =
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  ) then
    raise exception 'Expected a nurse-scoped lifecycle notification.';
  end if;
end;
$$;

do $$
begin
  perform public.update_shift_nurse_issue_status('issue-1', 'reviewed');
  raise exception 'Expected a joined nurse issue lifecycle update to fail.';
exception
  when others then
    if sqlerrm not like '%No active charge shift was found%' then
      raise;
    end if;
end;
$$;

rollback;
