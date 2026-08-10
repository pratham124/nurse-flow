# Phase 8 Request Lifecycle and Activity Notification Setup

Use this setup for Phase 8 Tasks 2.5 through 2.7 after the request-message,
manual-override, and Phase 7 notification-event setup is installed.

The active-shift snapshot continues to own request lifecycle metadata. Request
messages remain separate append-only rows, and manual overrides remain separate
server history rows. The functions and triggers below update those boundaries
atomically and create only generic notification intent.

## Notification Event Types

Add two generic event types. Neither event stores a message body, patient
detail, room, diagnosis, or assignment snapshot.

```sql
alter table public.notification_events
drop constraint if exists notification_events_event_type_check;

alter table public.notification_events
add constraint notification_events_event_type_check
check (event_type in (
  'issue_submitted',
  'swap_requested',
  'request_message_added',
  'request_status_changed',
  'assignment_updated',
  'admission_added',
  'patient_discharged',
  'imbalance_detected',
  'bed_unassigned'
));
```

## Other-Participant Notification Helper

This server-only helper finds the request's other participant. Charge-authored
activity targets the request's currently linked nurse. Nurse-authored activity
targets the shift owner. Missing or removed nurse access produces no recipient;
disabled notification permission is recorded as `skipped` by the existing
Phase 7 enqueue helper.

```sql
create or replace function public.enqueue_request_activity_notification(
  p_shift_id uuid,
  p_request_id text,
  p_actor_profile_id uuid,
  p_event_type text,
  p_title text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_nurse_id text;
  shift_owner_profile_id uuid;
  target_access public.shift_nurse_access%rowtype;
begin
  if p_event_type not in ('request_message_added', 'request_status_changed') then
    raise exception 'Unsupported request activity notification type.';
  end if;

  select
    active_shift.charge_profile_id,
    request_item.value ->> 'requestingNurseId'
  into shift_owner_profile_id, request_nurse_id
  from public.active_shifts active_shift
  cross join lateral jsonb_array_elements(
    coalesce(active_shift.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
  ) request_item
  where active_shift.id = p_shift_id
    and active_shift.ended_at is null
    and request_item.value ->> 'id' = btrim(p_request_id)
  limit 1;

  if not found or coalesce(request_nurse_id, '') = '' then
    return;
  end if;

  select access.*
  into target_access
  from public.shift_nurse_access access
  where access.shift_id = p_shift_id
    and access.nurse_id = request_nurse_id
    and access.status = 'linked'
    and access.nurse_profile_id is not null
  order by access.updated_at desc
  limit 1;

  if p_actor_profile_id = shift_owner_profile_id then
    if found then
      perform public.enqueue_notification_event(
        p_shift_id,
        target_access.nurse_profile_id,
        target_access.id,
        p_event_type,
        'request_detail',
        p_title,
        p_body,
        btrim(p_request_id),
        null
      );
    end if;
    return;
  end if;

  if found and p_actor_profile_id = target_access.nurse_profile_id then
    perform public.enqueue_notification_event(
      p_shift_id,
      shift_owner_profile_id,
      null,
      p_event_type,
      'request_detail',
      p_title,
      p_body,
      btrim(p_request_id),
      null
    );
  end if;
end;
$$;

revoke all on function public.enqueue_request_activity_notification(
  uuid, text, uuid, text, text, text
) from public, anon, authenticated;
```

## Issue Lifecycle Action

Existing issues without `issueReviewStatus` are treated as `open`. Only the
owning charge nurse can move `open -> reviewed -> resolved -> open`; resolving
directly from open is also allowed. Reopening clears timestamps from the prior
cycle while preserving the request and its thread.

