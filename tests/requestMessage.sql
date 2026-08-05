begin;

create schema if not exists auth;

-- The local SQL harnesses use reduced copies of earlier-phase tables. These
-- transactional additions are no-ops in a fully installed NurseFlow database.
alter table public.profiles
add column if not exists auth_user_id uuid;

alter table public.profiles
add column if not exists role text;

alter table public.active_shifts
add column if not exists status text;

alter table public.shift_nurse_access
add column if not exists nurse_name text;

create or replace function auth.uid()
returns uuid
language sql
stable
as 'select ''11111111-1111-4111-8111-111111111111''::uuid';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'nurse_request_messages'
      and column_name = 'author_role'
  ) then
    raise exception 'Request messages should not persist an author role.';
  end if;
end;
$$;

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
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    '44444444-4444-4444-8444-444444444444',
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
    "floorName": "4 North",
    "nurses": [
      { "id": "nurse-a", "name": "Avery" },
      { "id": "nurse-b", "name": "Blake" }
    ],
    "nurseRequests": [
      {
        "id": "nurse-request-1",
        "type": "issue",
        "status": "pending",
        "requestingNurseId": "nurse-a",
        "requestingNurseName": "Avery",
        "message": "Need help with this assignment",
        "createdAt": "2026-08-05T12:00:00.000Z"
      }
    ]
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
values
  (
    '12121212-1212-4121-8121-121212121212',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'nurse-a',
    'Avery',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'linked'
  ),
  (
    '34343434-3434-4343-8343-343434343434',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'nurse-b',
    'Blake',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'linked'
  );

do $$
declare
  result jsonb;
begin
  result := public.append_nurse_request_message(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'nurse-request-1',
    '  I can review this now.  ',
    'charge-message-1'
  );

  if result ->> 'status' <> 'saved' then
    raise exception 'Expected the charge message to be saved.';
  end if;

  if result #>> '{message,authorProfileId}'
      <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    or result #>> '{message,body}' <> 'I can review this now.' then
    raise exception 'Expected the server-derived author and trimmed body.';
  end if;
end;
$$;

do $$
declare
  result jsonb;
begin
  result := public.append_nurse_request_message(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'nurse-request-1',
    'I can review this now.',
    'charge-message-1'
  );

  if result ->> 'status' <> 'duplicate' then
    raise exception 'Expected an identical retry to return duplicate.';
  end if;

  if (
    select count(*)
    from public.nurse_request_messages
    where shift_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      and request_id = 'nurse-request-1'
  ) <> 1 then
    raise exception 'An identical retry inserted another message.';
  end if;
end;
$$;

do $$
begin
  perform public.append_nurse_request_message(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'nurse-request-1',
    'Different content',
    'charge-message-1'
  );
  raise exception 'Expected a mutation-key collision to fail.';
exception
  when others then
    if sqlerrm not like '%retry identifier was already used%' then
      raise;
    end if;
end;
$$;

do $$
begin
  perform public.append_nurse_request_message(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'nurse-request-1',
    '   ',
    'blank-message'
  );
  raise exception 'Expected a blank message to fail.';
exception
  when others then
    if sqlerrm not like '%Write a message before sending%' then
      raise;
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
  result jsonb;
  thread jsonb;
begin
  thread := public.list_nurse_request_messages(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'nurse-request-1'
  );

  if jsonb_array_length(thread) <> 1
    or thread #>> '{0,body}' <> 'I can review this now.' then
    raise exception 'Expected the requesting nurse to read the charge message.';
  end if;

  result := public.append_nurse_request_message(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'nurse-request-1',
    'Thank you.',
    'nurse-message-1'
  );

  if result #>> '{message,authorProfileId}'
      <> 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' then
    raise exception 'Expected the server to derive the requesting profile.';
  end if;

  thread := public.list_nurse_request_messages(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'nurse-request-1'
  );

  if jsonb_array_length(thread) <> 2 then
    raise exception 'Expected both participants to read the same thread.';
  end if;
end;
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as 'select ''33333333-3333-4333-8333-333333333333''::uuid';

do $$
begin
  perform public.list_nurse_request_messages(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'nurse-request-1'
  );
  raise exception 'Expected another linked nurse to be denied.';
exception
  when others then
    if sqlerrm not like '%do not have access%' then
      raise;
    end if;
end;
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as 'select ''44444444-4444-4444-8444-444444444444''::uuid';

do $$
begin
  perform public.append_nurse_request_message(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'nurse-request-1',
    'Unauthorized',
    'other-charge-message'
  );
  raise exception 'Expected another charge account to be denied.';
exception
  when others then
    if sqlerrm not like '%do not have access%' then
      raise;
    end if;
end;
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as 'select null::uuid';

do $$
begin
  perform public.list_nurse_request_messages(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'nurse-request-1'
  );
  raise exception 'Expected a signed-out caller to be denied.';
exception
  when others then
    if sqlerrm not like '%do not have access%' then
      raise;
    end if;
end;
$$;

rollback;
