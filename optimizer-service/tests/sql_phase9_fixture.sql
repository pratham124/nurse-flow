\set ON_ERROR_STOP on

-- Minimal disposable schema needed to execute the Phase 9 SQL outside Supabase.
-- This file is test infrastructure only; production uses the real Phase 5-8
-- tables and Supabase-provided auth functions/roles.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
$$;

create schema if not exists auth;
create schema if not exists extensions;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.test_uid', true), '')::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.test_role', true), '')
$$;

create table public.profiles (
  id uuid primary key,
  auth_user_id uuid not null unique,
  role text not null
);

create table public.active_shifts (
  id uuid primary key,
  charge_profile_id uuid not null references public.profiles(id),
  status text not null check (status in ('setup', 'assigned')),
  shift_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.manual_assignment_overrides (
  id uuid primary key,
  shift_id uuid not null references public.active_shifts(id),
  status text not null check (status in ('active', 'superseded')),
  superseded_at timestamptz
);