```sql
create or replace function public.update_shift_nurse_issue_status(
  p_request_id text,
  p_next_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid;
  current_status text;
  shift_row public.active_shifts%rowtype;
  updated_at_time timestamptz := now();
  updated_requests jsonb;
begin
  if p_next_status not in ('open', 'reviewed', 'resolved') then
    raise exception 'Choose open, reviewed, or resolved.';
  end if;

  select profile.id
  into current_profile_id
  from public.profiles profile
  where profile.auth_user_id = auth.uid()
    and profile.role = 'charge_nurse';

  if current_profile_id is null then
    raise exception 'Sign in as charge to update issue requests.';
  end if;

  select active_shift.*
  into shift_row
  from public.active_shifts active_shift
  where active_shift.charge_profile_id = current_profile_id
    and active_shift.ended_at is null
  order by active_shift.updated_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No active charge shift was found.';
  end if;

  select coalesce(request_item.value ->> 'issueReviewStatus', 'open')
  into current_status
  from jsonb_array_elements(
    coalesce(shift_row.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
  ) request_item
  where request_item.value ->> 'id' = btrim(p_request_id)
    and request_item.value ->> 'type' = 'issue'
  limit 1;

  if not found then
    raise exception 'The issue request is unavailable.';
  end if;

  if current_status = p_next_status then
    return;
  end if;

  if not (
    (current_status = 'open' and p_next_status in ('reviewed', 'resolved'))
    or (current_status = 'reviewed' and p_next_status = 'resolved')
    or (current_status = 'resolved' and p_next_status = 'open')
  ) then
    raise exception 'That issue status change is not allowed.';
  end if;

  select jsonb_agg(
    case
      when request_item.value ->> 'id' <> btrim(p_request_id) then
        request_item.value
      when p_next_status = 'reviewed' then
        (request_item.value - 'issueResolvedAt' - 'issueResolvedByProfileId') ||
        jsonb_build_object(
          'issueReviewStatus', 'reviewed',
          'reviewedAt', updated_at_time,
          'reviewedByProfileId', current_profile_id
        )
      when p_next_status = 'resolved' then
        request_item.value || jsonb_build_object(
          'issueReviewStatus', 'resolved',
          'issueResolvedAt', updated_at_time,
          'issueResolvedByProfileId', current_profile_id
        )
      else
        (
          request_item.value -
          'reviewedAt' -
          'reviewedByProfileId' -
          'issueResolvedAt' -
          'issueResolvedByProfileId'
        ) || jsonb_build_object('issueReviewStatus', 'open')
    end
    order by request_order
  )
  into updated_requests
  from jsonb_array_elements(
    coalesce(shift_row.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
  ) with ordinality as request_item(value, request_order);

  update public.active_shifts
  set
    shift_snapshot = jsonb_set(
      shift_row.shift_snapshot,
      '{nurseRequests}',
      coalesce(updated_requests, '[]'::jsonb),
      true
    ),
    updated_at = updated_at_time
  where id = shift_row.id;
end;
$$;

revoke all on function public.update_shift_nurse_issue_status(text, text)
from public, anon;
grant execute on function public.update_shift_nurse_issue_status(text, text)
to authenticated;
```

## Atomic Accepted-Swap Completion

The existing manual-override action already accepts `related_swap_request_id`.
This trigger completes that accepted request inside the same transaction as the
new override. If validation or request completion fails, neither record is
saved.

```sql
create or replace function public.complete_swap_request_from_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record jsonb;
  shift_row public.active_shifts%rowtype;
  updated_requests jsonb;
begin
  if new.related_swap_request_id is null then
    return new;
  end if;

  select active_shift.*
  into shift_row
  from public.active_shifts active_shift
  where active_shift.id = new.shift_id
    and active_shift.ended_at is null
  for update;

  select request_item.value
  into request_record
  from jsonb_array_elements(
    coalesce(shift_row.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
  ) request_item
  where request_item.value ->> 'id' = new.related_swap_request_id
    and request_item.value ->> 'type' = 'swap'
    and request_item.value ->> 'status' = 'accepted'
    and request_item.value ->> 'sourceBedId' = new.bed_id
    and request_item.value ->> 'requestingNurseId' = new.from_nurse_id
    and coalesce(request_item.value ->> 'completedOverrideId', '') = ''
  limit 1;

  if not found then
    raise exception 'Only an uncompleted accepted swap owned by the current nurse can be completed.';
  end if;

  select jsonb_agg(
    case
      when request_item.value ->> 'id' = new.related_swap_request_id then
        request_item.value || jsonb_build_object(
          'swapCompletedAt', new.created_at,
          'swapCompletedByProfileId', new.created_by_profile_id,
          'completedOverrideId', new.id
        )
      else request_item.value
    end
    order by request_order
  )
  into updated_requests
  from jsonb_array_elements(
    coalesce(shift_row.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
  ) with ordinality as request_item(value, request_order);

  update public.active_shifts
  set
    shift_snapshot = jsonb_set(
      shift_row.shift_snapshot,
      '{nurseRequests}',
      coalesce(updated_requests, '[]'::jsonb),
      true
    ),
    updated_at = new.created_at
  where id = new.shift_id;

  return new;
end;
$$;

revoke all on function public.complete_swap_request_from_override()
from public, anon, authenticated;

drop trigger if exists complete_swap_request_from_override
on public.manual_assignment_overrides;

create trigger complete_swap_request_from_override
after insert on public.manual_assignment_overrides
for each row
when (new.related_swap_request_id is not null)
execute function public.complete_swap_request_from_override();
```

## Request Activity Notification Triggers

A new message notifies only the other participant. A meaningful issue-state,
swap-decision, or swap-completion change notifies the requesting nurse. The
triggers catch enqueue failures so notification infrastructure cannot roll back
the message, lifecycle update, or assignment move.

