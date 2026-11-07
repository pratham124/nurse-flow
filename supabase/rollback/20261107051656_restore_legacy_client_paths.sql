-- ROLLBACK for 20261107051656_retire_legacy_client_paths. Not a migration: it lives
-- outside supabase/migrations so the CLI never applies it by accident.
-- Restores the 16 RPCs, 19 client policies, client table/sequence grants, and the
-- supabase_realtime publication membership exactly as they were before ticket 23.
-- Generated from supabase/baseline/functions.json (the live definitions hashed
-- identical to it on 2026-11-07) and the live dev/prod catalog of 2026-11-07.
-- Production use: copy it into supabase/migrations under a new timestamp
-- (fix-forward), review, and apply like any other migration.
BEGIN;
-- The captured policy expressions name tables without a schema.
SET LOCAL search_path TO public;

-- 1. Functions. CREATE (not OR REPLACE) so a half-restored database fails loudly.

CREATE FUNCTION public.validate_shift_nurse_invite_code(invite_token_hash text)
 RETURNS TABLE(status text, reason text, invite_id uuid, shift_id uuid, nurse_id text, nurse_name text, floor_name text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  current_profile_id uuid;
  existing_access record;
  invite_row public.shift_nurse_invites%rowtype;
  nurse_snapshot jsonb;
  shift_row public.active_shifts%rowtype;
begin
  select id
  into current_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if current_profile_id is null then
    return query select
      'blocked', 'not_found', null::uuid, null::uuid,
      null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  select *
  into invite_row
  from public.shift_nurse_invites
  where token_hash = invite_token_hash
  order by created_at desc
  limit 1;

  if not found then
    return query select
      'blocked', 'not_found', null::uuid, null::uuid,
      null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  if invite_row.status = 'revoked' then
    return query select
      'blocked', 'revoked', invite_row.id, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text, invite_row.expires_at;
    return;
  end if;

  if invite_row.status = 'used' then
    return query select
      'blocked', 'already_used', invite_row.id, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text, invite_row.expires_at;
    return;
  end if;

  if invite_row.status = 'expired' or invite_row.expires_at <= now() then
    return query select
      'blocked', 'expired', invite_row.id, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text, invite_row.expires_at;
    return;
  end if;

  select *
  into shift_row
  from public.active_shifts
  where id = invite_row.shift_id;

  if not found or shift_row.ended_at is not null then
    return query select
      'blocked', 'ended_shift', invite_row.id, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text, invite_row.expires_at;
    return;
  end if;

  select nurse
  into nurse_snapshot
  from jsonb_array_elements(
    coalesce(shift_row.shift_snapshot -> 'nurses', '[]'::jsonb)
  ) nurse
  where nurse ->> 'id' = invite_row.nurse_id
  limit 1;

  if nurse_snapshot is null then
    return query select
      'blocked', 'stale_nurse', invite_row.id, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text, invite_row.expires_at;
    return;
  end if;

  select access.shift_id, access.nurse_id
  into existing_access
  from public.shift_nurse_access access
  join public.active_shifts active_shift
    on active_shift.id = access.shift_id
  where access.nurse_profile_id = current_profile_id
    and access.status = 'linked'
    and active_shift.ended_at is null
  limit 1;

  if found and (
    existing_access.shift_id <> invite_row.shift_id or
    existing_access.nurse_id <> invite_row.nurse_id
  ) then
    return query select
      'blocked', 'participation_conflict', invite_row.id, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text, invite_row.expires_at;
    return;
  end if;

  return query select
    'valid',
    null::text,
    invite_row.id,
    invite_row.shift_id,
    invite_row.nurse_id,
    nurse_snapshot ->> 'name',
    shift_row.shift_snapshot ->> 'floorName',
    invite_row.expires_at;
end;
$function$;

ALTER FUNCTION public.validate_shift_nurse_invite_code(invite_token_hash text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.validate_shift_nurse_invite_code(invite_token_hash text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_shift_nurse_invite_code(invite_token_hash text) TO anon, authenticated, service_role;

CREATE FUNCTION public.accept_shift_nurse_invite_code(invite_token_hash text)
 RETURNS TABLE(status text, reason text, access_id uuid, shift_id uuid, nurse_id text, nurse_name text, floor_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  current_profile_id uuid;
  existing_nurse_access public.shift_nurse_access%rowtype;
  existing_profile_access record;
  invite_row public.shift_nurse_invites%rowtype;
  linked_access_id uuid;
  nurse_snapshot jsonb;
  shift_row public.active_shifts%rowtype;
  updated_at_time timestamptz := now();
begin
  select id
  into current_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if current_profile_id is null then
    return query select
      'blocked', 'not_found', null::uuid, null::uuid,
      null::text, null::text, null::text;
    return;
  end if;

  if exists (
    select 1
    from public.active_shifts
    where charge_profile_id = current_profile_id
      and ended_at is null
  ) then
    return query select
      'blocked', 'participation_conflict', null::uuid, null::uuid,
      null::text, null::text, null::text;
    return;
  end if;

  select *
  into invite_row
  from public.shift_nurse_invites
  where token_hash = invite_token_hash
  order by created_at desc
  limit 1
  for update;

  if not found then
    return query select
      'blocked', 'not_found', null::uuid, null::uuid,
      null::text, null::text, null::text;
    return;
  end if;

  if invite_row.status = 'revoked' then
    return query select
      'blocked', 'revoked', null::uuid, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text;
    return;
  end if;

  if invite_row.status = 'used' then
    return query select
      'blocked', 'already_used', null::uuid, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text;
    return;
  end if;

  if invite_row.status = 'expired' or invite_row.expires_at <= updated_at_time then
    return query select
      'blocked', 'expired', null::uuid, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text;
    return;
  end if;

  select *
  into shift_row
  from public.active_shifts
  where id = invite_row.shift_id;

  if not found or shift_row.ended_at is not null then
    return query select
      'blocked', 'ended_shift', null::uuid, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text;
    return;
  end if;

  select nurse
  into nurse_snapshot
  from jsonb_array_elements(
    coalesce(shift_row.shift_snapshot -> 'nurses', '[]'::jsonb)
  ) nurse
  where nurse ->> 'id' = invite_row.nurse_id
  limit 1;

  if nurse_snapshot is null then
    return query select
      'blocked', 'stale_nurse', null::uuid, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text;
    return;
  end if;

  select access.shift_id, access.nurse_id
  into existing_profile_access
  from public.shift_nurse_access access
  join public.active_shifts active_shift
    on active_shift.id = access.shift_id
  where access.nurse_profile_id = current_profile_id
    and access.status = 'linked'
    and active_shift.ended_at is null
  limit 1;

  if found and (
    existing_profile_access.shift_id <> invite_row.shift_id or
    existing_profile_access.nurse_id <> invite_row.nurse_id
  ) then
    return query select
      'blocked', 'participation_conflict', null::uuid, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text;
    return;
  end if;

  select *
  into existing_nurse_access
  from public.shift_nurse_access access
  where access.shift_id = invite_row.shift_id
    and access.nurse_id = invite_row.nurse_id
    and access.status = 'linked'
  order by access.updated_at desc
  limit 1
  for update;

  if found and existing_nurse_access.nurse_profile_id is distinct from current_profile_id then
    return query select
      'blocked', 'already_used', null::uuid, invite_row.shift_id,
      invite_row.nurse_id, null::text, null::text;
    return;
  end if;

  if found then
    linked_access_id := existing_nurse_access.id;
  else
    select *
    into existing_nurse_access
    from public.shift_nurse_access access
    where access.shift_id = invite_row.shift_id
      and access.nurse_id = invite_row.nurse_id
      and access.status in ('pending_link', 'removed')
    order by access.updated_at desc
    limit 1
    for update;

    if found then
      update public.shift_nurse_access
      set
        nurse_name = nurse_snapshot ->> 'name',
        nurse_profile_id = current_profile_id,
        nurse_email = null,
        status = 'linked',
        updated_at = updated_at_time
      where id = existing_nurse_access.id
      returning id into linked_access_id;
    else
      insert into public.shift_nurse_access (
        shift_id,
        nurse_id,
        nurse_name,
        nurse_profile_id,
        nurse_email,
        status,
        updated_at
      )
      values (
        invite_row.shift_id,
        invite_row.nurse_id,
        nurse_snapshot ->> 'name',
        current_profile_id,
        null,
        'linked',
        updated_at_time
      )
      returning id into linked_access_id;
    end if;
  end if;

  update public.shift_nurse_invites
  set
    status = 'used',
    used_at = updated_at_time,
    used_by_profile_id = current_profile_id,
    updated_at = updated_at_time
  where id = invite_row.id;

  return query select
    'joined',
    null::text,
    linked_access_id,
    invite_row.shift_id,
    invite_row.nurse_id,
    nurse_snapshot ->> 'name',
    shift_row.shift_snapshot ->> 'floorName';
end;
$function$;

ALTER FUNCTION public.accept_shift_nurse_invite_code(invite_token_hash text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.accept_shift_nurse_invite_code(invite_token_hash text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_shift_nurse_invite_code(invite_token_hash text) TO anon, authenticated, service_role;

CREATE FUNCTION public.get_joined_nurse_assignment_view()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

ALTER FUNCTION public.get_joined_nurse_assignment_view() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_joined_nurse_assignment_view() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_joined_nurse_assignment_view() TO anon, authenticated, service_role;

CREATE FUNCTION public.confirm_manual_assignment_override(p_shift_id uuid, p_baseline_assignment_result_id text, p_bed_id text, p_from_nurse_id text, p_to_nurse_id text, p_warning_acknowledgements jsonb, p_related_swap_request_id text, p_client_mutation_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
          'message', case acknowledgement.value ->> 'warningType'
            when 'over_max_load' then format(
              '%s has %s assigned patients, above their max load of %s.',
              coalesce(
                nullif(btrim(target_nurse ->> 'name'), ''),
                'The selected nurse'
              ),
              target_load_after,
              target_max_load
            )
            when 'over_side_load_limit' then format(
              '%s has %s assigned patients, above the side load limit of %s.',
              coalesce(
                nullif(btrim(target_nurse ->> 'name'), ''),
                'The selected nurse'
              ),
              target_load_after,
              target_side_limit
            )
            else acknowledgement.value ->> 'message'
          end,
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
    and (
      acknowledgement.value ->> 'warningType' in (
        'over_side_load_limit',
        'over_max_load'
      )
      or coalesce(btrim(acknowledgement.value ->> 'message'), '') <> ''
    );

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
$function$;

ALTER FUNCTION public.confirm_manual_assignment_override(p_shift_id uuid, p_baseline_assignment_result_id text, p_bed_id text, p_from_nurse_id text, p_to_nurse_id text, p_warning_acknowledgements jsonb, p_related_swap_request_id text, p_client_mutation_id text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.confirm_manual_assignment_override(p_shift_id uuid, p_baseline_assignment_result_id text, p_bed_id text, p_from_nurse_id text, p_to_nurse_id text, p_warning_acknowledgements jsonb, p_related_swap_request_id text, p_client_mutation_id text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_manual_assignment_override(p_shift_id uuid, p_baseline_assignment_result_id text, p_bed_id text, p_from_nurse_id text, p_to_nurse_id text, p_warning_acknowledgements jsonb, p_related_swap_request_id text, p_client_mutation_id text) TO authenticated, service_role;

CREATE FUNCTION public.submit_joined_nurse_issue_request(request_message text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

ALTER FUNCTION public.submit_joined_nurse_issue_request(request_message text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.submit_joined_nurse_issue_request(request_message text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_joined_nurse_issue_request(request_message text) TO anon, authenticated, service_role;

CREATE FUNCTION public.submit_joined_nurse_swap_request(source_bed_id text, request_message text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

ALTER FUNCTION public.submit_joined_nurse_swap_request(source_bed_id text, request_message text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.submit_joined_nurse_swap_request(source_bed_id text, request_message text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_joined_nurse_swap_request(source_bed_id text, request_message text) TO anon, authenticated, service_role;

CREATE FUNCTION public.update_shift_nurse_issue_status(p_request_id text, p_next_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

ALTER FUNCTION public.update_shift_nurse_issue_status(p_request_id text, p_next_status text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_shift_nurse_issue_status(p_request_id text, p_next_status text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_shift_nurse_issue_status(p_request_id text, p_next_status text) TO authenticated, service_role;

CREATE FUNCTION public.resolve_shift_nurse_swap_request(request_id text, next_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

ALTER FUNCTION public.resolve_shift_nurse_swap_request(request_id text, next_status text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_shift_nurse_swap_request(request_id text, next_status text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_shift_nurse_swap_request(request_id text, next_status text) TO anon, authenticated, service_role;

CREATE FUNCTION public.list_nurse_request_messages(p_shift_id uuid, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  messages jsonb;
  normalized_request_id text := btrim(p_request_id);
begin
  if coalesce(normalized_request_id, '') = '' then
    raise exception 'Choose a nurse request before loading messages.';
  end if;

  if public.get_nurse_request_thread_actor(
    p_shift_id,
    normalized_request_id
  ) is null then
    raise exception 'You do not have access to this request thread.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', message.id,
        'shiftId', message.shift_id,
        'requestId', message.request_id,
        'authorProfileId', message.author_profile_id,
        'body', message.body,
        'createdAt', message.created_at,
        'clientMutationId', message.client_mutation_id
      )
      order by message.created_at, message.id
    ),
    '[]'::jsonb
  )
  into messages
  from public.nurse_request_messages message
  where message.shift_id = p_shift_id
    and message.request_id = normalized_request_id;

  return messages;
end;
$function$;

ALTER FUNCTION public.list_nurse_request_messages(p_shift_id uuid, p_request_id text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.list_nurse_request_messages(p_shift_id uuid, p_request_id text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_nurse_request_messages(p_shift_id uuid, p_request_id text) TO authenticated, service_role;

CREATE FUNCTION public.append_nurse_request_message(p_shift_id uuid, p_request_id text, p_body text, p_client_mutation_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_profile_id uuid;
  duplicate_message boolean := false;
  normalized_mutation_id text := nullif(btrim(p_client_mutation_id), '');
  normalized_request_id text := btrim(p_request_id);
  saved_message public.nurse_request_messages%rowtype;
  trimmed_body text := btrim(p_body);
begin
  if coalesce(normalized_request_id, '') = '' then
    raise exception 'Choose a nurse request before sending a message.';
  end if;

  if coalesce(trimmed_body, '') = '' then
    raise exception 'Write a message before sending.';
  end if;

  if char_length(trimmed_body) > 1000 then
    raise exception 'Keep messages to 1000 characters or fewer.';
  end if;

  if normalized_mutation_id is not null
    and char_length(normalized_mutation_id) > 120 then
    raise exception 'Message retry identifiers must be 120 characters or fewer.';
  end if;

  actor_profile_id := public.get_nurse_request_thread_actor(
    p_shift_id,
    normalized_request_id
  );

  if actor_profile_id is null then
    raise exception 'You do not have access to this request thread.';
  end if;

  if normalized_mutation_id is not null then
    select message.*
    into saved_message
    from public.nurse_request_messages message
    where message.shift_id = p_shift_id
      and message.author_profile_id = actor_profile_id
      and message.client_mutation_id = normalized_mutation_id;

    if found then
      if saved_message.request_id <> normalized_request_id
        or saved_message.body <> trimmed_body then
        raise exception 'That message retry identifier was already used.';
      end if;

      duplicate_message := true;
    end if;
  end if;

  if not duplicate_message then
    begin
      insert into public.nurse_request_messages (
        shift_id,
        request_id,
        author_profile_id,
        body,
        client_mutation_id
      )
      values (
        p_shift_id,
        normalized_request_id,
        actor_profile_id,
        trimmed_body,
        normalized_mutation_id
      )
      returning * into saved_message;
    exception
      when unique_violation then
        if normalized_mutation_id is null then
          raise;
        end if;

        select message.*
        into saved_message
        from public.nurse_request_messages message
        where message.shift_id = p_shift_id
          and message.author_profile_id = actor_profile_id
          and message.client_mutation_id = normalized_mutation_id;

        if not found
          or saved_message.request_id <> normalized_request_id
          or saved_message.body <> trimmed_body then
          raise exception 'That message retry identifier was already used.';
        end if;

        duplicate_message := true;
    end;
  end if;

  return jsonb_build_object(
    'status', case when duplicate_message then 'duplicate' else 'saved' end,
    'message', jsonb_build_object(
      'id', saved_message.id,
      'shiftId', saved_message.shift_id,
      'requestId', saved_message.request_id,
      'authorProfileId', saved_message.author_profile_id,
      'body', saved_message.body,
      'createdAt', saved_message.created_at,
      'clientMutationId', saved_message.client_mutation_id
    )
  );
end;
$function$;

ALTER FUNCTION public.append_nurse_request_message(p_shift_id uuid, p_request_id text, p_body text, p_client_mutation_id text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.append_nurse_request_message(p_shift_id uuid, p_request_id text, p_body text, p_client_mutation_id text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.append_nurse_request_message(p_shift_id uuid, p_request_id text, p_body text, p_client_mutation_id text) TO authenticated, service_role;

CREATE FUNCTION public.reset_active_shift_for_editing(p_shift_id uuid, p_expected_baseline_assignment_result_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_baseline_id text;
  current_profile_id uuid;
  next_shift_snapshot jsonb;
  reset_at timestamptz := now();
  shift_row public.active_shifts%rowtype;
begin
  select profiles.id
  into current_profile_id
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.role = 'charge_nurse'
  limit 1;

  if current_profile_id is null then
    raise exception 'Sign in as a charge nurse to edit an active shift.';
  end if;

  select active_shift.*
  into shift_row
  from public.active_shifts active_shift
  where active_shift.id = p_shift_id
  for update;

  if not found
    or shift_row.charge_profile_id <> current_profile_id
    or shift_row.ended_at is not null then
    raise exception 'This active shift is no longer available for editing.';
  end if;

  current_baseline_id := nullif(
    btrim(shift_row.shift_snapshot #>> '{assignmentResult,id}'),
    ''
  );

  if current_baseline_id is distinct from
    nullif(btrim(p_expected_baseline_assignment_result_id), '') then
    return jsonb_build_object(
      'status', 'stale',
      'message', 'The assignment changed. Review the current board before editing.'
    );
  end if;

  if current_baseline_id is null then
    return jsonb_build_object(
      'status', 'saved',
      'shiftSnapshot', shift_row.shift_snapshot,
      'activeAssignmentOverridesByBedId', '{}'::jsonb
    );
  end if;

  next_shift_snapshot := jsonb_set(
    jsonb_set(
      shift_row.shift_snapshot - 'assignmentResult',
      '{flags}',
      '[]'::jsonb,
      true
    ),
    '{status}',
    '"setup"'::jsonb,
    true
  );

  update public.manual_assignment_overrides
  set
    status = 'superseded',
    superseded_at = reset_at
  where shift_id = p_shift_id
    and status = 'active';

  update public.shift_nurse_invites
  set
    status = 'expired',
    updated_at = reset_at
  where shift_id = p_shift_id
    and status = 'active';

  update public.shift_nurse_access
  set
    status = 'removed',
    updated_at = reset_at
  where shift_id = p_shift_id
    and status in ('pending_link', 'linked');

  update public.active_shifts
  set
    shift_snapshot = next_shift_snapshot,
    status = 'setup',
    updated_at = reset_at
  where id = p_shift_id;

  return jsonb_build_object(
    'status', 'saved',
    'shiftSnapshot', next_shift_snapshot,
    'activeAssignmentOverridesByBedId', '{}'::jsonb
  );
end;
$function$;

ALTER FUNCTION public.reset_active_shift_for_editing(p_shift_id uuid, p_expected_baseline_assignment_result_id text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reset_active_shift_for_editing(p_shift_id uuid, p_expected_baseline_assignment_result_id text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_active_shift_for_editing(p_shift_id uuid, p_expected_baseline_assignment_result_id text) TO authenticated, service_role;

CREATE FUNCTION public.rerun_active_shift_assignment(p_shift_id uuid, p_expected_baseline_assignment_result_id text, p_next_shift_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  active_projection jsonb;
  current_baseline_id text;
  current_profile_id uuid;
  rerun_at timestamptz := now();
  shift_row public.active_shifts%rowtype;
begin
  select profiles.id
  into current_profile_id
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.role = 'charge_nurse'
  limit 1;

  if current_profile_id is null then
    raise exception 'Sign in as a charge nurse to rerun assignment.';
  end if;

  select active_shift.*
  into shift_row
  from public.active_shifts active_shift
  where active_shift.id = p_shift_id
  for update;

  if not found
    or shift_row.charge_profile_id <> current_profile_id
    or shift_row.ended_at is not null then
    raise exception 'This active shift is not available for assignment rerun.';
  end if;

  current_baseline_id := shift_row.shift_snapshot #>> '{assignmentResult,id}';

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

  if current_baseline_id is distinct from p_expected_baseline_assignment_result_id then
    return jsonb_build_object(
      'status', 'stale',
      'message', 'The assignment baseline changed. Review the refreshed shift and try again.',
      'activeAssignmentOverridesByBedId', active_projection
    );
  end if;

  if p_next_shift_snapshot ->> 'id' is distinct from p_shift_id::text
    or coalesce(btrim(p_next_shift_snapshot #>> '{assignmentResult,id}'), '') = ''
    or p_next_shift_snapshot ->> 'status' <> 'assigned' then
    raise exception 'The rerun snapshot is invalid.';
  end if;

  update public.manual_assignment_overrides
  set status = 'superseded', superseded_at = rerun_at
  where shift_id = p_shift_id
    and status = 'active';

  update public.active_shifts
  set
    shift_snapshot = p_next_shift_snapshot,
    status = 'assigned',
    updated_at = rerun_at
  where id = p_shift_id;

  return jsonb_build_object(
    'status', 'saved',
    'shiftSnapshot', p_next_shift_snapshot,
    'activeAssignmentOverridesByBedId', '{}'::jsonb
  );
end;
$function$;

ALTER FUNCTION public.rerun_active_shift_assignment(p_shift_id uuid, p_expected_baseline_assignment_result_id text, p_next_shift_snapshot jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rerun_active_shift_assignment(p_shift_id uuid, p_expected_baseline_assignment_result_id text, p_next_shift_snapshot jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rerun_active_shift_assignment(p_shift_id uuid, p_expected_baseline_assignment_result_id text, p_next_shift_snapshot jsonb) TO service_role;

CREATE FUNCTION public.prepare_optimizer_run(p_shift_id uuid, p_client_mutation_id text, p_expected_shift_revision timestamp with time zone, p_expected_baseline_assignment_result_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_profile_id uuid;
  shift_row public.active_shifts%rowtype;
  existing_run public.optimizer_runs%rowtype;
  other_running_run public.optimizer_runs%rowtype;
  created_run public.optimizer_runs%rowtype;
  current_baseline_id text;
  normalized_baseline_id text;
  normalized_mutation_id text;
  request_fingerprint text;
  existing_run_found boolean;
  current_preconditions_match boolean;
begin
  normalized_mutation_id := nullif(btrim(p_client_mutation_id), '');
  normalized_baseline_id := nullif(
    btrim(p_expected_baseline_assignment_result_id),
    ''
  );

  if p_shift_id is null
    or normalized_mutation_id is null
    or p_expected_shift_revision is null then
    return jsonb_build_object('status', 'conflict');
  end if;

  select profiles.id
  into current_profile_id
  from public.profiles
  where profiles.auth_user_id = (select auth.uid())
    and profiles.role = 'charge_nurse'
  limit 1;

  if current_profile_id is null then
    raise exception using
      errcode = '42501',
      message = 'The signed-in account cannot prepare optimizer runs.';
  end if;

  request_fingerprint := encode(
    extensions.digest(
      concat_ws(
        E'\x1f',
        p_shift_id::text,
        p_expected_shift_revision::text,
        coalesce(normalized_baseline_id, '')
      ),
      'sha256'
    ),
    'hex'
  );

  -- Lock order is always optimizer run, then active shift. Finalization uses
  -- the same order, which avoids a retry/finalization deadlock.
  select optimizer_runs.*
  into existing_run
  from public.optimizer_runs
  where optimizer_runs.shift_id = p_shift_id
    and optimizer_runs.requested_by_profile_id = current_profile_id
    and optimizer_runs.client_mutation_id = normalized_mutation_id
  for update;

  existing_run_found := found;

  select active_shifts.*
  into shift_row
  from public.active_shifts
  where active_shifts.id = p_shift_id
  for update;

  if not found or shift_row.charge_profile_id <> current_profile_id then
    raise exception using
      errcode = '42501',
      message = 'The signed-in account does not own this shift.';
  end if;

  -- Two requests with the same new mutation can both miss the first lookup.
  -- Once this request owns the shift lock, recheck without taking the run lock.
  -- A finalizer cannot change that run while waiting for this same shift lock.
  if not existing_run_found then
    select optimizer_runs.*
    into existing_run
    from public.optimizer_runs
    where optimizer_runs.shift_id = p_shift_id
      and optimizer_runs.requested_by_profile_id = current_profile_id
      and optimizer_runs.client_mutation_id = normalized_mutation_id;

    existing_run_found := found;
  end if;

  current_baseline_id := nullif(
    btrim(shift_row.shift_snapshot #>> '{assignmentResult,id}'),
    ''
  );
  current_preconditions_match := shift_row.ended_at is null
    and shift_row.status in ('setup', 'assigned')
    and p_expected_shift_revision is not distinct from shift_row.updated_at
    and normalized_baseline_id is not distinct from current_baseline_id;

  -- Compare the mutation before current preconditions. A completed run changed
  -- the revision and baseline, but its retry must return the saved result.
  if existing_run_found then
    if existing_run.request_fingerprint <> request_fingerprint then
      return jsonb_build_object(
        'status', 'conflict',
        'runId', existing_run.id
      );
    end if;

    -- A process or network failure can leave a run marked `running`. Immediate
    -- retries must not duplicate its solve, but after the 90-second lease (past
    -- the 75-second host cutoff) the same mutation may safely reclaim it.
    if existing_run.status = 'running'
      and existing_run.started_at <= now() - interval '90 seconds' then
      if not current_preconditions_match then
        update public.optimizer_runs
        set
          status = 'stale',
          outcome_summary = jsonb_build_object('errorCode', 'stale'),
          completed_at = now(),
          duration_ms = greatest(
            0,
            floor(extract(epoch from (now() - existing_run.started_at)) * 1000)::integer
          )
        where id = existing_run.id;

        return jsonb_build_object(
          'status', 'stale',
          'runId', existing_run.id
        );
      end if;

      update public.optimizer_runs
      set
        started_at = now(),
        outcome_summary = '{}'::jsonb
      where id = existing_run.id;

      return jsonb_build_object(
        'status', 'prepared',
        'runId', existing_run.id,
        'runStatus', 'running',
        'shiftId', existing_run.shift_id,
        'expectedShiftRevision', existing_run.expected_shift_revision,
        'expectedBaselineAssignmentResultId',
          existing_run.expected_baseline_assignment_result_id,
        'requestFingerprint', existing_run.request_fingerprint,
        'shiftSnapshot', shift_row.shift_snapshot
      );
    end if;

    return jsonb_build_object(
      'status', 'existing',
      'runId', existing_run.id,
      'runStatus', existing_run.status,
      'shiftId', existing_run.shift_id,
      'expectedShiftRevision', existing_run.expected_shift_revision,
      'expectedBaselineAssignmentResultId',
        existing_run.expected_baseline_assignment_result_id,
      'requestFingerprint', existing_run.request_fingerprint,
      'resultId', existing_run.result_id,
      'outcomeSummary', existing_run.outcome_summary
    );
  end if;

  if not current_preconditions_match then
    return jsonb_build_object('status', 'stale');
  end if;

  select optimizer_runs.*
  into other_running_run
  from public.optimizer_runs
  where optimizer_runs.shift_id = p_shift_id
    and optimizer_runs.expected_shift_revision = shift_row.updated_at
    and optimizer_runs.expected_baseline_assignment_result_id
      is not distinct from current_baseline_id
    and optimizer_runs.status = 'running'
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'status', 'in_progress',
      'runId', other_running_run.id,
      'runStatus', other_running_run.status
    );
  end if;

  insert into public.optimizer_runs (
    shift_id,
    requested_by_profile_id,
    client_mutation_id,
    expected_shift_revision,
    expected_baseline_assignment_result_id,
    request_fingerprint
  )
  values (
    shift_row.id,
    current_profile_id,
    normalized_mutation_id,
    shift_row.updated_at,
    current_baseline_id,
    request_fingerprint
  )
  returning * into created_run;

  return jsonb_build_object(
    'status', 'prepared',
    'runId', created_run.id,
    'runStatus', created_run.status,
    'shiftId', created_run.shift_id,
    'expectedShiftRevision', created_run.expected_shift_revision,
    'expectedBaselineAssignmentResultId',
      created_run.expected_baseline_assignment_result_id,
    'requestFingerprint', created_run.request_fingerprint,
    'shiftSnapshot', shift_row.shift_snapshot
  );
end;
$function$;

ALTER FUNCTION public.prepare_optimizer_run(p_shift_id uuid, p_client_mutation_id text, p_expected_shift_revision timestamp with time zone, p_expected_baseline_assignment_result_id text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.prepare_optimizer_run(p_shift_id uuid, p_client_mutation_id text, p_expected_shift_revision timestamp with time zone, p_expected_baseline_assignment_result_id text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prepare_optimizer_run(p_shift_id uuid, p_client_mutation_id text, p_expected_shift_revision timestamp with time zone, p_expected_baseline_assignment_result_id text) TO anon, authenticated, service_role;

CREATE FUNCTION public.finalize_optimizer_run(p_run_id uuid, p_input_fingerprint text, p_optimizer_version text, p_assignment_result jsonb, p_flags jsonb, p_objectives jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  finished_at timestamptz := now();
  run_row public.optimizer_runs%rowtype;
  shift_row public.active_shifts%rowtype;
  current_baseline_id text;
  new_result_id text;
  validation_error text;
  next_shift_snapshot jsonb;
  occupied_bed_count integer;
  assigned_bed_count integer;
  shift_exists boolean;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Only the optimizer service may finalize runs.';
  end if;

  new_result_id := nullif(btrim(p_assignment_result ->> 'id'), '');
  if p_run_id is null
    or nullif(btrim(p_input_fingerprint), '') is null
    or nullif(btrim(p_optimizer_version), '') is null
    or new_result_id is null then
    return jsonb_build_object('status', 'failed');
  end if;

  select optimizer_runs.*
  into run_row
  from public.optimizer_runs
  where optimizer_runs.id = p_run_id
  for update;

  if not found then
    return jsonb_build_object('status', 'failed');
  end if;

  -- A repeated finalization of the same completed run is idempotent.
  if run_row.status = 'succeeded' then
    if run_row.result_id = new_result_id
      and run_row.input_fingerprint = p_input_fingerprint
      and run_row.optimizer_version = p_optimizer_version then
      return jsonb_build_object(
        'status', 'saved',
        'runId', run_row.id,
        'resultId', run_row.result_id
      );
    end if;
    return jsonb_build_object('status', 'failed', 'runId', run_row.id);
  end if;

  if run_row.status = 'stale' then
    return jsonb_build_object('status', 'stale', 'runId', run_row.id);
  end if;
  if run_row.status = 'failed' then
    return jsonb_build_object('status', 'failed', 'runId', run_row.id);
  end if;

  select active_shifts.*
  into shift_row
  from public.active_shifts
  where active_shifts.id = run_row.shift_id
  for update;

  shift_exists := found;

  current_baseline_id := nullif(
    btrim(shift_row.shift_snapshot #>> '{assignmentResult,id}'),
    ''
  );

  if not shift_exists
    or shift_row.charge_profile_id <> run_row.requested_by_profile_id
    or shift_row.ended_at is not null
    or shift_row.status not in ('setup', 'assigned')
    or shift_row.updated_at is distinct from run_row.expected_shift_revision
    or current_baseline_id is distinct from
      run_row.expected_baseline_assignment_result_id then
    update public.optimizer_runs
    set
      status = 'stale',
      input_fingerprint = p_input_fingerprint,
      optimizer_version = p_optimizer_version,
      outcome_summary = jsonb_build_object('errorCode', 'stale'),
      completed_at = finished_at,
      duration_ms = greatest(
        0,
        floor(extract(epoch from (finished_at - run_row.started_at)) * 1000)::integer
      )
    where id = run_row.id;

    return jsonb_build_object('status', 'stale', 'runId', run_row.id);
  end if;

  validation_error := public.optimizer_output_validation_error(
    shift_row.shift_snapshot,
    p_assignment_result,
    p_flags,
    p_objectives
  );

  if validation_error is not null
    or new_result_id is not distinct from
      run_row.expected_baseline_assignment_result_id then
    update public.optimizer_runs
    set
      status = 'failed',
      input_fingerprint = p_input_fingerprint,
      optimizer_version = p_optimizer_version,
      outcome_summary = jsonb_build_object(
        'errorCode',
        coalesce(validation_error, 'result_id_reused')
      ),
      completed_at = finished_at,
      duration_ms = greatest(
        0,
        floor(extract(epoch from (finished_at - run_row.started_at)) * 1000)::integer
      )
    where id = run_row.id;

    return jsonb_build_object('status', 'failed', 'runId', run_row.id);
  end if;

  next_shift_snapshot := jsonb_set(
    jsonb_set(
      jsonb_set(
        shift_row.shift_snapshot,
        '{assignmentResult}',
        p_assignment_result,
        true
      ),
      '{flags}',
      p_flags,
      true
    ),
    '{status}',
    to_jsonb('assigned'::text),
    true
  );

  -- This is the only active_shifts write in the success path. Existing
  -- realtime and notification triggers observe it after the transaction
  -- commits. Stale and failed paths never touch active_shifts.
  update public.active_shifts
  set
    status = 'assigned',
    shift_snapshot = next_shift_snapshot,
    updated_at = finished_at
  where id = shift_row.id;

  if run_row.expected_baseline_assignment_result_id is not null then
    update public.manual_assignment_overrides
    set
      status = 'superseded',
      superseded_at = finished_at
    where shift_id = shift_row.id
      and status = 'active';
  end if;

  select count(*)
  into occupied_bed_count
  from jsonb_array_elements(shift_row.shift_snapshot -> 'bedStates') bed_state
  where nullif(btrim(bed_state #>> '{patient,initials}'), '') is not null
    and bed_state ->> 'acuity' in ('green', 'yellow', 'red');

  assigned_bed_count := jsonb_array_length(
    p_assignment_result -> 'bedAssignments'
  );

  update public.optimizer_runs
  set
    status = 'succeeded',
    input_fingerprint = p_input_fingerprint,
    optimizer_version = p_optimizer_version,
    result_id = new_result_id,
    outcome_summary = jsonb_build_object(
      'assignedBedCount', assigned_bed_count,
      'unassignedBedCount', greatest(0, occupied_bed_count - assigned_bed_count),
      'objectiveSummary', p_objectives
    ),
    completed_at = finished_at,
    duration_ms = greatest(
      0,
      floor(extract(epoch from (finished_at - run_row.started_at)) * 1000)::integer
    )
  where id = run_row.id;

  return jsonb_build_object(
    'status', 'saved',
    'runId', run_row.id,
    'resultId', new_result_id
  );
end;
$function$;

ALTER FUNCTION public.finalize_optimizer_run(p_run_id uuid, p_input_fingerprint text, p_optimizer_version text, p_assignment_result jsonb, p_flags jsonb, p_objectives jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.finalize_optimizer_run(p_run_id uuid, p_input_fingerprint text, p_optimizer_version text, p_assignment_result jsonb, p_flags jsonb, p_objectives jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_optimizer_run(p_run_id uuid, p_input_fingerprint text, p_optimizer_version text, p_assignment_result jsonb, p_flags jsonb, p_objectives jsonb) TO anon, authenticated, service_role;

CREATE FUNCTION public.fail_optimizer_run(p_run_id uuid, p_error_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  finished_at timestamptz := now();
  run_row public.optimizer_runs%rowtype;
  normalized_error_code text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Only the optimizer service may record run failures.';
  end if;

  normalized_error_code := nullif(btrim(p_error_code), '');
  if p_run_id is null or normalized_error_code is null then
    return jsonb_build_object('status', 'failed');
  end if;

  select optimizer_runs.*
  into run_row
  from public.optimizer_runs
  where optimizer_runs.id = p_run_id
  for update;

  if not found then
    return jsonb_build_object('status', 'failed');
  end if;

  if run_row.status = 'running' then
    update public.optimizer_runs
    set
      status = 'failed',
      outcome_summary = jsonb_build_object('errorCode', normalized_error_code),
      completed_at = finished_at,
      duration_ms = greatest(
        0,
        floor(extract(epoch from (finished_at - run_row.started_at)) * 1000)::integer
      )
    where id = run_row.id;
  end if;

  return jsonb_build_object('status', 'recorded', 'runId', run_row.id);
end;
$function$;

ALTER FUNCTION public.fail_optimizer_run(p_run_id uuid, p_error_code text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fail_optimizer_run(p_run_id uuid, p_error_code text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fail_optimizer_run(p_run_id uuid, p_error_code text) TO anon, authenticated, service_role;

CREATE FUNCTION public.optimizer_output_validation_error(p_shift_snapshot jsonb, p_assignment_result jsonb, p_flags jsonb, p_objectives jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  assignment_record jsonb;
  bed_record jsonb;
  bed_state jsonb;
  coverage_record jsonb;
  nurse_record jsonb;
  room_record jsonb;
  objective_name text;
  result_id text;
  assigned_count integer;
  match_count integer;
begin
  if jsonb_typeof(p_assignment_result) <> 'object'
    or jsonb_typeof(p_flags) <> 'array'
    or jsonb_typeof(p_objectives) <> 'object' then
    return 'invalid_output_shape';
  end if;

  result_id := nullif(btrim(p_assignment_result ->> 'id'), '');
  if result_id is null
    or jsonb_typeof(p_assignment_result -> 'generatedTeams') <> 'array'
    or jsonb_typeof(p_assignment_result -> 'roomCoverage') <> 'array'
    or jsonb_typeof(p_assignment_result -> 'bedAssignments') <> 'array' then
    return 'invalid_assignment_result';
  end if;

  if exists (
    select 1
    from (
      select item ->> 'id' as id
      from jsonb_array_elements(p_assignment_result -> 'generatedTeams') item
      union all
      select item ->> 'id'
      from jsonb_array_elements(p_assignment_result -> 'roomCoverage') item
      union all
      select item ->> 'id'
      from jsonb_array_elements(p_assignment_result -> 'bedAssignments') item
      union all
      select item ->> 'id'
      from jsonb_array_elements(p_flags) item
    ) child_ids
    group by child_ids.id
    having child_ids.id is null
      or btrim(child_ids.id) = ''
      or child_ids.id not like result_id || '-%'
      or count(*) > 1
  ) then
    return 'invalid_output_ids';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignment_result -> 'generatedTeams') team
    where nullif(btrim(team ->> 'label'), '') is null
      or jsonb_typeof(team -> 'nurseIds') <> 'array'
  ) then
    return 'invalid_team_shape';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignment_result -> 'roomCoverage') coverage
    where nullif(btrim(coverage ->> 'roomId'), '') is null
      or jsonb_typeof(coverage -> 'nurseIds') <> 'array'
  ) then
    return 'invalid_coverage_shape';
  end if;

  -- Every current nurse must appear on exactly one generated team.
  for nurse_record in
    select value from jsonb_array_elements(p_shift_snapshot -> 'nurses')
  loop
    select count(*)
    into match_count
    from jsonb_array_elements(p_assignment_result -> 'generatedTeams') team,
      lateral jsonb_array_elements_text(team -> 'nurseIds') nurse_id
    where nurse_id = nurse_record ->> 'id';

    if match_count <> 1 then
      return 'invalid_team_membership';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_assignment_result -> 'generatedTeams') team,
      lateral jsonb_array_elements_text(team -> 'nurseIds') nurse_id
    where not exists (
      select 1
      from jsonb_array_elements(p_shift_snapshot -> 'nurses') current_nurse
      where current_nurse ->> 'id' = nurse_id
    )
  ) then
    return 'unknown_team_nurse';
  end if;

  -- Every room has one coverage record. Empty rooms may have no nurse IDs.
  for room_record in
    select value from jsonb_array_elements(p_shift_snapshot -> 'rooms')
  loop
    select count(*)
    into match_count
    from jsonb_array_elements(p_assignment_result -> 'roomCoverage') coverage
    where coverage ->> 'roomId' = room_record ->> 'id';

    if match_count <> 1 then
      return 'invalid_room_coverage';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_assignment_result -> 'roomCoverage') coverage
    where not exists (
      select 1
      from jsonb_array_elements(p_shift_snapshot -> 'rooms') current_room
      where current_room ->> 'id' = coverage ->> 'roomId'
    )
  ) then
    return 'unknown_coverage_room';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignment_result -> 'roomCoverage') coverage,
      lateral jsonb_array_elements_text(coverage -> 'nurseIds') nurse_id
    where not exists (
      select 1
      from jsonb_array_elements(p_shift_snapshot -> 'nurses') current_nurse
      where current_nurse ->> 'id' = nurse_id
    )
  ) then
    return 'unknown_coverage_nurse';
  end if;

  -- Each saved bed assignment must target one occupied bed and current nurse.
  for assignment_record in
    select value
    from jsonb_array_elements(p_assignment_result -> 'bedAssignments')
  loop
    select value
    into bed_record
    from jsonb_array_elements(p_shift_snapshot -> 'beds')
    where value ->> 'id' = assignment_record ->> 'bedId'
    limit 1;

    if not found then
      return 'unknown_assignment_bed';
    end if;

    select value
    into bed_state
    from jsonb_array_elements(p_shift_snapshot -> 'bedStates')
    where value ->> 'bedId' = assignment_record ->> 'bedId'
    limit 1;

    if not found
      or nullif(btrim(bed_state #>> '{patient,initials}'), '') is null
      or bed_state ->> 'acuity' not in ('green', 'yellow', 'red') then
      return 'assignment_to_empty_bed';
    end if;

    select value
    into nurse_record
    from jsonb_array_elements(p_shift_snapshot -> 'nurses')
    where value ->> 'id' = assignment_record ->> 'nurseId'
    limit 1;

    if not found then
      return 'unknown_assignment_nurse';
    end if;

    if bed_state ->> 'acuity' = 'red'
      and nurse_record ->> 'licenseType' <> 'RN' then
      return 'red_bed_requires_rn';
    end if;

    select value
    into coverage_record
    from jsonb_array_elements(p_assignment_result -> 'roomCoverage')
    where value ->> 'roomId' = bed_record ->> 'roomId'
    limit 1;

    if not found or not exists (
      select 1
      from jsonb_array_elements_text(coverage_record -> 'nurseIds') nurse_id
      where nurse_id = assignment_record ->> 'nurseId'
    ) then
      return 'assignment_without_coverage';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_assignment_result -> 'bedAssignments') assignment
    group by assignment ->> 'bedId'
    having count(*) > 1
  ) then
    return 'duplicate_bed_assignment';
  end if;

  for nurse_record in
    select value from jsonb_array_elements(p_shift_snapshot -> 'nurses')
  loop
    if coalesce(nurse_record ->> 'maxPatientLoad', '') !~ '^[0-9]+$' then
      return 'invalid_nurse_capacity';
    end if;

    select count(*)
    into assigned_count
    from jsonb_array_elements(p_assignment_result -> 'bedAssignments') assignment
    where assignment ->> 'nurseId' = nurse_record ->> 'id';

    if assigned_count > (nurse_record ->> 'maxPatientLoad')::integer then
      return 'nurse_capacity_exceeded';
    end if;
  end loop;

  foreach objective_name in array array[
    'unassignedCount',
    'maxNurseAcuityLoad',
    'maxNursePatientCount',
    'redBedOwnerRankSum',
    'sideGuidanceTotalExcess',
    'sideGuidanceNurseCount',
    'teamWeightedAcuityGap',
    'teamPatientCountGap',
    'teamRnCountGap',
    'teamExperienceDistributionGap',
    'teamCapacityGap'
  ]
  loop
    if jsonb_typeof(p_objectives -> objective_name) <> 'number' then
      return 'invalid_objective_summary';
    end if;
  end loop;

  return null;
end;
$function$;

ALTER FUNCTION public.optimizer_output_validation_error(p_shift_snapshot jsonb, p_assignment_result jsonb, p_flags jsonb, p_objectives jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.optimizer_output_validation_error(p_shift_snapshot jsonb, p_assignment_result jsonb, p_flags jsonb, p_objectives jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.optimizer_output_validation_error(p_shift_snapshot jsonb, p_assignment_result jsonb, p_flags jsonb, p_objectives jsonb) TO anon, authenticated, service_role;

-- 2. Client policies.
CREATE POLICY "Charge nurses can create their own active shifts" ON public.active_shifts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = active_shifts.charge_profile_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))));

CREATE POLICY "Charge nurses can read their own active shifts" ON public.active_shifts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = active_shifts.charge_profile_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))));

CREATE POLICY "Charge nurses can update their own active shifts" ON public.active_shifts AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = active_shifts.charge_profile_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = active_shifts.charge_profile_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))));

CREATE POLICY "Charge nurses can create their own templates" ON public.floor_templates AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = floor_templates.owner_profile_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))));

CREATE POLICY "Charge nurses can delete their own templates" ON public.floor_templates AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = floor_templates.owner_profile_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))));

CREATE POLICY "Charge nurses can read their own templates" ON public.floor_templates AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = floor_templates.owner_profile_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))));

CREATE POLICY "Charge nurses can update their own templates" ON public.floor_templates AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = floor_templates.owner_profile_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = floor_templates.owner_profile_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))));

CREATE POLICY "Charge nurses can read override history for their shifts" ON public.manual_assignment_overrides AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (active_shifts
     JOIN profiles ON ((profiles.id = active_shifts.charge_profile_id)))
  WHERE ((active_shifts.id = manual_assignment_overrides.shift_id) AND (profiles.auth_user_id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'charge_nurse'::text)))));

CREATE POLICY "Thread participants can read request messages" ON public.nurse_request_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((get_nurse_request_thread_actor(shift_id, request_id) IS NOT NULL));

CREATE POLICY "Charge nurses can create their own previous snapshots" ON public.previous_shift_snapshots AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = previous_shift_snapshots.charge_profile_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))));

CREATE POLICY "Charge nurses can delete their own previous snapshots" ON public.previous_shift_snapshots AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = previous_shift_snapshots.charge_profile_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))));

