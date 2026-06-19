# Phase 5 Supabase Auth Setup

Use this setup for Tasks 1.3, 1.4, and 1.5 so signup, login, profile loading, session restore, and sign out can be tested manually. It also includes the small server workspace tables needed for Tasks 2.1, 2.2, 2.3, 3.1, 3.2, 3.2a, and 3.3.

This setup does not add realtime, invite links, deep links, push notifications, offline sync, drag-and-drop override, board sharing, tablet layout, or AI.

## Required App Environment

Create a local `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Restart Expo after changing `.env`:

```powershell
npx expo start -c
```

Do not put Supabase secret keys or service role keys in the Expo app.

## Profiles Table

Run this SQL in the Supabase SQL editor:

```sql
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('charge_nurse', 'regular_nurse')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles can be read by their owner"
on public.profiles
for select
to authenticated
using (auth.uid() = auth_user_id);

create policy "Profiles can be created by their owner"
on public.profiles
for insert
to authenticated
with check (auth.uid() = auth_user_id);

create policy "Profiles can be updated by their owner"
on public.profiles
for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);
```

## Server Workspace Tables

Run this SQL for Tasks 2.1, 2.2, 2.3, 3.1, 3.2, 3.2a, and 3.3 so the signed-in charge nurse can load an empty server workspace, save reusable floor templates, start an active shift, save active-shift changes, and restore the active shift on app open.

These tables still use normal request/response reads and writes only. They do not enable realtime, invite links, deep links, push notifications, offline queues, drag-and-drop overrides, board sharing, tablet layout, or AI.

```sql
create table if not exists public.floor_templates (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  template_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.active_shifts (
  id uuid primary key default gen_random_uuid(),
  charge_profile_id uuid not null references public.profiles(id) on delete cascade,
  floor_template_id uuid references public.floor_templates(id) on delete set null,
  status text not null check (status in ('setup', 'assigned')),
  shift_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.previous_shift_snapshots (
  id uuid primary key default gen_random_uuid(),
  charge_profile_id uuid not null references public.profiles(id) on delete cascade,
  floor_template_id uuid references public.floor_templates(id) on delete cascade,
  completed_at timestamptz not null,
  nurse_suggestions jsonb not null default '[]'::jsonb,
  patient_suggestions jsonb not null default '[]'::jsonb
);

alter table public.floor_templates enable row level security;
alter table public.active_shifts enable row level security;
alter table public.previous_shift_snapshots enable row level security;

create policy "Charge nurses can read their own templates"
on public.floor_templates
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = floor_templates.owner_profile_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
);

create policy "Charge nurses can create their own templates"
on public.floor_templates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = floor_templates.owner_profile_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
);

create policy "Charge nurses can update their own templates"
on public.floor_templates
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = floor_templates.owner_profile_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = floor_templates.owner_profile_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
);

create policy "Charge nurses can read their own active shifts"
on public.active_shifts
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = active_shifts.charge_profile_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
);

create policy "Charge nurses can create their own active shifts"
on public.active_shifts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = active_shifts.charge_profile_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
);

create policy "Charge nurses can update their own active shifts"
on public.active_shifts
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = active_shifts.charge_profile_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = active_shifts.charge_profile_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
);

create policy "Charge nurses can read their own previous snapshots"
on public.previous_shift_snapshots
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = previous_shift_snapshots.charge_profile_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
);
```

## Signup Note

The app defaults new signups to the `charge_nurse` role for Phase 5 testing.

If email confirmation is enabled in Supabase and signup does not immediately create a session, confirm the email first, then sign in. The app stores the display name and role in auth metadata and creates the matching `profiles` row during login if needed.
