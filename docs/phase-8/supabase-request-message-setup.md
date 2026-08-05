# Phase 8 Request-Message Server Setup

Use this setup for Phase 8 Task 2.1 after the Phase 5 server workspace, Phase 6
nurse access, and Phase 6 live request functions are installed.

This task adds an append-only message record and two focused server actions. It
does not add realtime thread refresh, a composer, request lifecycle changes,
attachments, read receipts, offline writes, or notification events. Request
metadata remains in `active_shifts.shift_snapshot.nurseRequests`; message bodies
live only in `nurse_request_messages` and are never copied into notification
payloads.

## Record and Indexes

Messages use the existing request's text ID because Phase 6 request IDs are
embedded in the shift snapshot rather than stored in a relational request
table. The `(shift_id, request_id)` pair is revalidated against that snapshot by
every server action.

```sql
create table if not exists public.nurse_request_messages (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.active_shifts(id) on delete cascade,
  request_id text not null,
  author_profile_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (
    char_length(body) between 1 and 1000
    and body = btrim(body)
  ),
  created_at timestamptz not null default now(),
  client_mutation_id text check (
    client_mutation_id is null
    or (
      char_length(client_mutation_id) between 1 and 120
      and client_mutation_id = btrim(client_mutation_id)
    )
  )
);

-- Safe cleanup when replacing the earlier Task 2.1 draft.
drop policy if exists "Thread participants can read request messages"
on public.nurse_request_messages;

drop function if exists public.append_nurse_request_message(
  uuid,
  text,
  text,
  text
);

drop function if exists public.list_nurse_request_messages(uuid, text);
drop function if exists public.get_nurse_request_thread_actor(uuid, text);

alter table public.nurse_request_messages
drop column if exists author_role;

create index if not exists nurse_request_messages_thread_order_idx
on public.nurse_request_messages (
  shift_id,
  request_id,
  created_at,
  id
);

create unique index if not exists nurse_request_messages_author_mutation_idx
on public.nurse_request_messages (
  shift_id,
  author_profile_id,
  client_mutation_id
)
where client_mutation_id is not null;

alter table public.nurse_request_messages enable row level security;

revoke all on table public.nurse_request_messages
from public, anon, authenticated;
```

The chronological index supports one narrow thread read. The partial unique
index makes a retry key idempotent without requiring every historical message
to have one.

## Shared Request-Thread Authorization

This helper finds the request inside the server-fresh shift snapshot and returns
the verified caller's profile ID. The client cannot submit an author profile.
An ended shift, removed nurse access, missing request, or signed-out session
returns `null`.

```sql
create or replace function public.get_nurse_request_thread_actor(
  p_shift_id uuid,
  p_request_id text
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid;
  request_nurse_id text;
  shift_owner_profile_id uuid;
begin
  select profile.id
  into current_profile_id
  from public.profiles profile
  where profile.auth_user_id = auth.uid()
  limit 1;

  if current_profile_id is null then
    return null;
  end if;

  select
    active_shift.charge_profile_id,
    request_item.value ->> 'requestingNurseId'
  into shift_owner_profile_id, request_nurse_id
  from public.active_shifts active_shift
  cross join lateral jsonb_array_elements(
    coalesce(active_shift.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
  ) request_item(value)
  where active_shift.id = p_shift_id
    and active_shift.ended_at is null
    and request_item.value ->> 'id' = btrim(p_request_id)
  limit 1;

  if not found or coalesce(request_nurse_id, '') = '' then
    return null;
  end if;

  if shift_owner_profile_id = current_profile_id then
    return current_profile_id;
  end if;

  if exists (
    select 1
    from public.shift_nurse_access access
    where access.shift_id = p_shift_id
      and access.nurse_id = request_nurse_id
      and access.nurse_profile_id = current_profile_id
      and access.status = 'linked'
  ) then
    return current_profile_id;
  end if;

  return null;
end;
$$;

revoke all on function public.get_nurse_request_thread_actor(uuid, text)
from public, anon;

grant execute on function public.get_nurse_request_thread_actor(uuid, text)
to authenticated;
```

The table remains insert-, update-, and delete-inaccessible to app clients.
Authenticated clients receive only authorized `select` access so a later task
can enable narrow Realtime delivery without weakening this model.

```sql
drop policy if exists "Thread participants can read request messages"
on public.nurse_request_messages;

create policy "Thread participants can read request messages"
on public.nurse_request_messages
for select
to authenticated
using (
  public.get_nurse_request_thread_actor(shift_id, request_id) is not null
);

grant select on table public.nurse_request_messages to authenticated;
```

Do not create insert, update, or delete policies. Phase 8 messages are
append-only and inserts go through the action below.

## List Messages Action

The list action authorizes the requested thread first and returns only that
thread in stable chronological order.

