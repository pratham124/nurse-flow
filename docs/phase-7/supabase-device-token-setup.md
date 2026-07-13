# Phase 7 Supabase Device Token Setup

Use this setup for Tasks 1.2 and 1.3 so a signed-in device can register an Expo
push token and disable that device record before sign out.

This table stores notification delivery metadata only. It does not store patient
data, active-shift snapshots, notification events, cached views, or offline
writes.

## Device Push Tokens Table

Run this SQL in the Supabase SQL editor before manually testing token
registration:

```sql
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null,
  platform text not null check (platform in ('ios', 'android')),
  push_token text not null,
  status text not null check (status in ('active', 'disabled', 'expired', 'revoked')),
  permission_status text not null check (
    permission_status in ('unknown', 'granted', 'denied', 'provisional', 'unavailable')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (profile_id, device_id)
);

alter table public.device_push_tokens enable row level security;

create or replace function public.register_device_push_token(
  p_profile_id uuid,
  p_device_id uuid,
  p_platform text,
  p_push_token text,
  p_permission_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where profiles.id = p_profile_id
      and profiles.auth_user_id = auth.uid()
  ) then
    raise exception 'Signed-in profile does not own this device token';
  end if;

  insert into public.device_push_tokens (
    profile_id,
    device_id,
    platform,
    push_token,
    status,
    permission_status,
    last_seen_at
  )
  values (
    p_profile_id,
    p_device_id,
    p_platform,
    p_push_token,
    'active',
    p_permission_status,
    now()
  )
  on conflict (profile_id, device_id)
  do update set
    platform = excluded.platform,
    push_token = excluded.push_token,
    status = 'active',
    permission_status = excluded.permission_status,
    updated_at = now(),
    last_seen_at = now();
end;
$$;

create or replace function public.disable_current_device_push_token(
  p_profile_id uuid,
  p_device_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where profiles.id = p_profile_id
      and profiles.auth_user_id = auth.uid()
  ) then
    raise exception 'Signed-in profile does not own this device token';
  end if;

  update public.device_push_tokens
  set
    status = 'disabled',
    updated_at = now(),
    last_seen_at = now()
  where profile_id = p_profile_id
    and device_id = p_device_id
    and status = 'active';
end;
$$;

revoke all on function public.register_device_push_token(uuid, uuid, text, text, text) from public;
revoke all on function public.disable_current_device_push_token(uuid, uuid) from public;
grant execute on function public.register_device_push_token(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.disable_current_device_push_token(uuid, uuid) to authenticated;
```

No client table policies are added because NurseFlow does not need to download
raw push tokens. The two authenticated functions verify ownership through
`auth.uid()` and expose only registration/deactivation actions. Later server
notification work should use trusted server code and send only to records whose
`status` is `active`.

## Manual Check

Use a supported iOS or Android development build with notification credentials
configured as described in `docs/phase-7/expo-notifications-setup.md`.

1. Grant notification permission and sign in.
2. Confirm one `device_push_tokens` row exists for the signed-in profile and its
   status is `active`.
3. Sign out and confirm the same row changes to `disabled`.
4. Sign in again and confirm the same profile/device row becomes `active` and
   refreshes `last_seen_at`.
5. Temporarily remove the table or its update policy in a test project and
   confirm NurseFlow shows a readable registration or sign-out error.

The app does not display the raw token.
