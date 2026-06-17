# Phase 5 Supabase Auth Setup

Use this setup for Tasks 1.3, 1.4, and 1.5 so signup, login, profile loading, session restore, and sign out can be tested manually.

This is only the auth/profile setup. It does not add floor template tables, active shift tables, realtime, invite links, push notifications, offline sync, or AI.

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

## Signup Note

The app defaults new signups to the `charge_nurse` role for Phase 5 testing.

If email confirmation is enabled in Supabase and signup does not immediately create a session, confirm the email first, then sign in. The app stores the display name and role in auth metadata and creates the matching `profiles` row during login if needed.