```sql
create or replace function public.list_nurse_request_messages(
  p_shift_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  messages jsonb;
  normalized_request_id text := btrim(p_request_id);
begin
  if coalesce(normalized_request_id, '') = '' then
    raise exception 'Choose a nurse request before loading messages.';
  end if;

  if public.get_nurse_request_thread_actor(
    p_shift_id,
    normalized_request_id
  ) is null then
    raise exception 'You do not have access to this request thread.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', message.id,
        'shiftId', message.shift_id,
        'requestId', message.request_id,
        'authorProfileId', message.author_profile_id,
        'body', message.body,
        'createdAt', message.created_at,
        'clientMutationId', message.client_mutation_id
      )
      order by message.created_at, message.id
    ),
    '[]'::jsonb
  )
  into messages
  from public.nurse_request_messages message
  where message.shift_id = p_shift_id
    and message.request_id = normalized_request_id;

  return messages;
end;
$$;

revoke all on function public.list_nurse_request_messages(uuid, text)
from public, anon;

grant execute on function public.list_nurse_request_messages(uuid, text)
to authenticated;
```

## Append Message Action

The action trims and length-checks the body, derives the author from the
session, and inserts with server time. Reusing the same mutation ID with the
same request and body returns the original row as `duplicate`; it never inserts
a second message. Reusing a key for different content is rejected.

```sql
create or replace function public.append_nurse_request_message(
  p_shift_id uuid,
  p_request_id text,
  p_body text,
  p_client_mutation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  duplicate_message boolean := false;
  normalized_mutation_id text := nullif(btrim(p_client_mutation_id), '');
  normalized_request_id text := btrim(p_request_id);
  saved_message public.nurse_request_messages%rowtype;
  trimmed_body text := btrim(p_body);
begin
  if coalesce(normalized_request_id, '') = '' then
    raise exception 'Choose a nurse request before sending a message.';
  end if;

  if coalesce(trimmed_body, '') = '' then
    raise exception 'Write a message before sending.';
  end if;

  if char_length(trimmed_body) > 1000 then
    raise exception 'Keep messages to 1000 characters or fewer.';
  end if;

  if normalized_mutation_id is not null
    and char_length(normalized_mutation_id) > 120 then
    raise exception 'Message retry identifiers must be 120 characters or fewer.';
  end if;

  actor_profile_id := public.get_nurse_request_thread_actor(
    p_shift_id,
    normalized_request_id
  );

  if actor_profile_id is null then
    raise exception 'You do not have access to this request thread.';
  end if;

  if normalized_mutation_id is not null then
    select message.*
    into saved_message
    from public.nurse_request_messages message
    where message.shift_id = p_shift_id
      and message.author_profile_id = actor_profile_id
      and message.client_mutation_id = normalized_mutation_id;

    if found then
      if saved_message.request_id <> normalized_request_id
        or saved_message.body <> trimmed_body then
        raise exception 'That message retry identifier was already used.';
      end if;

      duplicate_message := true;
    end if;
  end if;

  if not duplicate_message then
    begin
      insert into public.nurse_request_messages (
        shift_id,
        request_id,
        author_profile_id,
        body,
        client_mutation_id
      )
      values (
        p_shift_id,
        normalized_request_id,
        actor_profile_id,
        trimmed_body,
        normalized_mutation_id
      )
      returning * into saved_message;
    exception
      when unique_violation then
        if normalized_mutation_id is null then
          raise;
        end if;

        select message.*
        into saved_message
        from public.nurse_request_messages message
        where message.shift_id = p_shift_id
          and message.author_profile_id = actor_profile_id
          and message.client_mutation_id = normalized_mutation_id;

        if not found
          or saved_message.request_id <> normalized_request_id
          or saved_message.body <> trimmed_body then
          raise exception 'That message retry identifier was already used.';
        end if;

        duplicate_message := true;
    end;
  end if;

  return jsonb_build_object(
    'status', case when duplicate_message then 'duplicate' else 'saved' end,
    'message', jsonb_build_object(
      'id', saved_message.id,
      'shiftId', saved_message.shift_id,
      'requestId', saved_message.request_id,
      'authorProfileId', saved_message.author_profile_id,
      'body', saved_message.body,
      'createdAt', saved_message.created_at,
      'clientMutationId', saved_message.client_mutation_id
    )
  );
end;
$$;

revoke all on function public.append_nurse_request_message(
  uuid,
  text,
  text,
  text
) from public, anon;

grant execute on function public.append_nurse_request_message(
  uuid,
  text,
  text,
  text
) to authenticated;
```

## Manual Server Checks

Run `tests/requestMessage.sql` in a development database after installing this
setup. It verifies:

1. The owning charge and request's linked nurse read the same ordered thread.
2. The server derives the author profile from the signed-in session rather than
   accepting an author ID from the client.
3. Another linked nurse, another charge owner, and a signed-out caller are
   denied.
4. Blank messages and mutation-key collisions are rejected.
5. Retrying the same mutation returns `duplicate` and leaves one row.

## Task 2.2 Private Realtime Broadcast

Task 2.2 uses Supabase's recommended Database Broadcast path. The database
sends pointer-only events to private topics, and each authorized client
refetches through its existing narrow server boundary.

The authorization helper recognizes three topic shapes:

