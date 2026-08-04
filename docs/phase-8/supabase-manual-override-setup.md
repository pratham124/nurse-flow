# Phase 8 Manual Assignment Override Server Setup

Use this setup for Phase 8 Task 1.3 after the existing active-shift and nurse
access setup is installed.

The generated assignment remains inside `active_shifts.shift_snapshot`. Manual
moves are separate history rows. Routine charge-board reads request only active
rows and build `activeAssignmentOverridesByBedId`; they never load superseded
history.

The write function is `security definer` because one transaction must supersede
the prior row, insert the replacement, and touch the active shift while direct
client writes remain disabled. It uses an empty search path and fully qualified
relations. Execute permission is restricted to authenticated users, and the
function still verifies the signed-in profile owns the active shift.

Current guidance checked during implementation:

- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase indexes](https://supabase.com/docs/guides/database/postgres/indexes)
- [Supabase JavaScript RPC calls](https://supabase.com/docs/reference/javascript/rpc)

## Table, Indexes, and Read Policy

```sql
create table if not exists public.manual_assignment_overrides (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.active_shifts(id) on delete cascade,
  baseline_assignment_result_id text not null,
  bed_id text not null,
  from_nurse_id text not null,
  to_nurse_id text not null,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  status text not null check (status in ('active', 'superseded')),
  superseded_at timestamptz,
  server_sequence bigint generated always as identity,
  related_swap_request_id text,
  warning_acknowledgements jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warning_acknowledgements) = 'array'),
  client_mutation_id text not null,
  check (from_nurse_id <> to_nurse_id),
  check (
    (status = 'active' and superseded_at is null)
    or (status = 'superseded' and superseded_at is not null)
  )
);

create unique index if not exists manual_assignment_overrides_one_active_bed
on public.manual_assignment_overrides (shift_id, bed_id)
where status = 'active';

create unique index if not exists manual_assignment_overrides_idempotency
on public.manual_assignment_overrides (
  shift_id,
  created_by_profile_id,
  client_mutation_id
);

create index if not exists manual_assignment_overrides_bed_history
on public.manual_assignment_overrides (shift_id, bed_id, server_sequence);

create index if not exists manual_assignment_overrides_related_swap
on public.manual_assignment_overrides (related_swap_request_id)
where related_swap_request_id is not null;

alter table public.manual_assignment_overrides enable row level security;

drop policy if exists "Charge nurses can read override history for their shifts"
on public.manual_assignment_overrides;

create policy "Charge nurses can read override history for their shifts"
on public.manual_assignment_overrides
for select
to authenticated
using (
  exists (
    select 1
    from public.active_shifts
    join public.profiles
      on profiles.id = active_shifts.charge_profile_id
    where active_shifts.id = manual_assignment_overrides.shift_id
      and profiles.auth_user_id = (select auth.uid())
      and profiles.role = 'charge_nurse'
  )
);

revoke all on table public.manual_assignment_overrides from anon, authenticated;
grant select on table public.manual_assignment_overrides to authenticated;
```

There are deliberately no direct insert, update, or delete policies. All writes
go through the focused transaction below.

## Confirm Manual Assignment Override Transaction

```sql
create or replace function public.confirm_manual_assignment_override(
  p_shift_id uuid,
  p_baseline_assignment_result_id text,
  p_bed_id text,
  p_from_nurse_id text,
  p_to_nurse_id text,
  p_warning_acknowledgements jsonb,
  p_related_swap_request_id text,
  p_client_mutation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_projection jsonb;
  bed_record jsonb;
  bed_state jsonb;
  confirmed_at timestamptz := now();
  current_baseline_id text;
  current_effective_nurse_id text;
  current_profile_id uuid;
  existing_override public.manual_assignment_overrides%rowtype;
  generated_assignment jsonb;
  normalized_acknowledgements jsonb := '[]'::jsonb;
  room_id text;
  saved_override public.manual_assignment_overrides%rowtype;
  shift_row public.active_shifts%rowtype;
  target_load_after integer;
  target_max_load integer;
  target_nurse jsonb;
  target_side_limit integer;
begin
  if p_shift_id is null then
    raise exception 'Choose an active shift.';
  end if;

  if coalesce(btrim(p_baseline_assignment_result_id), '') = '' then
    raise exception 'The generated assignment baseline is required.';
  end if;

  if coalesce(btrim(p_bed_id), '') = ''
    or coalesce(btrim(p_from_nurse_id), '') = ''
    or coalesce(btrim(p_to_nurse_id), '') = '' then
    raise exception 'Choose a bed, current nurse, and target nurse.';
  end if;

  if p_from_nurse_id = p_to_nurse_id then
    raise exception 'Choose a different nurse for this bed.';
  end if;

  if coalesce(btrim(p_client_mutation_id), '') = '' then
    raise exception 'A client mutation ID is required.';
  end if;

  if p_warning_acknowledgements is null
    or jsonb_typeof(p_warning_acknowledgements) <> 'array' then
    raise exception 'Warning acknowledgements must be an array.';
  end if;

  select profiles.id
  into current_profile_id
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.role = 'charge_nurse'
  limit 1;

  if current_profile_id is null then
    raise exception 'Sign in as a charge nurse to adjust assignments.';
  end if;

  select active_shift.*
  into shift_row
  from public.active_shifts active_shift
  where active_shift.id = p_shift_id
  for update;

  if not found then
    raise exception 'This active shift could not be found.';
  end if;

  if shift_row.charge_profile_id <> current_profile_id then
    raise exception 'This shift belongs to another charge nurse.';
  end if;

  if shift_row.ended_at is not null or shift_row.status <> 'assigned' then
    raise exception 'This shift is no longer available for assignment moves.';
  end if;

  select override_row.*
  into existing_override
  from public.manual_assignment_overrides override_row
  where override_row.shift_id = p_shift_id
    and override_row.created_by_profile_id = current_profile_id
    and override_row.client_mutation_id = p_client_mutation_id
  limit 1;

  if found then
    select coalesce(
      jsonb_object_agg(
        active_override.bed_id,
        jsonb_build_object(
          'id', active_override.id,
          'shiftId', active_override.shift_id,
          'baselineAssignmentResultId', active_override.baseline_assignment_result_id,
          'bedId', active_override.bed_id,
          'fromNurseId', active_override.from_nurse_id,
          'toNurseId', active_override.to_nurse_id,
          'createdByProfileId', active_override.created_by_profile_id,
          'createdAt', active_override.created_at,
          'status', active_override.status,
          'serverSequence', active_override.server_sequence,
          'relatedSwapRequestId', active_override.related_swap_request_id,
          'warningAcknowledgements', active_override.warning_acknowledgements
        )
      ),
      '{}'::jsonb
    )
    into active_projection
    from public.manual_assignment_overrides active_override
    where active_override.shift_id = p_shift_id
      and active_override.status = 'active';

    return jsonb_build_object(
      'status', 'saved',
      'override', jsonb_build_object(
        'id', existing_override.id,
        'shiftId', existing_override.shift_id,
        'baselineAssignmentResultId', existing_override.baseline_assignment_result_id,
        'bedId', existing_override.bed_id,
        'fromNurseId', existing_override.from_nurse_id,
        'toNurseId', existing_override.to_nurse_id,
        'createdByProfileId', existing_override.created_by_profile_id,
        'createdAt', existing_override.created_at,
        'status', existing_override.status,
        'supersededAt', existing_override.superseded_at,
        'serverSequence', existing_override.server_sequence,
        'relatedSwapRequestId', existing_override.related_swap_request_id,
        'warningAcknowledgements', existing_override.warning_acknowledgements
      ),
      'activeAssignmentOverridesByBedId', active_projection
    );
  end if;

  current_baseline_id := shift_row.shift_snapshot #>> '{assignmentResult,id}';

  select assignment.value
  into generated_assignment
  from jsonb_array_elements(
    coalesce(
      shift_row.shift_snapshot #> '{assignmentResult,bedAssignments}',
      '[]'::jsonb
    )
  ) assignment
  where assignment.value ->> 'bedId' = p_bed_id
  limit 1;

  select active_override.to_nurse_id
  into current_effective_nurse_id
  from public.manual_assignment_overrides active_override
  where active_override.shift_id = p_shift_id
    and active_override.bed_id = p_bed_id
    and active_override.status = 'active'
  limit 1;

  current_effective_nurse_id := coalesce(
    current_effective_nurse_id,
    generated_assignment ->> 'nurseId'
  );

  select coalesce(
    jsonb_object_agg(
      active_override.bed_id,
      jsonb_build_object(
        'id', active_override.id,
        'shiftId', active_override.shift_id,
        'baselineAssignmentResultId', active_override.baseline_assignment_result_id,
        'bedId', active_override.bed_id,
        'fromNurseId', active_override.from_nurse_id,
        'toNurseId', active_override.to_nurse_id,
        'createdByProfileId', active_override.created_by_profile_id,
        'createdAt', active_override.created_at,
        'status', active_override.status,
        'serverSequence', active_override.server_sequence,
        'relatedSwapRequestId', active_override.related_swap_request_id,
        'warningAcknowledgements', active_override.warning_acknowledgements
      )
    ),
    '{}'::jsonb
  )
  into active_projection
  from public.manual_assignment_overrides active_override
  where active_override.shift_id = p_shift_id
    and active_override.status = 'active';

  if current_baseline_id is distinct from p_baseline_assignment_result_id then
    return jsonb_build_object(
      'status', 'stale',
      'message', 'The generated assignment changed. Review the current board and try again.',
      'currentBaselineAssignmentResultId', current_baseline_id,
      'currentEffectiveNurseId', current_effective_nurse_id,
      'activeAssignmentOverridesByBedId', active_projection
    );
  end if;

  if current_effective_nurse_id is distinct from p_from_nurse_id then
    return jsonb_build_object(
      'status', 'stale',
      'message', 'This bed assignment changed. Review the current board and try again.',
      'currentBaselineAssignmentResultId', current_baseline_id,
      'currentEffectiveNurseId', current_effective_nurse_id,
      'activeAssignmentOverridesByBedId', active_projection
    );
  end if;

  if generated_assignment is null then
    raise exception 'This bed does not have a generated assignment.';
  end if;

  select bed.value
  into bed_record
  from jsonb_array_elements(
    coalesce(shift_row.shift_snapshot -> 'beds', '[]'::jsonb)
  ) bed
  where bed.value ->> 'id' = p_bed_id
  limit 1;

  if bed_record is null then
    raise exception 'This bed is no longer part of the active shift.';
  end if;

  room_id := bed_record ->> 'roomId';

  select state.value
  into bed_state
  from jsonb_array_elements(
    coalesce(shift_row.shift_snapshot -> 'bedStates', '[]'::jsonb)
  ) state
  where state.value ->> 'bedId' = p_bed_id
  limit 1;

  if bed_state is null
    or coalesce(btrim(bed_state #>> '{patient,initials}'), '') = '' then
    raise exception 'Only an occupied bed can be moved.';
  end if;

  select nurse.value
  into target_nurse
  from jsonb_array_elements(
    coalesce(shift_row.shift_snapshot -> 'nurses', '[]'::jsonb)
  ) nurse
  where nurse.value ->> 'id' = p_to_nurse_id
  limit 1;

  if target_nurse is null then
    raise exception 'The selected nurse is no longer on this shift.';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(
      coalesce(
        shift_row.shift_snapshot #> '{assignmentResult,roomCoverage}',
        '[]'::jsonb
      )
    ) coverage
    where coverage.value ->> 'roomId' = room_id
      and exists (
        select 1
        from jsonb_array_elements_text(
          coalesce(coverage.value -> 'nurseIds', '[]'::jsonb)
        ) covered_nurse
        where covered_nurse.value = p_to_nurse_id
      )
  ) then
    raise exception 'The selected nurse does not cover this room.';
  end if;

  if bed_state ->> 'acuity' = 'red'
    and target_nurse ->> 'licenseType' <> 'RN' then
    raise exception 'A red-acuity bed must be assigned to an RN.';
  end if;

  if p_related_swap_request_id is not null and not exists (
    select 1
    from jsonb_array_elements(
      coalesce(shift_row.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
    ) request
    where request.value ->> 'id' = p_related_swap_request_id
      and request.value ->> 'type' = 'swap'
      and request.value ->> 'status' = 'accepted'
      and request.value ->> 'sourceBedId' = p_bed_id
  ) then
    raise exception 'Only an accepted swap for this bed can be linked.';
  end if;

  select count(*)::integer
  into target_load_after
  from jsonb_array_elements(
    coalesce(
      shift_row.shift_snapshot #> '{assignmentResult,bedAssignments}',
      '[]'::jsonb
    )
  ) assignment
  left join public.manual_assignment_overrides active_override
    on active_override.shift_id = p_shift_id
    and active_override.bed_id = assignment.value ->> 'bedId'
    and active_override.status = 'active'
  where case
    when assignment.value ->> 'bedId' = p_bed_id then p_to_nurse_id
    else coalesce(active_override.to_nurse_id, assignment.value ->> 'nurseId')
  end = p_to_nurse_id;

  target_max_load := (target_nurse ->> 'maxPatientLoad')::integer;

  if exists (
    select 1
    from jsonb_array_elements(
      coalesce(
        shift_row.shift_snapshot #> '{assignmentResult,roomCoverage}',
        '[]'::jsonb
      )
    ) coverage
    join lateral jsonb_array_elements(
      coalesce(shift_row.shift_snapshot -> 'rooms', '[]'::jsonb)
    ) room
      on room.value ->> 'id' = coverage.value ->> 'roomId'
    where room.value ->> 'doctorSideId' =
      shift_row.shift_snapshot ->> 'admittingDoctorSideId'
      and exists (
        select 1
        from jsonb_array_elements_text(
          coalesce(coverage.value -> 'nurseIds', '[]'::jsonb)
        ) covered_nurse
        where covered_nurse.value = p_to_nurse_id
      )
  ) then
    target_side_limit := (
      shift_row.shift_snapshot #>> '{sideLoadLimits,admitting,max}'
    )::integer;
  else
    target_side_limit := (
      shift_row.shift_snapshot #>> '{sideLoadLimits,nonAdmitting,max}'
    )::integer;
  end if;

  if target_load_after > target_max_load and not exists (
    select 1
    from jsonb_array_elements(p_warning_acknowledgements) acknowledgement
    where acknowledgement.value ->> 'warningType' = 'over_max_load'
  ) then
    raise exception 'Acknowledge the max-load warning before confirming.';
  end if;

  if target_load_after > target_side_limit and not exists (
    select 1
    from jsonb_array_elements(p_warning_acknowledgements) acknowledgement
    where acknowledgement.value ->> 'warningType' = 'over_side_load_limit'
  ) then
    raise exception 'Acknowledge the side-load warning before confirming.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', coalesce(
            nullif(acknowledgement.value ->> 'id', ''),
            'override-warning-' || replace(gen_random_uuid()::text, '-', '')
          ),
          'warningType', acknowledgement.value ->> 'warningType',
          'message', acknowledgement.value ->> 'message',
          'nurseId', acknowledgement.value ->> 'nurseId',
          'bedId', acknowledgement.value ->> 'bedId',
          'acknowledgedByProfileId', current_profile_id,
          'acknowledgedAt', confirmed_at
        )
      )
    ),
    '[]'::jsonb
  )
  into normalized_acknowledgements
  from jsonb_array_elements(p_warning_acknowledgements) acknowledgement
  where acknowledgement.value ->> 'warningType' in (
    'over_side_load_limit',
    'over_max_load',
    'team_imbalance'
  )
    and coalesce(btrim(acknowledgement.value ->> 'message'), '') <> '';

  update public.manual_assignment_overrides
  set
    status = 'superseded',
    superseded_at = confirmed_at
  where shift_id = p_shift_id
    and bed_id = p_bed_id
    and status = 'active';

  insert into public.manual_assignment_overrides (
    shift_id,
    baseline_assignment_result_id,
    bed_id,
    from_nurse_id,
    to_nurse_id,
    created_by_profile_id,
    created_at,
    status,
    related_swap_request_id,
    warning_acknowledgements,
    client_mutation_id
  )
  values (
    p_shift_id,
    p_baseline_assignment_result_id,
    p_bed_id,
    p_from_nurse_id,
    p_to_nurse_id,
    current_profile_id,
    confirmed_at,
    'active',
    p_related_swap_request_id,
    normalized_acknowledgements,
    p_client_mutation_id
  )
  returning * into saved_override;

  update public.active_shifts
  set updated_at = confirmed_at
  where id = p_shift_id;

  select coalesce(
    jsonb_object_agg(
      active_override.bed_id,
      jsonb_build_object(
        'id', active_override.id,
        'shiftId', active_override.shift_id,
        'baselineAssignmentResultId', active_override.baseline_assignment_result_id,
        'bedId', active_override.bed_id,
        'fromNurseId', active_override.from_nurse_id,
        'toNurseId', active_override.to_nurse_id,
        'createdByProfileId', active_override.created_by_profile_id,
        'createdAt', active_override.created_at,
        'status', active_override.status,
        'serverSequence', active_override.server_sequence,
        'relatedSwapRequestId', active_override.related_swap_request_id,
        'warningAcknowledgements', active_override.warning_acknowledgements
      )
    ),
    '{}'::jsonb
  )
  into active_projection
  from public.manual_assignment_overrides active_override
  where active_override.shift_id = p_shift_id
    and active_override.status = 'active';

  return jsonb_build_object(
    'status', 'saved',
    'override', jsonb_build_object(
      'id', saved_override.id,
      'shiftId', saved_override.shift_id,
      'baselineAssignmentResultId', saved_override.baseline_assignment_result_id,
      'bedId', saved_override.bed_id,
      'fromNurseId', saved_override.from_nurse_id,
      'toNurseId', saved_override.to_nurse_id,
      'createdByProfileId', saved_override.created_by_profile_id,
      'createdAt', saved_override.created_at,
      'status', saved_override.status,
      'serverSequence', saved_override.server_sequence,
      'relatedSwapRequestId', saved_override.related_swap_request_id,
      'warningAcknowledgements', saved_override.warning_acknowledgements
    ),
    'activeAssignmentOverridesByBedId', active_projection
  );
end;
$$;

revoke all on function public.confirm_manual_assignment_override(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text
) from public, anon;

grant execute on function public.confirm_manual_assignment_override(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text
) to authenticated;
```

The row lock on `active_shifts` serializes competing writes for the same shift.
The partial unique index independently guarantees that concurrent or faulty
writes cannot leave two active rows for one `(shift_id, bed_id)` pair.

## Manual Server Checks

Run these after exercising the RPC with an owning charge account:

```sql
-- At most one active row per bed. This must return zero rows.
select shift_id, bed_id, count(*)
from public.manual_assignment_overrides
where status = 'active'
group by shift_id, bed_id
having count(*) > 1;

-- History remains ordered and includes superseded rows.
select
  shift_id,
  bed_id,
  from_nurse_id,
  to_nurse_id,
  status,
  server_sequence,
  created_at,
  superseded_at
from public.manual_assignment_overrides
order by shift_id, bed_id, server_sequence;

-- Routine reads use only this active projection query.
select
  id,
  shift_id,
  baseline_assignment_result_id,
  bed_id,
  from_nurse_id,
  to_nurse_id,
  created_by_profile_id,
  created_at,
  status,
  superseded_at,
  server_sequence,
  related_swap_request_id,
  warning_acknowledgements,
  client_mutation_id
from public.manual_assignment_overrides
where shift_id = '<active-shift-id>'::uuid
  and status = 'active';
```

Also verify with separate authenticated sessions:

1. The owning charge account can confirm a valid move.
2. Another charge account and a joined nurse receive an authorization error.
3. A stale baseline or source nurse returns `status = stale` without inserting
   or superseding a row.
4. A red bed to an LPN is rejected.
5. Reusing `clientMutationId` returns the first result without another insert.
6. A required overload acknowledgement is rejected when missing and stored
   with server-owned actor/time fields when present.
