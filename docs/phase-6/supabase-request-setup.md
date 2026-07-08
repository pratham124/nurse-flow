# Phase 6 Live Request Server Setup

Use this setup for Phase 6 Tasks 5.1, 5.2, and 5.3 so joined nurses can submit
issue and swap requests without receiving write access to the full active shift.

This adds only in-app request writes and request resolution. It does not add push
notifications, offline queues, conflict resolution, assignment-changing swap
logic, drag-and-drop override, board sharing, tablet layout, or AI.

Run this after the Phase 5 server workspace and Phase 6 nurse invite/access setup
already exist.

## Joined Nurse Issue RPC

```sql
create or replace function public.submit_joined_nurse_issue_request(
  request_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid;
  linked_access public.shift_nurse_access%rowtype;
  new_request jsonb;
  shift_row public.active_shifts%rowtype;
  submitted_at timestamptz := now();
  trimmed_message text := btrim(request_message);
begin
  if trimmed_message = '' then
    raise exception 'Add issue details before submitting.';
  end if;

  select id
  into current_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if current_profile_id is null then
    raise exception 'Sign in before submitting an issue.';
  end if;

  select access.*
  into linked_access
  from public.shift_nurse_access access
  join public.active_shifts active_shift
    on active_shift.id = access.shift_id
  where access.nurse_profile_id = current_profile_id
    and access.status = 'linked'
    and active_shift.ended_at is null
  order by access.updated_at desc
  limit 1;

  if not found then
    raise exception 'Join a shift before submitting an issue.';
  end if;

  select *
  into shift_row
  from public.active_shifts
  where id = linked_access.shift_id
    and ended_at is null
  for update;

  if not found then
    raise exception 'This shift is no longer active.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      coalesce(shift_row.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
    ) request
    where request ->> 'type' = 'issue'
      and request ->> 'status' = 'pending'
      and request ->> 'requestingNurseId' = linked_access.nurse_id
      and lower(btrim(request ->> 'message')) = lower(trimmed_message)
      and coalesce(request ->> 'sourceBedId', '') = ''
  ) then
    raise exception 'This issue is already pending.';
  end if;

  new_request := jsonb_build_object(
    'id', 'nurse-request-' || replace(gen_random_uuid()::text, '-', ''),
    'type', 'issue',
    'status', 'pending',
    'requestingNurseId', linked_access.nurse_id,
    'requestingNurseName', linked_access.nurse_name,
    'message', trimmed_message,
    'createdAt', submitted_at
  );

  update public.active_shifts
  set
    shift_snapshot = jsonb_set(
      shift_row.shift_snapshot,
      '{nurseRequests}',
      coalesce(shift_row.shift_snapshot -> 'nurseRequests', '[]'::jsonb) ||
        jsonb_build_array(new_request),
      true
    ),
    updated_at = submitted_at
  where id = shift_row.id;
end;
$$;

grant execute on function public.submit_joined_nurse_issue_request(text)
to authenticated;
```

## Joined Nurse Swap RPC