- `nurseflow:active-shift:<shiftId>` for the owning charge nurse.
- `nurseflow:nurse-access:<shiftId>:<accessId>` for the linked nurse profile.
- `nurseflow:request-thread:<shiftId>:<requestId>` for the charge owner or the
  request's linked nurse.

```sql
create or replace function public.can_receive_nurseflow_broadcast(
  p_topic text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid;
  target_access_id uuid;
  target_request_id text;
  target_shift_id uuid;
  topic_parts text[] := string_to_array(coalesce(p_topic, ''), ':');
begin
  if cardinality(topic_parts) < 3 or topic_parts[1] <> 'nurseflow' then
    return false;
  end if;

  select profile.id
  into current_profile_id
  from public.profiles profile
  where profile.auth_user_id = auth.uid()
  limit 1;

  if current_profile_id is null then
    return false;
  end if;

  begin
    target_shift_id := topic_parts[3]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if topic_parts[2] = 'active-shift'
    and cardinality(topic_parts) = 3 then
    return exists (
      select 1
      from public.active_shifts active_shift
      join public.profiles profile
        on profile.id = active_shift.charge_profile_id
      where active_shift.id = target_shift_id
        and profile.id = current_profile_id
        and profile.role = 'charge_nurse'
    );
  end if;

  if topic_parts[2] = 'nurse-access'
    and cardinality(topic_parts) = 4 then
    begin
      target_access_id := topic_parts[4]::uuid;
    exception when invalid_text_representation then
      return false;
    end;

    return exists (
      select 1
      from public.shift_nurse_access access
      where access.id = target_access_id
        and access.shift_id = target_shift_id
        and access.nurse_profile_id = current_profile_id
    );
  end if;

  if topic_parts[2] = 'request-thread'
    and cardinality(topic_parts) = 4 then
    target_request_id := topic_parts[4];

    return public.get_nurse_request_thread_actor(
      target_shift_id,
      target_request_id
    ) = current_profile_id;
  end if;

  return false;
end;
$$;

revoke all on function public.can_receive_nurseflow_broadcast(text)
from public, anon;

grant execute on function public.can_receive_nurseflow_broadcast(text)
to authenticated;

drop policy if exists "NurseFlow users can receive scoped broadcasts"
on realtime.messages;

create policy "NurseFlow users can receive scoped broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and public.can_receive_nurseflow_broadcast(
    (select realtime.topic())
  )
);
```

The active-shift trigger wakes the owning charge topic and every nurse-access
topic for that shift. It sends identifiers only, never the shift snapshot.

```sql
create or replace function public.broadcast_nurseflow_active_shift_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_row record;
begin
  perform realtime.send(
    jsonb_build_object('shiftId', new.id),
    'active-shift-changed',
    'nurseflow:active-shift:' || new.id::text,
    true
  );

  for access_row in
    select access.id
    from public.shift_nurse_access access
    where access.shift_id = new.id
  loop
    perform realtime.send(
      jsonb_build_object(
        'accessId', access_row.id,
        'shiftId', new.id
      ),
      'active-shift-changed',
      'nurseflow:nurse-access:' || new.id::text || ':' ||
        access_row.id::text,
      true
    );
  end loop;

  return null;
end;
$$;

revoke all on function public.broadcast_nurseflow_active_shift_change()
from public, anon, authenticated;

drop trigger if exists broadcast_nurseflow_active_shift_change
on public.active_shifts;

create trigger broadcast_nurseflow_active_shift_change
after update on public.active_shifts
for each row
execute function public.broadcast_nurseflow_active_shift_change();
```

Access changes use the same nurse-scoped topic so removed access reaches an
already-connected nurse and moves the app to its safe state.

```sql
create or replace function public.broadcast_nurseflow_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'accessId', new.id,
      'shiftId', new.shift_id
    ),
    'nurse-access-changed',
    'nurseflow:nurse-access:' || new.shift_id::text || ':' || new.id::text,
    true
  );

  return null;
end;
$$;

revoke all on function public.broadcast_nurseflow_access_change()
from public, anon, authenticated;

drop trigger if exists broadcast_nurseflow_access_change
on public.shift_nurse_access;

create trigger broadcast_nurseflow_access_change
after update on public.shift_nurse_access
for each row
execute function public.broadcast_nurseflow_access_change();
```

Request-message inserts emit only shift, request, and message IDs. The message
body remains available only through the authorized list RPC.

```sql
create or replace function public.broadcast_nurseflow_request_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'messageId', new.id,
      'requestId', new.request_id,
      'shiftId', new.shift_id
    ),
    'request-message-inserted',
    'nurseflow:request-thread:' || new.shift_id::text || ':' ||
      new.request_id,
    true
  );

  return null;
end;
$$;

revoke all on function public.broadcast_nurseflow_request_message()
from public, anon, authenticated;

drop trigger if exists broadcast_nurseflow_request_message
on public.nurse_request_messages;

create trigger broadcast_nurseflow_request_message
after insert on public.nurse_request_messages
for each row
execute function public.broadcast_nurseflow_request_message();
```

Opening a screen starts one private topic listener; leaving removes that
channel. Broadcast events remain refetch signals rather than a second app data
store or notification payload.
