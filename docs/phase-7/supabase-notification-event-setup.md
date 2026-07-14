# Phase 7 Supabase Notification Event Setup

Use this setup for Phase 7 Task 2.1 so trusted server code can record safe
notification intent for important active-shift events.

A notification event is an outbox record. It says what the server intends to
send and where the app may route after a tap. It is separate from the active
shift snapshot and is not proof that delivery succeeded.

This task does not send push notifications or connect events to request,
assignment, break, admission, discharge, or flag workflows. Those integrations
belong to Tasks 2.2 through 2.6.

## Notification Event Records

Run this SQL in the Supabase SQL editor after the active shift, shift nurse
access, and device push token setup exists.

```sql
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.active_shifts(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient_access_id uuid references public.shift_nurse_access(id) on delete set null,
  event_type text not null check (event_type in (
    'issue_submitted',
    'swap_requested',
    'assignment_updated',
    'break_updated',
    'admission_added',
    'patient_discharged',
    'imbalance_detected',
    'bed_unassigned'
  )),
  target_route text not null check (target_route in (
    'request_detail',
    'requests_list',
    'joined_nurse_assignment',
    'floor_board',
    'flags'
  )),
  related_request_id text,
  related_bed_id text,
  title text not null check (char_length(trim(title)) between 1 and 80),
  body text not null check (char_length(trim(body)) between 1 and 180),
  status text not null default 'pending' check (status in (
    'pending',
    'sent',
    'failed',
    'skipped',
    'cancelled'
  )),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  failure_reason text,
  check (sent_at is null or status = 'sent')
);

create index if not exists notification_events_pending_delivery
on public.notification_events (created_at)
where status = 'pending';

create index if not exists notification_events_recipient_history
on public.notification_events (recipient_profile_id, created_at desc);

alter table public.notification_events enable row level security;

revoke all on table public.notification_events from anon, authenticated;
grant select, insert, update on table public.notification_events to service_role;
```

No mobile-client policies are added. Raw push tokens and notification outbox
records are server responsibilities, so signed-in app users cannot list or
insert them directly.

## Server-Only Enqueue Boundary

The helper below accepts only safe routing IDs and short display copy. It
records a `skipped` event instead of a deliverable `pending` event when the
shift ended, nurse access is no longer linked, the access belongs to another
recipient or shift, or the recipient has no active device token.

Later server-side workflow functions can call this helper after their normal
database write succeeds. Do not grant it to `authenticated`; a mobile client
must not be able to manufacture notification events.

```sql
create or replace function public.enqueue_notification_event(
  p_shift_id uuid,
  p_recipient_profile_id uuid,
  p_recipient_access_id uuid,
  p_event_type text,
  p_target_route text,
  p_title text,
  p_body text,
  p_related_request_id text default null,
  p_related_bed_id text default null
)
returns table (
  event_id uuid,
  event_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_skip_reason text;
begin
  if not exists (
    select 1
    from public.active_shifts
    where active_shifts.id = p_shift_id
      and active_shifts.ended_at is null
  ) then
    v_skip_reason := 'Shift ended';
  elsif p_recipient_access_id is null and not exists (
    select 1
    from public.active_shifts
    where active_shifts.id = p_shift_id
      and active_shifts.charge_profile_id = p_recipient_profile_id
  ) then
    v_skip_reason := 'Recipient is not the shift charge nurse';
  elsif p_recipient_access_id is not null and not exists (
    select 1
    from public.shift_nurse_access
    where shift_nurse_access.id = p_recipient_access_id
      and shift_nurse_access.shift_id = p_shift_id
      and shift_nurse_access.nurse_profile_id = p_recipient_profile_id
      and shift_nurse_access.status = 'linked'
  ) then
    v_skip_reason := 'Recipient access disabled';
  elsif not exists (
    select 1
    from public.device_push_tokens
    where device_push_tokens.profile_id = p_recipient_profile_id
      and device_push_tokens.status = 'active'
  ) then
    v_skip_reason := 'Recipient notifications disabled';
  end if;

  return query
  insert into public.notification_events (
    shift_id,
    recipient_profile_id,
    recipient_access_id,
    event_type,
    target_route,
    related_request_id,
    related_bed_id,
    title,
    body,
    status,
    failure_reason
  )
  values (
    p_shift_id,
    p_recipient_profile_id,
    p_recipient_access_id,
    p_event_type,
    p_target_route,
    p_related_request_id,
    p_related_bed_id,
    trim(p_title),
    trim(p_body),
    case when v_skip_reason is null then 'pending' else 'skipped' end,
    v_skip_reason
  )
  returning id, status;
end;
$$;

revoke all on function public.enqueue_notification_event(
  uuid, uuid, uuid, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.enqueue_notification_event(
  uuid, uuid, uuid, text, text, text, text, text, text
) to service_role;
```

Table constraints reject unsupported event types, routes, statuses, and empty
or oversized display copy. Server workflow code remains responsible for using
generic titles and bodies without patient names, diagnoses, room details, or a
full shift snapshot.

## Manual Validation

Use placeholder copy such as `Shift request received` and
`Open NurseFlow to review the latest request`.

1. Call `enqueue_notification_event` from trusted SQL for each supported event
   type and confirm the row uses an allowed route and contains no patient
   detail.
2. With an open shift and an active device token, confirm the function creates
   a `pending` event.
3. End the shift and confirm a new event is recorded as `skipped` with
   `Shift ended`.
4. For a nurse-scoped event, remove the matching `shift_nurse_access` record or
   change its status from `linked`; confirm the event is `skipped`.
5. Try a charge event for a profile that does not own the shift and confirm it
   is `skipped`.
6. Disable every device token for the recipient and confirm the event is
   `skipped`.
7. As an authenticated mobile user, confirm direct select and insert access to
   `notification_events` is denied.