```sql
create or replace function public.submit_joined_nurse_swap_request(
  source_bed_id text,
  request_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid;
  linked_access public.shift_nurse_access%rowtype;
  new_request jsonb;
  shift_row public.active_shifts%rowtype;
  submitted_at timestamptz := now();
  trimmed_message text := btrim(request_message);
begin
  if source_bed_id is null or btrim(source_bed_id) = '' then
    raise exception 'Choose the assigned bed for this swap request.';
  end if;

  if trimmed_message = '' then
    raise exception 'Add swap details before submitting.';
  end if;

  select id
  into current_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if current_profile_id is null then
    raise exception 'Sign in before submitting a swap request.';
  end if;

  select access.*
  into linked_access
  from public.shift_nurse_access access
  join public.active_shifts active_shift
    on active_shift.id = access.shift_id
  where access.nurse_profile_id = current_profile_id
    and access.status = 'linked'
    and active_shift.ended_at is null
  order by access.updated_at desc
  limit 1;

  if not found then
    raise exception 'Join a shift before submitting a swap request.';
  end if;

  select *
  into shift_row
  from public.active_shifts
  where id = linked_access.shift_id
    and ended_at is null
  for update;

  if not found then
    raise exception 'This shift is no longer active.';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(
      coalesce(
        shift_row.shift_snapshot -> 'assignmentResult' -> 'bedAssignments',
        '[]'::jsonb
      )
    ) assignment
    where assignment ->> 'bedId' = source_bed_id
      and assignment ->> 'nurseId' = linked_access.nurse_id
  ) then
    raise exception 'Choose one of your assigned beds for the swap.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      coalesce(shift_row.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
    ) request
    where request ->> 'type' = 'swap'
      and request ->> 'status' = 'pending'
      and request ->> 'requestingNurseId' = linked_access.nurse_id
      and request ->> 'sourceBedId' = source_bed_id
      and lower(btrim(request ->> 'message')) = lower(trimmed_message)
  ) then
    raise exception 'This swap request is already pending.';
  end if;

  new_request := jsonb_build_object(
    'id', 'nurse-request-' || replace(gen_random_uuid()::text, '-', ''),
    'type', 'swap',
    'status', 'pending',
    'requestingNurseId', linked_access.nurse_id,
    'requestingNurseName', linked_access.nurse_name,
    'message', trimmed_message,
    'sourceBedId', source_bed_id,
    'createdAt', submitted_at
  );

  update public.active_shifts
  set
    shift_snapshot = jsonb_set(
      shift_row.shift_snapshot,
      '{nurseRequests}',
      coalesce(shift_row.shift_snapshot -> 'nurseRequests', '[]'::jsonb) ||
        jsonb_build_array(new_request),
      true
    ),
    updated_at = submitted_at
  where id = shift_row.id;
end;
$$;

grant execute on function public.submit_joined_nurse_swap_request(text, text)
to authenticated;
```

## Charge Nurse Resolution RPC

The app resolves swap requests through this focused RPC so it can update one
pending request without rewriting the whole active shift snapshot from the
client.

```sql
create or replace function public.resolve_shift_nurse_swap_request(
  request_id text,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid;
  resolved_at_time timestamptz := now();
  shift_row public.active_shifts%rowtype;
  updated_requests jsonb;
begin
  if next_status not in ('accepted', 'declined') then
    raise exception 'Choose accepted or declined.';
  end if;

  select id
  into current_profile_id
  from public.profiles
  where auth_user_id = auth.uid()
    and role = 'charge_nurse';

  if current_profile_id is null then
    raise exception 'Sign in as charge to resolve requests.';
  end if;

  select *
  into shift_row
  from public.active_shifts
  where charge_profile_id = current_profile_id
    and ended_at is null
  order by updated_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No active charge shift was found.';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(
      coalesce(shift_row.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
    ) request
    where request ->> 'id' = request_id
      and request ->> 'type' = 'swap'
      and request ->> 'status' = 'pending'
  ) then
    raise exception 'Only pending swap requests can be resolved.';
  end if;

  select jsonb_agg(
    case
      when request ->> 'id' = request_id then
        request || jsonb_build_object(
          'status', next_status,
          'resolvedAt', resolved_at_time,
          'resolutionNote',
            case
              when next_status = 'accepted' then 'Accepted by charge'
              else 'Declined by charge'
            end
        )
      else request
    end
    order by request_order
  )
  into updated_requests
  from jsonb_array_elements(
    coalesce(shift_row.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
  ) with ordinality as request(request, request_order);

  update public.active_shifts
  set
    shift_snapshot = jsonb_set(
      shift_row.shift_snapshot,
      '{nurseRequests}',
      coalesce(updated_requests, '[]'::jsonb),
      true
    ),
    updated_at = resolved_at_time
  where id = shift_row.id;
end;
$$;

grant execute on function public.resolve_shift_nurse_swap_request(text, text)
to authenticated;
```

## Manual Validation

1. Submit an issue from a joined nurse device and confirm it appears in the
   charge nurse request view while open.
2. Try a blank issue and a duplicate pending issue; both should be rejected.
3. Submit a swap request from a joined nurse device for an assigned bed and
   confirm it appears for charge.
4. Try a stale or unassigned source bed through SQL or an older app state; the
   server should reject it.
5. Resolve a pending swap request as charge and confirm the joined nurse request
   history updates to accepted or declined.
