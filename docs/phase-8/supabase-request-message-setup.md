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

## Task 2.2 Realtime Publication

Task 2.2 has two realtime paths:

- A new issue or swap updates `active_shifts.shift_snapshot`, so the charge
  workspace listener needs `active_shifts` in the publication.
- A conversation reply inserts into `nurse_request_messages`, so the open
  request thread needs that table in the publication.

Run this block once to enable both paths safely. Each check makes the setup
idempotent when a table was enabled during an earlier phase:

```sql
do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'active_shifts'
  ) then
    alter publication supabase_realtime
    add table public.active_shifts;
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'nurse_request_messages'
  ) then
    alter publication supabase_realtime
    add table public.nurse_request_messages;
  end if;
end;
$$;
```

Confirm both tables are enabled:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('active_shifts', 'nurse_request_messages')
order by tablename;
```

The result should contain two rows, one for each table.

The subscription filter uses only the current request ID, and the existing RLS
policy authorizes each delivered row. Opening a screen starts one listener;
leaving it removes that channel. A Realtime event is only a refetch signal, not
a second message store.

Before notification work, verify every event payload remains a pointer
containing IDs and safe display text only, never `body` from this table.