CREATE POLICY "Charge nurses can read their own previous snapshots" ON public.previous_shift_snapshots AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = previous_shift_snapshots.charge_profile_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))));

CREATE POLICY "Profiles can be created by their owner" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = auth_user_id));

CREATE POLICY "Profiles can be updated by their owner" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = auth_user_id))
  WITH CHECK ((auth.uid() = auth_user_id));

CREATE POLICY "Charge nurses can manage access for their own shifts" ON public.shift_nurse_access AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (active_shifts
     JOIN profiles ON ((profiles.id = active_shifts.charge_profile_id)))
  WHERE ((active_shifts.id = shift_nurse_access.shift_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (active_shifts
     JOIN profiles ON ((profiles.id = active_shifts.charge_profile_id)))
  WHERE ((active_shifts.id = shift_nurse_access.shift_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))));

CREATE POLICY "Charge nurses can create invites for their own active shifts" ON public.shift_nurse_invites AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (active_shifts
     JOIN profiles ON ((profiles.id = active_shifts.charge_profile_id)))
  WHERE ((active_shifts.id = shift_nurse_invites.shift_id) AND (active_shifts.ended_at IS NULL) AND (profiles.id = shift_nurse_invites.created_by_profile_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text) AND (EXISTS ( SELECT 1
           FROM jsonb_array_elements(COALESCE((active_shifts.shift_snapshot -> 'nurses'::text), '[]'::jsonb)) nurse(value)
          WHERE ((nurse.value ->> 'id'::text) = shift_nurse_invites.nurse_id)))))));