```sql
create or replace function public.enqueue_nurse_request_message_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.enqueue_request_activity_notification(
      new.shift_id,
      new.request_id,
      new.author_profile_id,
      'request_message_added',
      'Request conversation updated',
      'Open NurseFlow to review a new request message.'
    );
  exception when others then
    null;
  end;

  return null;
end;
$$;

revoke all on function public.enqueue_nurse_request_message_notification()
from public, anon, authenticated;

drop trigger if exists enqueue_nurse_request_message_notification
on public.nurse_request_messages;

create trigger enqueue_nurse_request_message_notification
after insert on public.nurse_request_messages
for each row
execute function public.enqueue_nurse_request_message_notification();

create or replace function public.enqueue_request_lifecycle_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_change record;
begin
  for request_change in
    select
      current_request.value as current_request,
      previous_request.value as previous_request
    from jsonb_array_elements(
      coalesce(new.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
    ) current_request
    join lateral jsonb_array_elements(
      coalesce(old.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
    ) previous_request
      on previous_request.value ->> 'id' = current_request.value ->> 'id'
    where (
      current_request.value ->> 'type' = 'issue'
      and coalesce(
        current_request.value ->> 'issueReviewStatus',
        'open'
      ) is distinct from coalesce(
        previous_request.value ->> 'issueReviewStatus',
        'open'
      )
    ) or (
      current_request.value ->> 'type' = 'swap'
      and (
        current_request.value ->> 'status' is distinct from
          previous_request.value ->> 'status'
        or current_request.value ->> 'completedOverrideId' is distinct from
          previous_request.value ->> 'completedOverrideId'
      )
    )
  loop
    begin
      perform public.enqueue_request_activity_notification(
        new.id,
        request_change.current_request ->> 'id',
        new.charge_profile_id,
        'request_status_changed',
        'Request status updated',
        'Open NurseFlow to review the latest request status.'
      );
    exception when others then
      null;
    end;
  end loop;

  return null;
end;
$$;

revoke all on function public.enqueue_request_lifecycle_notifications()
from public, anon, authenticated;

drop trigger if exists enqueue_request_lifecycle_notifications
on public.active_shifts;

create trigger enqueue_request_lifecycle_notifications
after update of shift_snapshot on public.active_shifts
for each row
when (old.shift_snapshot is distinct from new.shift_snapshot)
execute function public.enqueue_request_lifecycle_notifications();
```

## Joined-Nurse Completion Derivation

The requesting nurse must not receive override history. The scoped assignment
RPC adds only one boolean when a completed request's linked override is no
longer the active override for that bed.

```sql
create or replace function public.get_joined_nurse_assignment_view()
returns jsonb
language sql
security definer
set search_path = ''
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
        ) filter (
          where bed.value is not null
            and room.value is not null
            and doctor_side.value is not null
        ),
        '[]'::jsonb
      ) as value
    from linked_access
    left join lateral jsonb_array_elements(
      coalesce(
        linked_access.shift_snapshot #> '{assignmentResult,bedAssignments}',
        '[]'::jsonb
      )
    ) assignment on true
    left join public.manual_assignment_overrides active_override
      on active_override.shift_id = linked_access.shift_id
      and active_override.bed_id = assignment.value ->> 'bedId'
      and active_override.status = 'active'
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
    where coalesce(
      active_override.to_nurse_id,
      assignment.value ->> 'nurseId'
    ) = linked_access.nurse_id
    group by linked_access.id
  ),
  request_history as (
    select
      linked_access.id as access_id,
      coalesce(
        jsonb_agg(
          request.value ||
          case
            when coalesce(request.value ->> 'completedOverrideId', '') <> ''
              and not exists (
                select 1
                from public.manual_assignment_overrides current_override
                where current_override.id::text =
                  request.value ->> 'completedOverrideId'
                  and current_override.status = 'active'
              ) then jsonb_build_object(
                'completedAssignmentChangedLater', true
              )
            else '{}'::jsonb
          end
          order by request.request_order
        ) filter (where request.value is not null),
        '[]'::jsonb
      ) as value
    from linked_access
    left join lateral jsonb_array_elements(
      coalesce(linked_access.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
    ) with ordinality as request(value, request_order)
      on request.value ->> 'requestingNurseId' = linked_access.nurse_id
    group by linked_access.id
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
    'requestHistory', request_history.value
  )
  from linked_access
  left join assigned_beds
    on assigned_beds.access_id = linked_access.id
  left join request_history
    on request_history.access_id = linked_access.id;
$$;

revoke all on function public.get_joined_nurse_assignment_view() from public;
grant execute on function public.get_joined_nurse_assignment_view()
to authenticated;
```

## Manual Checks

1. Move an issue through open, reviewed, resolved, and reopened. Confirm the
   request thread and assignment snapshot fields outside that request are
   unchanged.
2. Try the issue action as the requesting nurse and as another charge account;
   both must be denied.
3. Accept a swap and confirm no assignment changes. Complete it through the
   request's assignment dialog and confirm the request stores the new override
   ID and server completion time.
4. Move the same bed again. Confirm the earlier request displays
   `Completed — assignment later changed` while only the newest override is
   active.
5. Send a message from each participant. Confirm only the other participant
   receives a generic request-detail event and the body is absent.
6. Change issue or swap lifecycle state. Confirm the requesting nurse receives
   one generic request-detail event.
7. Disable push tokens or force the notification helper to fail. Confirm the
   request write, message, and assignment move still save.
