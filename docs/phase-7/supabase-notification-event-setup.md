# Phase 7 Supabase Notification Event Setup

Use this setup for Phase 7 Tasks 2.1 through 2.6 so trusted server code can
record safe notification intent for important active-shift events.

A notification event is an outbox record. It says what the server intends to
send and where the app may route after a tap. It is separate from the active
shift snapshot and is not proof that delivery succeeded.

Tasks 2.2 through 2.6 add a database trigger that connects successful
active-shift writes to the outbox. Expo push delivery and notification-tap
recovery stay separate; tap handling belongs to Task 2.7.

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

## Active Shift Notification Hook

Run this after creating `enqueue_notification_event`. The trigger compares the
last committed shift snapshot with the newly saved snapshot inside the same
database transaction. It creates outbox events only for newly added requests,
linked nurses whose own assignment or break changed, new admissions or
discharges, and newly meaningful safety flags.

Keeping this comparison on the server means a failed shift write cannot create
a false notification. The existing Phase 6 realtime update still comes from the
same `active_shifts` update.

```sql
create or replace function public.enqueue_active_shift_change_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access public.shift_nurse_access%rowtype;
  v_new_assignment jsonb;
  v_old_assignment jsonb;
  v_new_break jsonb;
  v_old_break jsonb;
  v_new_patient jsonb;
  v_old_patient jsonb;
  v_record jsonb;
begin
  if new.ended_at is not null then
    return new;
  end if;

  -- Tasks 2.2 and 2.3: notify charge about a new request from a linked nurse.
  for v_record in
    select request
    from jsonb_array_elements(
      coalesce(new.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
    ) request
    where request ->> 'type' in ('issue', 'swap')
      and exists (
        select 1
        from public.shift_nurse_access access
        where access.shift_id = new.id
          and access.nurse_id = request ->> 'requestingNurseId'
          and access.status = 'linked'
      )
      and not exists (
        select 1
        from jsonb_array_elements(
          coalesce(old.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
        ) old_request
        where old_request ->> 'id' = request ->> 'id'
      )
  loop
    perform public.enqueue_notification_event(
      new.id,
      new.charge_profile_id,
      null,
      case
        when v_record ->> 'type' = 'issue' then 'issue_submitted'
        else 'swap_requested'
      end,
      'request_detail',
      'Shift request received',
      'Open NurseFlow to review the latest request.',
      v_record ->> 'id',
      null
    );
  end loop;

  -- Tasks 2.4 and 2.5: compare only each linked nurse's scoped data.
  for v_access in
    select access.*
    from public.shift_nurse_access access
    where access.shift_id = new.id
      and access.status = 'linked'
      and access.nurse_profile_id is not null
  loop
    select coalesce(
      jsonb_agg(assignment ->> 'bedId' order by assignment ->> 'bedId'),
      '[]'::jsonb
    )
    into v_old_assignment
    from jsonb_array_elements(
      coalesce(
        old.shift_snapshot -> 'assignmentResult' -> 'bedAssignments',
        '[]'::jsonb
      )
    ) assignment
    where assignment ->> 'nurseId' = v_access.nurse_id;

    select coalesce(
      jsonb_agg(assignment ->> 'bedId' order by assignment ->> 'bedId'),
      '[]'::jsonb
    )
    into v_new_assignment
    from jsonb_array_elements(
      coalesce(
        new.shift_snapshot -> 'assignmentResult' -> 'bedAssignments',
        '[]'::jsonb
      )
    ) assignment
    where assignment ->> 'nurseId' = v_access.nurse_id;

    if v_new_assignment is distinct from v_old_assignment then
      perform public.enqueue_notification_event(
        new.id,
        v_access.nurse_profile_id,
        v_access.id,
        'assignment_updated',
        'joined_nurse_assignment',
        'Assignment updated',
        'Open NurseFlow to review your current assignment.',
        null,
        null
      );
    end if;

    select jsonb_build_object(
      'startTime', break_entry ->> 'startTime',
      'durationMinutes', break_entry -> 'durationMinutes'
    )
    into v_old_break
    from jsonb_array_elements(
      coalesce(
        old.shift_snapshot -> 'breakSchedule' -> 'entries',
        '[]'::jsonb
      )
    ) break_entry
    where break_entry ->> 'nurseId' = v_access.nurse_id
    limit 1;

    select jsonb_build_object(
      'startTime', break_entry ->> 'startTime',
      'durationMinutes', break_entry -> 'durationMinutes'
    )
    into v_new_break
    from jsonb_array_elements(
      coalesce(
        new.shift_snapshot -> 'breakSchedule' -> 'entries',
        '[]'::jsonb
      )
    ) break_entry
    where break_entry ->> 'nurseId' = v_access.nurse_id
    limit 1;

    if v_new_break is distinct from v_old_break then
      perform public.enqueue_notification_event(
        new.id,
        v_access.nurse_profile_id,
        v_access.id,
        'break_updated',
        'joined_nurse_assignment',
        'Break schedule updated',
        'Open NurseFlow to review your current break time.',
        null,
        null
      );
    end if;
  end loop;

  -- Task 2.6: patient presence changes are enough; never copy patient details.
  for v_record in
    select bed_state
    from jsonb_array_elements(
      coalesce(new.shift_snapshot -> 'bedStates', '[]'::jsonb)
    ) bed_state
  loop
    select old_state -> 'patient'
    into v_old_patient
    from jsonb_array_elements(
      coalesce(old.shift_snapshot -> 'bedStates', '[]'::jsonb)
    ) old_state
    where old_state ->> 'bedId' = v_record ->> 'bedId'
    limit 1;

    v_new_patient := v_record -> 'patient';

    if jsonb_typeof(v_old_patient) is distinct from 'object'
      and jsonb_typeof(v_new_patient) = 'object' then
      perform public.enqueue_notification_event(
        new.id,
        new.charge_profile_id,
        null,
        'admission_added',
        'floor_board',
        'Floor census updated',
        'Open NurseFlow to review a new admission.',
        null,
        v_record ->> 'bedId'
      );
    elsif jsonb_typeof(v_old_patient) = 'object'
      and jsonb_typeof(v_new_patient) is distinct from 'object' then
      perform public.enqueue_notification_event(
        new.id,
        new.charge_profile_id,
        null,
        'patient_discharged',
        'floor_board',
        'Floor census updated',
        'Open NurseFlow to review a discharge.',
        null,
        v_record ->> 'bedId'
      );
    end if;
  end loop;

  -- Notify only when an unassigned-bed flag appears for a new bed.
  for v_record in
    select flag
    from jsonb_array_elements(
      coalesce(new.shift_snapshot -> 'flags', '[]'::jsonb)
    ) flag
    where flag ->> 'type' = 'unassigned_bed'
      and not exists (
        select 1
        from jsonb_array_elements(
          coalesce(old.shift_snapshot -> 'flags', '[]'::jsonb)
        ) old_flag
        where old_flag ->> 'type' = 'unassigned_bed'
          and old_flag ->> 'bedId' = flag ->> 'bedId'
      )
  loop
    perform public.enqueue_notification_event(
      new.id,
      new.charge_profile_id,
      null,
      'bed_unassigned',
      'flags',
      'Assignment needs review',
      'Open NurseFlow to review a newly unassigned bed.',
      null,
      v_record ->> 'bedId'
    );
  end loop;

  -- A new or changed imbalance flag is meaningful; an identical flag is not.
  for v_record in
    select flag
    from jsonb_array_elements(
      coalesce(new.shift_snapshot -> 'flags', '[]'::jsonb)
    ) flag
    where flag ->> 'type' = 'team_imbalance'
      and not exists (
        select 1
        from jsonb_array_elements(
          coalesce(old.shift_snapshot -> 'flags', '[]'::jsonb)
        ) old_flag
        where old_flag ->> 'id' = flag ->> 'id'
          and old_flag ->> 'severity' = flag ->> 'severity'
          and old_flag ->> 'message' = flag ->> 'message'
      )
  loop
    perform public.enqueue_notification_event(
      new.id,
      new.charge_profile_id,
      null,
      'imbalance_detected',
      'flags',
      'Assignment balance changed',
      'Open NurseFlow to review the latest balance flag.',
      null,
      null
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.enqueue_active_shift_change_notifications()
from public, anon, authenticated;

drop trigger if exists enqueue_active_shift_change_notifications
on public.active_shifts;

create trigger enqueue_active_shift_change_notifications
after update of shift_snapshot on public.active_shifts
for each row
when (old.shift_snapshot is distinct from new.shift_snapshot)
execute function public.enqueue_active_shift_change_notifications();
```

The assignment comparison sorts bed IDs, so regenerating the same assignment
in a different JSON order does not notify anyone. The break comparison includes
only start time and duration. The safety comparison uses stable bed IDs and flag
content so saving an unchanged flag does not create another event.

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

After installing the active-shift notification hook:

8. Submit one joined-nurse issue and one swap request. Confirm each creates one
   charge event with `request_detail` and the matching request ID. Disable the
   charge device token and confirm the in-app requests still save while their
   outbox events are `skipped`.
9. Change assignments for one linked nurse. Confirm only that nurse receives an
   `assignment_updated` event. Save the same assignment again and confirm no
   duplicate event is created.
10. Change one linked nurse's break start time. Confirm only that nurse receives
    a `break_updated` event. Changes to warnings or covered rooms alone should
    not create a break event.
11. Add and remove a patient from a bed. Confirm the charge nurse receives
    generic admission and discharge events with a bed routing ID but no patient
    data.
12. Add an unassigned-bed flag and a team-imbalance flag. Confirm each creates a
    charge event. Save the identical flags again and confirm no duplicate event
    is created.
13. Remove a nurse's linked access, change that nurse's assignment or break,
    and confirm no nurse-scoped event is created for that profile.
