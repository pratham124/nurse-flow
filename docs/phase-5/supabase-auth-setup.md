# Phase 5 Supabase Auth Setup

Use this setup for Tasks 1.3, 1.4, and 1.5 so signup, login, profile loading, session restore, and sign out can be tested manually. It also includes the small server workspace tables needed for Tasks 2.1, 2.2, 2.3, 3.1, 3.2, 3.2a, 3.3, 3.4, 4.1, 4.2, 4.3, and 4.4.

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
  role text not null check (role in ('charge_nurse')),
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

Run this SQL for Tasks 2.1, 2.2, 2.3, 3.1, 3.2, 3.2a, 3.3, and 3.4 so the signed-in charge nurse can load an empty server workspace, save reusable floor templates, start an active shift, save active-shift changes, restore the active shift on app open, and save previous-shift carry-over suggestions.

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

create policy "Charge nurses can create their own previous snapshots"
on public.previous_shift_snapshots
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = previous_shift_snapshots.charge_profile_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
);

create policy "Charge nurses can delete their own previous snapshots"
on public.previous_shift_snapshots
for delete
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

If you previously created manual `regular_nurse` test profiles, convert them back to charge-capable accounts before testing this direction:

```sql
update public.profiles
set role = 'charge_nurse'
where role = 'regular_nurse';
```

## Joined Shift Access Records

Run this SQL for Tasks 4.1, 4.2, 4.3, and 4.4 so a signed-in account can load only its own joined-shift nurse assignment view.

This is an authorization preparation step. It does not add invite links, deep links, realtime presence, push notifications, or self-join behavior. For manual testing, create a normal signed-in profile and insert one linked access record by hand.

The product direction is:

- Every signed-in account is a charge-capable NurseFlow account.
- A user becomes nurse-scoped for one shift by joining that active shift, not by changing their permanent profile role.
- A future `Join active session` screen can create the access record from a unique nurse code.
- An account should have at most one active shift participation at a time. If it is already joined to a shift, it should leave before starting a charge shift or joining another shift.

```sql
create table if not exists public.shift_nurse_access (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.active_shifts(id) on delete cascade,
  nurse_id text not null,
  nurse_name text not null,
  nurse_profile_id uuid references public.profiles(id) on delete set null,
  nurse_email text,
  status text not null check (status in ('pending_link', 'linked', 'removed')) default 'pending_link',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shift_nurse_access enable row level security;

create policy "Charge nurses can manage access for their own shifts"
on public.shift_nurse_access
for all
to authenticated
using (
  exists (
    select 1
    from public.active_shifts
    join public.profiles
      on profiles.id = active_shifts.charge_profile_id
    where active_shifts.id = shift_nurse_access.shift_id
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
    where active_shifts.id = shift_nurse_access.shift_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
);

create policy "Joined users can read their own access row"
on public.shift_nurse_access
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = shift_nurse_access.nurse_profile_id
      and profiles.auth_user_id = auth.uid()
      and profiles.role = 'charge_nurse'
  )
);

create or replace function public.get_joined_nurse_assignment_view()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with signed_in_profile as (
    select id
    from public.profiles
    where auth_user_id = auth.uid()
      and role = 'charge_nurse'
    limit 1
  ),
  linked_access as (
    select
      shift_nurse_access.*,
      active_shifts.shift_snapshot
    from public.shift_nurse_access
    join public.active_shifts
      on active_shifts.id = shift_nurse_access.shift_id
    join signed_in_profile
      on signed_in_profile.id = shift_nurse_access.nurse_profile_id
    where shift_nurse_access.status = 'linked'
      and active_shifts.ended_at is null
    order by shift_nurse_access.updated_at desc
    limit 1
  ),
  assigned_beds as (
    select
      linked_access.id as access_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'bed', bed.value,
            'bedState', bed_state.value,
            'doctorSide', doctor_side.value,
            'room', room.value
          )
        ) filter (where bed.value is not null and room.value is not null and doctor_side.value is not null),
        '[]'::jsonb
      ) as value
    from linked_access
    left join lateral jsonb_array_elements(
      coalesce(linked_access.shift_snapshot #> '{assignmentResult,bedAssignments}', '[]'::jsonb)
    ) assignment on assignment.value ->> 'nurseId' = linked_access.nurse_id
    left join lateral jsonb_array_elements(
      coalesce(linked_access.shift_snapshot -> 'beds', '[]'::jsonb)
    ) bed on bed.value ->> 'id' = assignment.value ->> 'bedId'
    left join lateral jsonb_array_elements(
      coalesce(linked_access.shift_snapshot -> 'rooms', '[]'::jsonb)
    ) room on room.value ->> 'id' = bed.value ->> 'roomId'
    left join lateral jsonb_array_elements(
      coalesce(linked_access.shift_snapshot -> 'doctorSides', '[]'::jsonb)
    ) doctor_side on doctor_side.value ->> 'id' = room.value ->> 'doctorSideId'
    left join lateral jsonb_array_elements(
      coalesce(linked_access.shift_snapshot -> 'bedStates', '[]'::jsonb)
    ) bed_state on bed_state.value ->> 'bedId' = bed.value ->> 'id'
    group by linked_access.id
  ),
  request_history as (
    select
      linked_access.id as access_id,
      coalesce(
        jsonb_agg(request.value) filter (where request.value is not null),
        '[]'::jsonb
      ) as value
    from linked_access
    left join lateral jsonb_array_elements(
      coalesce(linked_access.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
    ) request on request.value ->> 'requestingNurseId' = linked_access.nurse_id
    group by linked_access.id
  ),
  break_entry as (
    select
      linked_access.id as access_id,
      break_entry.value ->> 'startTime' as start_time
    from linked_access
    left join lateral jsonb_array_elements(
      coalesce(linked_access.shift_snapshot #> '{breakSchedule,entries}', '[]'::jsonb)
    ) break_entry on break_entry.value ->> 'nurseId' = linked_access.nurse_id
    limit 1
  )
  select jsonb_build_object(
    'access', jsonb_build_object(
      'id', linked_access.id,
      'shiftId', linked_access.shift_id,
      'nurseId', linked_access.nurse_id,
      'nurseName', linked_access.nurse_name,
      'nurseProfileId', linked_access.nurse_profile_id,
      'nurseEmail', linked_access.nurse_email,
      'status', linked_access.status,
      'createdAt', linked_access.created_at,
      'updatedAt', linked_access.updated_at
    ),
    'shiftId', linked_access.shift_id,
    'floorName', linked_access.shift_snapshot ->> 'floorName',
    'nurseName', linked_access.nurse_name,
    'assignedBeds', assigned_beds.value,
    'breakTimeLabel', break_entry.start_time,
    'requestHistory', request_history.value
  )
  from linked_access
  left join assigned_beds
    on assigned_beds.access_id = linked_access.id
  left join request_history
    on request_history.access_id = linked_access.id
  left join break_entry
    on break_entry.access_id = linked_access.id;
$$;

revoke all on function public.get_joined_nurse_assignment_view() from public;
grant execute on function public.get_joined_nurse_assignment_view() to authenticated;
```

Manual linked-access setup:

1. Create or identify a signed-in user profile.
2. Start a charge nurse shift and add a nurse whose `id` exists inside `active_shifts.shift_snapshot -> 'nurses'`.
3. Insert one `shift_nurse_access` row with that `shift_id`, that `nurse_id`, the nurse name, the user's profile id, and `status = 'linked'`.
4. Sign in as that user and confirm the app shows only that nurse's assignment view.