CREATE POLICY "Charge nurses can delete invites for their own shifts" ON public.shift_nurse_invites AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (active_shifts
     JOIN profiles ON ((profiles.id = active_shifts.charge_profile_id)))
  WHERE ((active_shifts.id = shift_nurse_invites.shift_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))));

CREATE POLICY "Charge nurses can read invites for their own shifts" ON public.shift_nurse_invites AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (active_shifts
     JOIN profiles ON ((profiles.id = active_shifts.charge_profile_id)))
  WHERE ((active_shifts.id = shift_nurse_invites.shift_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))));

CREATE POLICY "Charge nurses can update invites for their own shifts" ON public.shift_nurse_invites AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (active_shifts
     JOIN profiles ON ((profiles.id = active_shifts.charge_profile_id)))
  WHERE ((active_shifts.id = shift_nurse_invites.shift_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (active_shifts
     JOIN profiles ON ((profiles.id = active_shifts.charge_profile_id)))
  WHERE ((active_shifts.id = shift_nurse_invites.shift_id) AND (profiles.auth_user_id = auth.uid()) AND (profiles.role = 'charge_nurse'::text)))));

-- 3. Client table and sequence grants (the pre-ticket-23 ACLs).
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.active_shifts TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.active_shifts TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.device_push_tokens TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.device_push_tokens TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.floor_templates TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.floor_templates TO authenticated;
GRANT SELECT ON TABLE public.manual_assignment_overrides TO authenticated;
GRANT SELECT ON TABLE public.nurse_request_messages TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.previous_shift_snapshots TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.previous_shift_snapshots TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.profiles TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.profiles TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.shift_nurse_access TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.shift_nurse_access TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.shift_nurse_invites TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.shift_nurse_invites TO authenticated;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.manual_assignment_overrides_server_sequence_seq TO anon;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.manual_assignment_overrides_server_sequence_seq TO authenticated;

-- 4. Row-change Realtime publication membership.
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_shifts, public.nurse_request_messages;

COMMIT;
