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
