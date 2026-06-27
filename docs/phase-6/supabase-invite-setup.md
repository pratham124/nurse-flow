# Phase 6 Nurse Invite Server Setup

Use this setup for Phase 6 Task 2.1 so the server can store nurse invite
records without storing raw invite links.

This setup adds only the invite record model and authorization rules. It does
not add invite link generation, deep link routing, push notifications, offline
queues, conflict resolution, drag-and-drop overrides, board sharing, tablet
layout, or AI.

## Shift Nurse Invite Records

Run this SQL in the Supabase SQL editor after the Phase 5 server workspace and
joined shift access setup already exists.

```sql
create table if not exists public.shift_nurse_invites (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.active_shifts(id) on delete cascade,
  nurse_id text not null,
  created_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null,
  status text not null check (status in ('active', 'used', 'revoked', 'expired')) default 'active',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_profile_id uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  check (char_length(token_hash) >= 32),
  check (expires_at > created_at)
);

create unique index if not exists shift_nurse_invites_one_active_per_nurse
on public.shift_nurse_invites (shift_id, nurse_id)
where status = 'active';

alter table public.shift_nurse_invites enable row level security;

create policy "Charge nurses can read invites for their own shifts"
on public.shift_nurse_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.active_shifts
    join public.profiles
      on profiles.id = active_shifts.charge_profile_id
    where active_shifts.id = shift_nurse_invites.shift_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
);

create policy "Charge nurses can create invites for their own active shifts"
on public.shift_nurse_invites
for insert
to authenticated
with check (
  exists (
    select 1
    from public.active_shifts
    join public.profiles
      on profiles.id = active_shifts.charge_profile_id
    where active_shifts.id = shift_nurse_invites.shift_id
      and active_shifts.ended_at is null
      and profiles.id = shift_nurse_invites.created_by_profile_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
      and exists (
        select 1
        from jsonb_array_elements(
          coalesce(active_shifts.shift_snapshot -> 'nurses', '[]'::jsonb)
        ) nurse
        where nurse ->> 'id' = shift_nurse_invites.nurse_id
      )
  )
);

create policy "Charge nurses can update invites for their own shifts"
on public.shift_nurse_invites
for update
to authenticated
using (
  exists (
    select 1
    from public.active_shifts
    join public.profiles
      on profiles.id = active_shifts.charge_profile_id
    where active_shifts.id = shift_nurse_invites.shift_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
)
with check (
  exists (
    select 1
    from public.active_shifts
    join public.profiles
      on profiles.id = active_shifts.charge_profile_id
    where active_shifts.id = shift_nurse_invites.shift_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
);

create policy "Charge nurses can delete invites for their own shifts"
on public.shift_nurse_invites
for delete
to authenticated
using (
  exists (
    select 1
    from public.active_shifts
    join public.profiles
      on profiles.id = active_shifts.charge_profile_id
    where active_shifts.id = shift_nurse_invites.shift_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
);
```

## Manual Validation

1. Sign in as the charge nurse who owns an active shift.
2. Create one invite record for a nurse whose `id` exists in
   `active_shifts.shift_snapshot -> 'nurses'`.
3. Confirm creating a second `active` invite for the same `shift_id` and
   `nurse_id` fails because of the partial unique index.
4. Sign in as a different charge nurse and confirm the same insert fails.
5. Sign in as a joined nurse profile and confirm selecting from
   `shift_nurse_invites` returns no rows.

The `token_hash` value should be a verifier for a future raw invite token. The
raw invite token or full invite URL should not be saved in this table.

## Nurse Code Validation RPC

Run this after the invite table exists. The app uses this function for Phase 6
Task 3.2 so a signed-in user can validate a 6-character code without receiving
the full active shift or listing invite records.

```sql
create or replace function public.validate_shift_nurse_invite_code(
  invite_token_hash text
)
returns table (
  status text,
  reason text,
  invite_id uuid,
  shift_id uuid,
  nurse_id text,
  nurse_name text,
  floor_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid;
  existing_access record;
  invite_row public.shift_nurse_invites%rowtype;
  nurse_snapshot jsonb;
  shift_row public.active_shifts%rowtype;
begin
  select id
  into current_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if current_profile_id is null then
    return query select
      'blocked', 'not_found', null::uuid, null::uuid,
      null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  select *
  into invite_row
  from public.shift_nurse_invites
  where token_hash = invite_token_hash
  order by created_at desc
  limit 1;

  if not found then
    return query select
      'blocked', 'not_found', null::uuid, null::uuid,
      null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  if invite_row.status = 'revoked' then
    return query select
      'blocked', 'revoked', invite_row.id, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text, invite_row.expires_at;
    return;
  end if;

  if invite_row.status = 'used' then
    return query select
      'blocked', 'already_used', invite_row.id, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text, invite_row.expires_at;
    return;
  end if;

  if invite_row.status = 'expired' or invite_row.expires_at <= now() then
    return query select
      'blocked', 'expired', invite_row.id, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text, invite_row.expires_at;
    return;
  end if;

  select *
  into shift_row
  from public.active_shifts
  where id = invite_row.shift_id;

  if not found or shift_row.ended_at is not null then
    return query select
      'blocked', 'ended_shift', invite_row.id, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text, invite_row.expires_at;
    return;
  end if;

  select nurse
  into nurse_snapshot
  from jsonb_array_elements(
    coalesce(shift_row.shift_snapshot -> 'nurses', '[]'::jsonb)
  ) nurse
  where nurse ->> 'id' = invite_row.nurse_id
  limit 1;

  if nurse_snapshot is null then
    return query select
      'blocked', 'stale_nurse', invite_row.id, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text, invite_row.expires_at;
    return;
  end if;

  select access.shift_id, access.nurse_id
  into existing_access
  from public.shift_nurse_access access
  join public.active_shifts active_shift
    on active_shift.id = access.shift_id
  where access.nurse_profile_id = current_profile_id
    and access.status = 'linked'
    and active_shift.ended_at is null
  limit 1;

  if found and (
    existing_access.shift_id <> invite_row.shift_id or
    existing_access.nurse_id <> invite_row.nurse_id
  ) then
    return query select
      'blocked', 'participation_conflict', invite_row.id, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text, invite_row.expires_at;
    return;
  end if;

  return query select
    'valid',
    null::text,
    invite_row.id,
    invite_row.shift_id,
    invite_row.nurse_id,
    nurse_snapshot ->> 'name',
    shift_row.shift_snapshot ->> 'floorName',
    invite_row.expires_at;
end;
$$;

grant execute on function public.validate_shift_nurse_invite_code(text)
to authenticated;
```

Validation checks:

1. A valid active code returns `status = valid`, the invited nurse name, and the
   floor name only.
2. Expired, revoked, used, ended-shift, stale-nurse, and participation-conflict
   cases return `status = blocked` with a plain reason.
3. The function does not return patient details, assignments, room data, or the
   raw invite code.
