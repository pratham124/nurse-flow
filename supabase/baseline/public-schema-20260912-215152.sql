--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: accept_shift_nurse_invite_code("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."accept_shift_nurse_invite_code"("invite_token_hash" "text") RETURNS TABLE("status" "text", "reason" "text", "access_id" "uuid", "shift_id" "uuid", "nurse_id" "text", "nurse_name" "text", "floor_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


--
-- Name: append_nurse_request_message("uuid", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."append_nurse_request_message"("p_shift_id" "uuid", "p_request_id" "text", "p_body" "text", "p_client_mutation_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


--
-- Name: broadcast_nurseflow_access_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."broadcast_nurseflow_access_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform realtime.send(
    jsonb_build_object(
      'accessId', new.id,
      'shiftId', new.shift_id
    ),
    'nurse-access-changed',
    'nurseflow:nurse-access:' || new.shift_id::text || ':' || new.id::text,
    true
  );

  return null;
end;
$$;


--
-- Name: broadcast_nurseflow_active_shift_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."broadcast_nurseflow_active_shift_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  access_row record;
begin
  perform realtime.send(
    jsonb_build_object('shiftId', new.id),
    'active-shift-changed',
    'nurseflow:active-shift:' || new.id::text,
    true
  );

  for access_row in
    select access.id
    from public.shift_nurse_access access
    where access.shift_id = new.id
  loop
    perform realtime.send(
      jsonb_build_object(
        'accessId', access_row.id,
        'shiftId', new.id
      ),
      'active-shift-changed',
      'nurseflow:nurse-access:' || new.id::text || ':' ||
        access_row.id::text,
      true
    );
  end loop;

  return null;
end;
$$;


--
-- Name: broadcast_nurseflow_request_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."broadcast_nurseflow_request_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform realtime.send(
    jsonb_build_object(
      'messageId', new.id,
      'requestId', new.request_id,
      'shiftId', new.shift_id
    ),
    'request-message-inserted',
    'nurseflow:request-thread:' || new.shift_id::text || ':' ||
      new.request_id,
    true
  );

  return null;
end;
$$;


--
-- Name: can_receive_nurseflow_broadcast("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."can_receive_nurseflow_broadcast"("p_topic" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_profile_id uuid;
  target_access_id uuid;
  target_request_id text;
  target_shift_id uuid;
  topic_parts text[] := string_to_array(coalesce(p_topic, ''), ':');
begin
  if cardinality(topic_parts) < 3 or topic_parts[1] <> 'nurseflow' then
    return false;
  end if;

  select profile.id
  into current_profile_id
  from public.profiles profile
  where profile.auth_user_id = auth.uid()
  limit 1;

  if current_profile_id is null then
    return false;
  end if;

  begin
    target_shift_id := topic_parts[3]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if topic_parts[2] = 'active-shift'
    and cardinality(topic_parts) = 3 then
    return exists (
      select 1
      from public.active_shifts active_shift
      join public.profiles profile
        on profile.id = active_shift.charge_profile_id
      where active_shift.id = target_shift_id
        and profile.id = current_profile_id
        and profile.role = 'charge_nurse'
    );
  end if;

  if topic_parts[2] = 'nurse-access'
    and cardinality(topic_parts) = 4 then
    begin
      target_access_id := topic_parts[4]::uuid;
    exception when invalid_text_representation then
      return false;
    end;

    return exists (
      select 1
      from public.shift_nurse_access access
      where access.id = target_access_id
        and access.shift_id = target_shift_id
        and access.nurse_profile_id = current_profile_id
    );
  end if;

  if topic_parts[2] = 'request-thread'
    and cardinality(topic_parts) = 4 then
    target_request_id := topic_parts[4];

    return public.get_nurse_request_thread_actor(
      target_shift_id,
      target_request_id
    ) = current_profile_id;
  end if;

  return false;
end;
$$;


--
-- Name: complete_swap_request_from_override(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."complete_swap_request_from_override"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


--
-- Name: confirm_manual_assignment_override("uuid", "text", "text", "text", "text", "jsonb", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."confirm_manual_assignment_override"("p_shift_id" "uuid", "p_baseline_assignment_result_id" "text", "p_bed_id" "text", "p_from_nurse_id" "text", "p_to_nurse_id" "text", "p_warning_acknowledgements" "jsonb", "p_related_swap_request_id" "text", "p_client_mutation_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


--
-- Name: disable_current_device_push_token("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."disable_current_device_push_token"("p_profile_id" "uuid", "p_device_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


--
-- Name: enqueue_active_shift_change_notifications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enqueue_active_shift_change_notifications"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_access public.shift_nurse_access%rowtype;
  v_new_assignment jsonb;
  v_old_assignment jsonb;
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


--
-- Name: enqueue_notification_event("uuid", "uuid", "uuid", "text", "text", "text", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enqueue_notification_event"("p_shift_id" "uuid", "p_recipient_profile_id" "uuid", "p_recipient_access_id" "uuid", "p_event_type" "text", "p_target_route" "text", "p_title" "text", "p_body" "text", "p_related_request_id" "text" DEFAULT NULL::"text", "p_related_bed_id" "text" DEFAULT NULL::"text") RETURNS TABLE("event_id" "uuid", "event_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


--
-- Name: enqueue_nurse_request_message_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enqueue_nurse_request_message_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


--
-- Name: enqueue_request_activity_notification("uuid", "text", "uuid", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enqueue_request_activity_notification"("p_shift_id" "uuid", "p_request_id" "text", "p_actor_profile_id" "uuid", "p_event_type" "text", "p_title" "text", "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


--
-- Name: enqueue_request_lifecycle_notifications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enqueue_request_lifecycle_notifications"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


--
-- Name: fail_optimizer_run("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fail_optimizer_run"("p_run_id" "uuid", "p_error_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


--
-- Name: finalize_optimizer_run("uuid", "text", "text", "jsonb", "jsonb", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."finalize_optimizer_run"("p_run_id" "uuid", "p_input_fingerprint" "text", "p_optimizer_version" "text", "p_assignment_result" "jsonb", "p_flags" "jsonb", "p_objectives" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


--
-- Name: get_joined_nurse_assignment_view(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_joined_nurse_assignment_view"() RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


--
-- Name: get_nurse_request_thread_actor("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_nurse_request_thread_actor"("p_shift_id" "uuid", "p_request_id" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_profile_id uuid;
  request_nurse_id text;
  shift_owner_profile_id uuid;
begin
  select profile.id
  into current_profile_id
  from public.profiles profile
  where profile.auth_user_id = auth.uid()
  limit 1;

  if current_profile_id is null then
    return null;
  end if;

  select
    active_shift.charge_profile_id,
    request_item.value ->> 'requestingNurseId'
  into shift_owner_profile_id, request_nurse_id
  from public.active_shifts active_shift
  cross join lateral jsonb_array_elements(
    coalesce(active_shift.shift_snapshot -> 'nurseRequests', '[]'::jsonb)
  ) request_item(value)
  where active_shift.id = p_shift_id
    and active_shift.ended_at is null
    and request_item.value ->> 'id' = btrim(p_request_id)
  limit 1;

  if not found or coalesce(request_nurse_id, '') = '' then
    return null;
  end if;

  if shift_owner_profile_id = current_profile_id then
    return current_profile_id;
  end if;

  if exists (
    select 1
    from public.shift_nurse_access access
    where access.shift_id = p_shift_id
      and access.nurse_id = request_nurse_id
      and access.nurse_profile_id = current_profile_id
      and access.status = 'linked'
  ) then
    return current_profile_id;
  end if;

  return null;
end;
$$;


--
-- Name: list_nurse_request_messages("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."list_nurse_request_messages"("p_shift_id" "uuid", "p_request_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


--
-- Name: optimizer_output_validation_error("jsonb", "jsonb", "jsonb", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."optimizer_output_validation_error"("p_shift_snapshot" "jsonb", "p_assignment_result" "jsonb", "p_flags" "jsonb", "p_objectives" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
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
$_$;


--
-- Name: prepare_optimizer_run("uuid", "text", timestamp with time zone, "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prepare_optimizer_run"("p_shift_id" "uuid", "p_client_mutation_id" "text", "p_expected_shift_revision" timestamp with time zone, "p_expected_baseline_assignment_result_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


--
-- Name: register_device_push_token("uuid", "uuid", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."register_device_push_token"("p_profile_id" "uuid", "p_device_id" "uuid", "p_platform" "text", "p_push_token" "text", "p_permission_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


--
-- Name: rerun_active_shift_assignment("uuid", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."rerun_active_shift_assignment"("p_shift_id" "uuid", "p_expected_baseline_assignment_result_id" "text", "p_next_shift_snapshot" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


--
-- Name: reset_active_shift_for_editing("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."reset_active_shift_for_editing"("p_shift_id" "uuid", "p_expected_baseline_assignment_result_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


--
-- Name: resolve_shift_nurse_swap_request("text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."resolve_shift_nurse_swap_request"("request_id" "text", "next_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


--
-- Name: submit_joined_nurse_issue_request("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."submit_joined_nurse_issue_request"("request_message" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


--
-- Name: submit_joined_nurse_swap_request("text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."submit_joined_nurse_swap_request"("source_bed_id" "text", "request_message" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


--
-- Name: update_shift_nurse_issue_status("text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."update_shift_nurse_issue_status"("p_request_id" "text", "p_next_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


--
-- Name: validate_shift_nurse_invite_code("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."validate_shift_nurse_invite_code"("invite_token_hash" "text") RETURNS TABLE("status" "text", "reason" "text", "invite_id" "uuid", "shift_id" "uuid", "nurse_id" "text", "nurse_name" "text", "floor_name" "text", "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: active_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."active_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "charge_profile_id" "uuid" NOT NULL,
    "floor_template_id" "uuid",
    "status" "text" NOT NULL,
    "shift_snapshot" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    CONSTRAINT "active_shifts_status_check" CHECK (("status" = ANY (ARRAY['setup'::"text", 'assigned'::"text"])))
);


--
-- Name: device_push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."device_push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "device_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "push_token" "text" NOT NULL,
    "status" "text" NOT NULL,
    "permission_status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "device_push_tokens_permission_status_check" CHECK (("permission_status" = ANY (ARRAY['unknown'::"text", 'granted'::"text", 'denied'::"text", 'provisional'::"text", 'unavailable'::"text"]))),
    CONSTRAINT "device_push_tokens_platform_check" CHECK (("platform" = ANY (ARRAY['ios'::"text", 'android'::"text"]))),
    CONSTRAINT "device_push_tokens_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'disabled'::"text", 'expired'::"text", 'revoked'::"text"])))
);


--
-- Name: floor_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."floor_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_profile_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "template_snapshot" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: manual_assignment_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."manual_assignment_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "baseline_assignment_result_id" "text" NOT NULL,
    "bed_id" "text" NOT NULL,
    "from_nurse_id" "text" NOT NULL,
    "to_nurse_id" "text" NOT NULL,
    "created_by_profile_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" NOT NULL,
    "superseded_at" timestamp with time zone,
    "server_sequence" bigint NOT NULL,
    "related_swap_request_id" "text",
    "warning_acknowledgements" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "client_mutation_id" "text" NOT NULL,
    CONSTRAINT "manual_assignment_overrides_check" CHECK (("from_nurse_id" <> "to_nurse_id")),
    CONSTRAINT "manual_assignment_overrides_check1" CHECK (((("status" = 'active'::"text") AND ("superseded_at" IS NULL)) OR (("status" = 'superseded'::"text") AND ("superseded_at" IS NOT NULL)))),
    CONSTRAINT "manual_assignment_overrides_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'superseded'::"text"]))),
    CONSTRAINT "manual_assignment_overrides_warning_acknowledgements_check" CHECK (("jsonb_typeof"("warning_acknowledgements") = 'array'::"text"))
);


--
-- Name: manual_assignment_overrides_server_sequence_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."manual_assignment_overrides" ALTER COLUMN "server_sequence" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."manual_assignment_overrides_server_sequence_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notification_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."notification_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "recipient_profile_id" "uuid" NOT NULL,
    "recipient_access_id" "uuid",
    "event_type" "text" NOT NULL,
    "target_route" "text" NOT NULL,
    "related_request_id" "text",
    "related_bed_id" "text",
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "failure_reason" "text",
    CONSTRAINT "notification_events_body_check" CHECK ((("char_length"(TRIM(BOTH FROM "body")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body")) <= 180))),
    CONSTRAINT "notification_events_check" CHECK ((("sent_at" IS NULL) OR ("status" = 'sent'::"text"))),
    CONSTRAINT "notification_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['issue_submitted'::"text", 'swap_requested'::"text", 'request_message_added'::"text", 'request_status_changed'::"text", 'assignment_updated'::"text", 'admission_added'::"text", 'patient_discharged'::"text", 'imbalance_detected'::"text", 'bed_unassigned'::"text"]))),
    CONSTRAINT "notification_events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'skipped'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "notification_events_supported_event_type_check" CHECK (("event_type" = ANY (ARRAY['issue_submitted'::"text", 'swap_requested'::"text", 'assignment_updated'::"text", 'admission_added'::"text", 'patient_discharged'::"text", 'imbalance_detected'::"text", 'bed_unassigned'::"text"]))),
    CONSTRAINT "notification_events_target_route_check" CHECK (("target_route" = ANY (ARRAY['request_detail'::"text", 'requests_list'::"text", 'joined_nurse_assignment'::"text", 'floor_board'::"text", 'flags'::"text"]))),
    CONSTRAINT "notification_events_title_check" CHECK ((("char_length"(TRIM(BOTH FROM "title")) >= 1) AND ("char_length"(TRIM(BOTH FROM "title")) <= 80)))
);


--
-- Name: nurse_request_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."nurse_request_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "author_profile_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_mutation_id" "text",
    CONSTRAINT "nurse_request_messages_body_check" CHECK (((("char_length"("body") >= 1) AND ("char_length"("body") <= 1000)) AND ("body" = "btrim"("body")))),
    CONSTRAINT "nurse_request_messages_client_mutation_id_check" CHECK ((("client_mutation_id" IS NULL) OR ((("char_length"("client_mutation_id") >= 1) AND ("char_length"("client_mutation_id") <= 120)) AND ("client_mutation_id" = "btrim"("client_mutation_id")))))
);


--
-- Name: optimizer_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."optimizer_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "requested_by_profile_id" "uuid" NOT NULL,
    "client_mutation_id" "text" NOT NULL,
    "expected_shift_revision" timestamp with time zone NOT NULL,
    "expected_baseline_assignment_result_id" "text",
    "request_fingerprint" "text" NOT NULL,
    "input_fingerprint" "text",
    "optimizer_version" "text",
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "result_id" "text",
    "outcome_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "optimizer_runs_check" CHECK (((("status" = 'succeeded'::"text") AND ("result_id" IS NOT NULL)) OR (("status" <> 'succeeded'::"text") AND ("result_id" IS NULL)))),
    CONSTRAINT "optimizer_runs_check1" CHECK (((("status" = 'running'::"text") AND ("completed_at" IS NULL)) OR (("status" <> 'running'::"text") AND ("completed_at" IS NOT NULL)))),
    CONSTRAINT "optimizer_runs_client_mutation_id_check" CHECK (("btrim"("client_mutation_id") <> ''::"text")),
    CONSTRAINT "optimizer_runs_duration_ms_check" CHECK ((("duration_ms" IS NULL) OR ("duration_ms" >= 0))),
    CONSTRAINT "optimizer_runs_input_fingerprint_check" CHECK ((("input_fingerprint" IS NULL) OR ("btrim"("input_fingerprint") <> ''::"text"))),
    CONSTRAINT "optimizer_runs_optimizer_version_check" CHECK ((("optimizer_version" IS NULL) OR ("btrim"("optimizer_version") <> ''::"text"))),
    CONSTRAINT "optimizer_runs_outcome_summary_check" CHECK (("jsonb_typeof"("outcome_summary") = 'object'::"text")),
    CONSTRAINT "optimizer_runs_request_fingerprint_check" CHECK (("btrim"("request_fingerprint") <> ''::"text")),
    CONSTRAINT "optimizer_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'succeeded'::"text", 'failed'::"text", 'stale'::"text"])))
);


--
-- Name: previous_shift_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."previous_shift_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "charge_profile_id" "uuid" NOT NULL,
    "floor_template_id" "uuid",
    "completed_at" timestamp with time zone NOT NULL,
    "nurse_suggestions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "patient_suggestions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['charge_nurse'::"text", 'regular_nurse'::"text"])))
);


--
-- Name: shift_nurse_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."shift_nurse_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "nurse_id" "text" NOT NULL,
    "nurse_name" "text" NOT NULL,
    "nurse_profile_id" "uuid",
    "nurse_email" "text",
    "status" "text" DEFAULT 'pending_link'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "shift_nurse_access_status_check" CHECK (("status" = ANY (ARRAY['pending_link'::"text", 'linked'::"text", 'removed'::"text"])))
);


--
-- Name: shift_nurse_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."shift_nurse_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "nurse_id" "text" NOT NULL,
    "created_by_profile_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "used_by_profile_id" "uuid",
    "revoked_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "shift_nurse_invites_check" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "shift_nurse_invites_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'used'::"text", 'revoked'::"text", 'expired'::"text"]))),
    CONSTRAINT "shift_nurse_invites_token_hash_check" CHECK (("char_length"("token_hash") >= 32))
);


--
-- Name: active_shifts active_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."active_shifts"
    ADD CONSTRAINT "active_shifts_pkey" PRIMARY KEY ("id");


--
-- Name: device_push_tokens device_push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."device_push_tokens"
    ADD CONSTRAINT "device_push_tokens_pkey" PRIMARY KEY ("id");


--
-- Name: device_push_tokens device_push_tokens_profile_id_device_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."device_push_tokens"
    ADD CONSTRAINT "device_push_tokens_profile_id_device_id_key" UNIQUE ("profile_id", "device_id");


--
-- Name: floor_templates floor_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."floor_templates"
    ADD CONSTRAINT "floor_templates_pkey" PRIMARY KEY ("id");


--
-- Name: manual_assignment_overrides manual_assignment_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."manual_assignment_overrides"
    ADD CONSTRAINT "manual_assignment_overrides_pkey" PRIMARY KEY ("id");


--
-- Name: notification_events notification_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id");


--
-- Name: nurse_request_messages nurse_request_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."nurse_request_messages"
    ADD CONSTRAINT "nurse_request_messages_pkey" PRIMARY KEY ("id");


--
-- Name: optimizer_runs optimizer_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."optimizer_runs"
    ADD CONSTRAINT "optimizer_runs_pkey" PRIMARY KEY ("id");


--
-- Name: previous_shift_snapshots previous_shift_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."previous_shift_snapshots"
    ADD CONSTRAINT "previous_shift_snapshots_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_auth_user_id_key" UNIQUE ("auth_user_id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--
-- Name: shift_nurse_access shift_nurse_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."shift_nurse_access"
    ADD CONSTRAINT "shift_nurse_access_pkey" PRIMARY KEY ("id");


--
-- Name: shift_nurse_invites shift_nurse_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."shift_nurse_invites"
    ADD CONSTRAINT "shift_nurse_invites_pkey" PRIMARY KEY ("id");


--
-- Name: manual_assignment_overrides_bed_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "manual_assignment_overrides_bed_history" ON "public"."manual_assignment_overrides" USING "btree" ("shift_id", "bed_id", "server_sequence");


--
-- Name: manual_assignment_overrides_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "manual_assignment_overrides_idempotency" ON "public"."manual_assignment_overrides" USING "btree" ("shift_id", "created_by_profile_id", "client_mutation_id");


--
-- Name: manual_assignment_overrides_one_active_bed; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "manual_assignment_overrides_one_active_bed" ON "public"."manual_assignment_overrides" USING "btree" ("shift_id", "bed_id") WHERE ("status" = 'active'::"text");


--
-- Name: manual_assignment_overrides_related_swap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "manual_assignment_overrides_related_swap" ON "public"."manual_assignment_overrides" USING "btree" ("related_swap_request_id") WHERE ("related_swap_request_id" IS NOT NULL);


--
-- Name: notification_events_pending_delivery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notification_events_pending_delivery" ON "public"."notification_events" USING "btree" ("created_at") WHERE ("status" = 'pending'::"text");


--
-- Name: notification_events_recipient_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notification_events_recipient_history" ON "public"."notification_events" USING "btree" ("recipient_profile_id", "created_at" DESC);


--
-- Name: nurse_request_messages_author_mutation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "nurse_request_messages_author_mutation_idx" ON "public"."nurse_request_messages" USING "btree" ("shift_id", "author_profile_id", "client_mutation_id") WHERE ("client_mutation_id" IS NOT NULL);


--
-- Name: nurse_request_messages_thread_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "nurse_request_messages_thread_order_idx" ON "public"."nurse_request_messages" USING "btree" ("shift_id", "request_id", "created_at", "id");


--
-- Name: optimizer_runs_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "optimizer_runs_idempotency" ON "public"."optimizer_runs" USING "btree" ("shift_id", "requested_by_profile_id", "client_mutation_id");


--
-- Name: optimizer_runs_one_running_initial; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "optimizer_runs_one_running_initial" ON "public"."optimizer_runs" USING "btree" ("shift_id", "expected_shift_revision") WHERE (("status" = 'running'::"text") AND ("expected_baseline_assignment_result_id" IS NULL));


--
-- Name: optimizer_runs_one_running_rerun; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "optimizer_runs_one_running_rerun" ON "public"."optimizer_runs" USING "btree" ("shift_id", "expected_shift_revision", "expected_baseline_assignment_result_id") WHERE (("status" = 'running'::"text") AND ("expected_baseline_assignment_result_id" IS NOT NULL));


--
-- Name: optimizer_runs_shift_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "optimizer_runs_shift_history" ON "public"."optimizer_runs" USING "btree" ("shift_id", "created_at" DESC);


--
-- Name: optimizer_runs_status_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "optimizer_runs_status_started" ON "public"."optimizer_runs" USING "btree" ("status", "started_at" DESC);


--
-- Name: shift_nurse_invites_one_active_per_nurse; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "shift_nurse_invites_one_active_per_nurse" ON "public"."shift_nurse_invites" USING "btree" ("shift_id", "nurse_id") WHERE ("status" = 'active'::"text");


--
-- Name: shift_nurse_access broadcast_nurseflow_access_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "broadcast_nurseflow_access_change" AFTER UPDATE ON "public"."shift_nurse_access" FOR EACH ROW EXECUTE FUNCTION "public"."broadcast_nurseflow_access_change"();


--
-- Name: active_shifts broadcast_nurseflow_active_shift_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "broadcast_nurseflow_active_shift_change" AFTER UPDATE ON "public"."active_shifts" FOR EACH ROW EXECUTE FUNCTION "public"."broadcast_nurseflow_active_shift_change"();


--
-- Name: nurse_request_messages broadcast_nurseflow_request_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "broadcast_nurseflow_request_message" AFTER INSERT ON "public"."nurse_request_messages" FOR EACH ROW EXECUTE FUNCTION "public"."broadcast_nurseflow_request_message"();


--
-- Name: manual_assignment_overrides complete_swap_request_from_override; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "complete_swap_request_from_override" AFTER INSERT ON "public"."manual_assignment_overrides" FOR EACH ROW WHEN (("new"."related_swap_request_id" IS NOT NULL)) EXECUTE FUNCTION "public"."complete_swap_request_from_override"();


--
-- Name: active_shifts enqueue_active_shift_change_notifications; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "enqueue_active_shift_change_notifications" AFTER UPDATE OF "shift_snapshot" ON "public"."active_shifts" FOR EACH ROW WHEN (("old"."shift_snapshot" IS DISTINCT FROM "new"."shift_snapshot")) EXECUTE FUNCTION "public"."enqueue_active_shift_change_notifications"();


--
-- Name: nurse_request_messages enqueue_nurse_request_message_notification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "enqueue_nurse_request_message_notification" AFTER INSERT ON "public"."nurse_request_messages" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_nurse_request_message_notification"();


--
-- Name: active_shifts enqueue_request_lifecycle_notifications; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "enqueue_request_lifecycle_notifications" AFTER UPDATE OF "shift_snapshot" ON "public"."active_shifts" FOR EACH ROW WHEN (("old"."shift_snapshot" IS DISTINCT FROM "new"."shift_snapshot")) EXECUTE FUNCTION "public"."enqueue_request_lifecycle_notifications"();


--
-- Name: active_shifts active_shifts_charge_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."active_shifts"
    ADD CONSTRAINT "active_shifts_charge_profile_id_fkey" FOREIGN KEY ("charge_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: active_shifts active_shifts_floor_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."active_shifts"
    ADD CONSTRAINT "active_shifts_floor_template_id_fkey" FOREIGN KEY ("floor_template_id") REFERENCES "public"."floor_templates"("id") ON DELETE SET NULL;


--
-- Name: device_push_tokens device_push_tokens_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."device_push_tokens"
    ADD CONSTRAINT "device_push_tokens_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: floor_templates floor_templates_owner_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."floor_templates"
    ADD CONSTRAINT "floor_templates_owner_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: manual_assignment_overrides manual_assignment_overrides_created_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."manual_assignment_overrides"
    ADD CONSTRAINT "manual_assignment_overrides_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


--
-- Name: manual_assignment_overrides manual_assignment_overrides_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."manual_assignment_overrides"
    ADD CONSTRAINT "manual_assignment_overrides_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."active_shifts"("id") ON DELETE CASCADE;


--
-- Name: notification_events notification_events_recipient_access_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_recipient_access_id_fkey" FOREIGN KEY ("recipient_access_id") REFERENCES "public"."shift_nurse_access"("id") ON DELETE SET NULL;


--
-- Name: notification_events notification_events_recipient_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_recipient_profile_id_fkey" FOREIGN KEY ("recipient_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: notification_events notification_events_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."active_shifts"("id") ON DELETE CASCADE;


--
-- Name: nurse_request_messages nurse_request_messages_author_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."nurse_request_messages"
    ADD CONSTRAINT "nurse_request_messages_author_profile_id_fkey" FOREIGN KEY ("author_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


--
-- Name: nurse_request_messages nurse_request_messages_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."nurse_request_messages"
    ADD CONSTRAINT "nurse_request_messages_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."active_shifts"("id") ON DELETE CASCADE;


--
-- Name: optimizer_runs optimizer_runs_requested_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."optimizer_runs"
    ADD CONSTRAINT "optimizer_runs_requested_by_profile_id_fkey" FOREIGN KEY ("requested_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


--
-- Name: optimizer_runs optimizer_runs_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."optimizer_runs"
    ADD CONSTRAINT "optimizer_runs_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."active_shifts"("id") ON DELETE CASCADE;


--
-- Name: previous_shift_snapshots previous_shift_snapshots_charge_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."previous_shift_snapshots"
    ADD CONSTRAINT "previous_shift_snapshots_charge_profile_id_fkey" FOREIGN KEY ("charge_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: previous_shift_snapshots previous_shift_snapshots_floor_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."previous_shift_snapshots"
    ADD CONSTRAINT "previous_shift_snapshots_floor_template_id_fkey" FOREIGN KEY ("floor_template_id") REFERENCES "public"."floor_templates"("id") ON DELETE CASCADE;


--
-- Name: profiles profiles_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: shift_nurse_access shift_nurse_access_nurse_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."shift_nurse_access"
    ADD CONSTRAINT "shift_nurse_access_nurse_profile_id_fkey" FOREIGN KEY ("nurse_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: shift_nurse_access shift_nurse_access_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."shift_nurse_access"
    ADD CONSTRAINT "shift_nurse_access_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."active_shifts"("id") ON DELETE CASCADE;


--
-- Name: shift_nurse_invites shift_nurse_invites_created_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."shift_nurse_invites"
    ADD CONSTRAINT "shift_nurse_invites_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: shift_nurse_invites shift_nurse_invites_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."shift_nurse_invites"
    ADD CONSTRAINT "shift_nurse_invites_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."active_shifts"("id") ON DELETE CASCADE;


--
-- Name: shift_nurse_invites shift_nurse_invites_used_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."shift_nurse_invites"
    ADD CONSTRAINT "shift_nurse_invites_used_by_profile_id_fkey" FOREIGN KEY ("used_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: shift_nurse_invites Charge nurses can create invites for their own active shifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can create invites for their own active shifts" ON "public"."shift_nurse_invites" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."active_shifts"
     JOIN "public"."profiles" ON (("profiles"."id" = "active_shifts"."charge_profile_id")))
  WHERE (("active_shifts"."id" = "shift_nurse_invites"."shift_id") AND ("active_shifts"."ended_at" IS NULL) AND ("profiles"."id" = "shift_nurse_invites"."created_by_profile_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text") AND (EXISTS ( SELECT 1
           FROM "jsonb_array_elements"(COALESCE(("active_shifts"."shift_snapshot" -> 'nurses'::"text"), '[]'::"jsonb")) "nurse"("value")
          WHERE (("nurse"."value" ->> 'id'::"text") = "shift_nurse_invites"."nurse_id")))))));


--
-- Name: active_shifts Charge nurses can create their own active shifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can create their own active shifts" ON "public"."active_shifts" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "active_shifts"."charge_profile_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: previous_shift_snapshots Charge nurses can create their own previous snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can create their own previous snapshots" ON "public"."previous_shift_snapshots" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "previous_shift_snapshots"."charge_profile_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: floor_templates Charge nurses can create their own templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can create their own templates" ON "public"."floor_templates" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "floor_templates"."owner_profile_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: shift_nurse_invites Charge nurses can delete invites for their own shifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can delete invites for their own shifts" ON "public"."shift_nurse_invites" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."active_shifts"
     JOIN "public"."profiles" ON (("profiles"."id" = "active_shifts"."charge_profile_id")))
  WHERE (("active_shifts"."id" = "shift_nurse_invites"."shift_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: previous_shift_snapshots Charge nurses can delete their own previous snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can delete their own previous snapshots" ON "public"."previous_shift_snapshots" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "previous_shift_snapshots"."charge_profile_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: floor_templates Charge nurses can delete their own templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can delete their own templates" ON "public"."floor_templates" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "floor_templates"."owner_profile_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: shift_nurse_access Charge nurses can manage access for their own shifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can manage access for their own shifts" ON "public"."shift_nurse_access" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."active_shifts"
     JOIN "public"."profiles" ON (("profiles"."id" = "active_shifts"."charge_profile_id")))
  WHERE (("active_shifts"."id" = "shift_nurse_access"."shift_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."active_shifts"
     JOIN "public"."profiles" ON (("profiles"."id" = "active_shifts"."charge_profile_id")))
  WHERE (("active_shifts"."id" = "shift_nurse_access"."shift_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: shift_nurse_invites Charge nurses can read invites for their own shifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can read invites for their own shifts" ON "public"."shift_nurse_invites" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."active_shifts"
     JOIN "public"."profiles" ON (("profiles"."id" = "active_shifts"."charge_profile_id")))
  WHERE (("active_shifts"."id" = "shift_nurse_invites"."shift_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: manual_assignment_overrides Charge nurses can read override history for their shifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can read override history for their shifts" ON "public"."manual_assignment_overrides" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."active_shifts"
     JOIN "public"."profiles" ON (("profiles"."id" = "active_shifts"."charge_profile_id")))
  WHERE (("active_shifts"."id" = "manual_assignment_overrides"."shift_id") AND ("profiles"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: active_shifts Charge nurses can read their own active shifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can read their own active shifts" ON "public"."active_shifts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "active_shifts"."charge_profile_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: previous_shift_snapshots Charge nurses can read their own previous snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can read their own previous snapshots" ON "public"."previous_shift_snapshots" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "previous_shift_snapshots"."charge_profile_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: floor_templates Charge nurses can read their own templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can read their own templates" ON "public"."floor_templates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "floor_templates"."owner_profile_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: shift_nurse_invites Charge nurses can update invites for their own shifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can update invites for their own shifts" ON "public"."shift_nurse_invites" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."active_shifts"
     JOIN "public"."profiles" ON (("profiles"."id" = "active_shifts"."charge_profile_id")))
  WHERE (("active_shifts"."id" = "shift_nurse_invites"."shift_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."active_shifts"
     JOIN "public"."profiles" ON (("profiles"."id" = "active_shifts"."charge_profile_id")))
  WHERE (("active_shifts"."id" = "shift_nurse_invites"."shift_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: active_shifts Charge nurses can update their own active shifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can update their own active shifts" ON "public"."active_shifts" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "active_shifts"."charge_profile_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "active_shifts"."charge_profile_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: floor_templates Charge nurses can update their own templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Charge nurses can update their own templates" ON "public"."floor_templates" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "floor_templates"."owner_profile_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "floor_templates"."owner_profile_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: shift_nurse_access Joined users can read their own access row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Joined users can read their own access row" ON "public"."shift_nurse_access" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "shift_nurse_access"."nurse_profile_id") AND ("profiles"."auth_user_id" = "auth"."uid"()) AND ("profiles"."role" = 'charge_nurse'::"text")))));


--
-- Name: profiles Profiles can be created by their owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles can be created by their owner" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "auth_user_id"));


--
-- Name: profiles Profiles can be read by their owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles can be read by their owner" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "auth_user_id"));


--
-- Name: profiles Profiles can be updated by their owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles can be updated by their owner" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "auth_user_id")) WITH CHECK (("auth"."uid"() = "auth_user_id"));


--
-- Name: nurse_request_messages Thread participants can read request messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Thread participants can read request messages" ON "public"."nurse_request_messages" FOR SELECT TO "authenticated" USING (("public"."get_nurse_request_thread_actor"("shift_id", "request_id") IS NOT NULL));


--
-- Name: active_shifts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."active_shifts" ENABLE ROW LEVEL SECURITY;

--
-- Name: device_push_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."device_push_tokens" ENABLE ROW LEVEL SECURITY;

--
-- Name: floor_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."floor_templates" ENABLE ROW LEVEL SECURITY;

--
-- Name: manual_assignment_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."manual_assignment_overrides" ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notification_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: nurse_request_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."nurse_request_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: optimizer_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."optimizer_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: previous_shift_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."previous_shift_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_nurse_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shift_nurse_access" ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_nurse_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shift_nurse_invites" ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "accept_shift_nurse_invite_code"("invite_token_hash" "text"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."accept_shift_nurse_invite_code"("invite_token_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_shift_nurse_invite_code"("invite_token_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_shift_nurse_invite_code"("invite_token_hash" "text") TO "service_role";


--
-- Name: FUNCTION "append_nurse_request_message"("p_shift_id" "uuid", "p_request_id" "text", "p_body" "text", "p_client_mutation_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."append_nurse_request_message"("p_shift_id" "uuid", "p_request_id" "text", "p_body" "text", "p_client_mutation_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."append_nurse_request_message"("p_shift_id" "uuid", "p_request_id" "text", "p_body" "text", "p_client_mutation_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_nurse_request_message"("p_shift_id" "uuid", "p_request_id" "text", "p_body" "text", "p_client_mutation_id" "text") TO "service_role";


--
-- Name: FUNCTION "broadcast_nurseflow_access_change"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."broadcast_nurseflow_access_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."broadcast_nurseflow_access_change"() TO "service_role";


--
-- Name: FUNCTION "broadcast_nurseflow_active_shift_change"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."broadcast_nurseflow_active_shift_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."broadcast_nurseflow_active_shift_change"() TO "service_role";


--
-- Name: FUNCTION "broadcast_nurseflow_request_message"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."broadcast_nurseflow_request_message"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."broadcast_nurseflow_request_message"() TO "service_role";


--
-- Name: FUNCTION "can_receive_nurseflow_broadcast"("p_topic" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."can_receive_nurseflow_broadcast"("p_topic" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_receive_nurseflow_broadcast"("p_topic" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_receive_nurseflow_broadcast"("p_topic" "text") TO "service_role";


--
-- Name: FUNCTION "complete_swap_request_from_override"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."complete_swap_request_from_override"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_swap_request_from_override"() TO "service_role";


--
-- Name: FUNCTION "confirm_manual_assignment_override"("p_shift_id" "uuid", "p_baseline_assignment_result_id" "text", "p_bed_id" "text", "p_from_nurse_id" "text", "p_to_nurse_id" "text", "p_warning_acknowledgements" "jsonb", "p_related_swap_request_id" "text", "p_client_mutation_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."confirm_manual_assignment_override"("p_shift_id" "uuid", "p_baseline_assignment_result_id" "text", "p_bed_id" "text", "p_from_nurse_id" "text", "p_to_nurse_id" "text", "p_warning_acknowledgements" "jsonb", "p_related_swap_request_id" "text", "p_client_mutation_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_manual_assignment_override"("p_shift_id" "uuid", "p_baseline_assignment_result_id" "text", "p_bed_id" "text", "p_from_nurse_id" "text", "p_to_nurse_id" "text", "p_warning_acknowledgements" "jsonb", "p_related_swap_request_id" "text", "p_client_mutation_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_manual_assignment_override"("p_shift_id" "uuid", "p_baseline_assignment_result_id" "text", "p_bed_id" "text", "p_from_nurse_id" "text", "p_to_nurse_id" "text", "p_warning_acknowledgements" "jsonb", "p_related_swap_request_id" "text", "p_client_mutation_id" "text") TO "service_role";


--
-- Name: FUNCTION "disable_current_device_push_token"("p_profile_id" "uuid", "p_device_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."disable_current_device_push_token"("p_profile_id" "uuid", "p_device_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."disable_current_device_push_token"("p_profile_id" "uuid", "p_device_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."disable_current_device_push_token"("p_profile_id" "uuid", "p_device_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."disable_current_device_push_token"("p_profile_id" "uuid", "p_device_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "enqueue_active_shift_change_notifications"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."enqueue_active_shift_change_notifications"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_active_shift_change_notifications"() TO "service_role";


--
-- Name: FUNCTION "enqueue_notification_event"("p_shift_id" "uuid", "p_recipient_profile_id" "uuid", "p_recipient_access_id" "uuid", "p_event_type" "text", "p_target_route" "text", "p_title" "text", "p_body" "text", "p_related_request_id" "text", "p_related_bed_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."enqueue_notification_event"("p_shift_id" "uuid", "p_recipient_profile_id" "uuid", "p_recipient_access_id" "uuid", "p_event_type" "text", "p_target_route" "text", "p_title" "text", "p_body" "text", "p_related_request_id" "text", "p_related_bed_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_notification_event"("p_shift_id" "uuid", "p_recipient_profile_id" "uuid", "p_recipient_access_id" "uuid", "p_event_type" "text", "p_target_route" "text", "p_title" "text", "p_body" "text", "p_related_request_id" "text", "p_related_bed_id" "text") TO "service_role";


--
-- Name: FUNCTION "enqueue_nurse_request_message_notification"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."enqueue_nurse_request_message_notification"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_nurse_request_message_notification"() TO "service_role";


--
-- Name: FUNCTION "enqueue_request_activity_notification"("p_shift_id" "uuid", "p_request_id" "text", "p_actor_profile_id" "uuid", "p_event_type" "text", "p_title" "text", "p_body" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."enqueue_request_activity_notification"("p_shift_id" "uuid", "p_request_id" "text", "p_actor_profile_id" "uuid", "p_event_type" "text", "p_title" "text", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_request_activity_notification"("p_shift_id" "uuid", "p_request_id" "text", "p_actor_profile_id" "uuid", "p_event_type" "text", "p_title" "text", "p_body" "text") TO "service_role";


--
-- Name: FUNCTION "enqueue_request_lifecycle_notifications"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."enqueue_request_lifecycle_notifications"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_request_lifecycle_notifications"() TO "service_role";


--
-- Name: FUNCTION "fail_optimizer_run"("p_run_id" "uuid", "p_error_code" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fail_optimizer_run"("p_run_id" "uuid", "p_error_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fail_optimizer_run"("p_run_id" "uuid", "p_error_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fail_optimizer_run"("p_run_id" "uuid", "p_error_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fail_optimizer_run"("p_run_id" "uuid", "p_error_code" "text") TO "service_role";


--
-- Name: FUNCTION "finalize_optimizer_run"("p_run_id" "uuid", "p_input_fingerprint" "text", "p_optimizer_version" "text", "p_assignment_result" "jsonb", "p_flags" "jsonb", "p_objectives" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."finalize_optimizer_run"("p_run_id" "uuid", "p_input_fingerprint" "text", "p_optimizer_version" "text", "p_assignment_result" "jsonb", "p_flags" "jsonb", "p_objectives" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_optimizer_run"("p_run_id" "uuid", "p_input_fingerprint" "text", "p_optimizer_version" "text", "p_assignment_result" "jsonb", "p_flags" "jsonb", "p_objectives" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."finalize_optimizer_run"("p_run_id" "uuid", "p_input_fingerprint" "text", "p_optimizer_version" "text", "p_assignment_result" "jsonb", "p_flags" "jsonb", "p_objectives" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_optimizer_run"("p_run_id" "uuid", "p_input_fingerprint" "text", "p_optimizer_version" "text", "p_assignment_result" "jsonb", "p_flags" "jsonb", "p_objectives" "jsonb") TO "service_role";


--
-- Name: FUNCTION "get_joined_nurse_assignment_view"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."get_joined_nurse_assignment_view"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_joined_nurse_assignment_view"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_joined_nurse_assignment_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_joined_nurse_assignment_view"() TO "service_role";


--
-- Name: FUNCTION "get_nurse_request_thread_actor"("p_shift_id" "uuid", "p_request_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."get_nurse_request_thread_actor"("p_shift_id" "uuid", "p_request_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_nurse_request_thread_actor"("p_shift_id" "uuid", "p_request_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_nurse_request_thread_actor"("p_shift_id" "uuid", "p_request_id" "text") TO "service_role";


--
-- Name: FUNCTION "list_nurse_request_messages"("p_shift_id" "uuid", "p_request_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."list_nurse_request_messages"("p_shift_id" "uuid", "p_request_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_nurse_request_messages"("p_shift_id" "uuid", "p_request_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_nurse_request_messages"("p_shift_id" "uuid", "p_request_id" "text") TO "service_role";


--
-- Name: FUNCTION "optimizer_output_validation_error"("p_shift_snapshot" "jsonb", "p_assignment_result" "jsonb", "p_flags" "jsonb", "p_objectives" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."optimizer_output_validation_error"("p_shift_snapshot" "jsonb", "p_assignment_result" "jsonb", "p_flags" "jsonb", "p_objectives" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."optimizer_output_validation_error"("p_shift_snapshot" "jsonb", "p_assignment_result" "jsonb", "p_flags" "jsonb", "p_objectives" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."optimizer_output_validation_error"("p_shift_snapshot" "jsonb", "p_assignment_result" "jsonb", "p_flags" "jsonb", "p_objectives" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."optimizer_output_validation_error"("p_shift_snapshot" "jsonb", "p_assignment_result" "jsonb", "p_flags" "jsonb", "p_objectives" "jsonb") TO "service_role";


--
-- Name: FUNCTION "prepare_optimizer_run"("p_shift_id" "uuid", "p_client_mutation_id" "text", "p_expected_shift_revision" timestamp with time zone, "p_expected_baseline_assignment_result_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."prepare_optimizer_run"("p_shift_id" "uuid", "p_client_mutation_id" "text", "p_expected_shift_revision" timestamp with time zone, "p_expected_baseline_assignment_result_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prepare_optimizer_run"("p_shift_id" "uuid", "p_client_mutation_id" "text", "p_expected_shift_revision" timestamp with time zone, "p_expected_baseline_assignment_result_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."prepare_optimizer_run"("p_shift_id" "uuid", "p_client_mutation_id" "text", "p_expected_shift_revision" timestamp with time zone, "p_expected_baseline_assignment_result_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."prepare_optimizer_run"("p_shift_id" "uuid", "p_client_mutation_id" "text", "p_expected_shift_revision" timestamp with time zone, "p_expected_baseline_assignment_result_id" "text") TO "service_role";


--
-- Name: FUNCTION "register_device_push_token"("p_profile_id" "uuid", "p_device_id" "uuid", "p_platform" "text", "p_push_token" "text", "p_permission_status" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."register_device_push_token"("p_profile_id" "uuid", "p_device_id" "uuid", "p_platform" "text", "p_push_token" "text", "p_permission_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_device_push_token"("p_profile_id" "uuid", "p_device_id" "uuid", "p_platform" "text", "p_push_token" "text", "p_permission_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."register_device_push_token"("p_profile_id" "uuid", "p_device_id" "uuid", "p_platform" "text", "p_push_token" "text", "p_permission_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_device_push_token"("p_profile_id" "uuid", "p_device_id" "uuid", "p_platform" "text", "p_push_token" "text", "p_permission_status" "text") TO "service_role";


--
-- Name: FUNCTION "rerun_active_shift_assignment"("p_shift_id" "uuid", "p_expected_baseline_assignment_result_id" "text", "p_next_shift_snapshot" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."rerun_active_shift_assignment"("p_shift_id" "uuid", "p_expected_baseline_assignment_result_id" "text", "p_next_shift_snapshot" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rerun_active_shift_assignment"("p_shift_id" "uuid", "p_expected_baseline_assignment_result_id" "text", "p_next_shift_snapshot" "jsonb") TO "service_role";


--
-- Name: FUNCTION "reset_active_shift_for_editing"("p_shift_id" "uuid", "p_expected_baseline_assignment_result_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."reset_active_shift_for_editing"("p_shift_id" "uuid", "p_expected_baseline_assignment_result_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_active_shift_for_editing"("p_shift_id" "uuid", "p_expected_baseline_assignment_result_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_active_shift_for_editing"("p_shift_id" "uuid", "p_expected_baseline_assignment_result_id" "text") TO "service_role";


--
-- Name: FUNCTION "resolve_shift_nurse_swap_request"("request_id" "text", "next_status" "text"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."resolve_shift_nurse_swap_request"("request_id" "text", "next_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_shift_nurse_swap_request"("request_id" "text", "next_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_shift_nurse_swap_request"("request_id" "text", "next_status" "text") TO "service_role";


--
-- Name: FUNCTION "submit_joined_nurse_issue_request"("request_message" "text"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."submit_joined_nurse_issue_request"("request_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_joined_nurse_issue_request"("request_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_joined_nurse_issue_request"("request_message" "text") TO "service_role";


--
-- Name: FUNCTION "submit_joined_nurse_swap_request"("source_bed_id" "text", "request_message" "text"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."submit_joined_nurse_swap_request"("source_bed_id" "text", "request_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_joined_nurse_swap_request"("source_bed_id" "text", "request_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_joined_nurse_swap_request"("source_bed_id" "text", "request_message" "text") TO "service_role";


--
-- Name: FUNCTION "update_shift_nurse_issue_status"("p_request_id" "text", "p_next_status" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."update_shift_nurse_issue_status"("p_request_id" "text", "p_next_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_shift_nurse_issue_status"("p_request_id" "text", "p_next_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_shift_nurse_issue_status"("p_request_id" "text", "p_next_status" "text") TO "service_role";


--
-- Name: FUNCTION "validate_shift_nurse_invite_code"("invite_token_hash" "text"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."validate_shift_nurse_invite_code"("invite_token_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_shift_nurse_invite_code"("invite_token_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_shift_nurse_invite_code"("invite_token_hash" "text") TO "service_role";


--
-- Name: TABLE "active_shifts"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."active_shifts" TO "anon";
GRANT ALL ON TABLE "public"."active_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."active_shifts" TO "service_role";


--
-- Name: TABLE "device_push_tokens"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."device_push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."device_push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."device_push_tokens" TO "service_role";


--
-- Name: TABLE "floor_templates"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."floor_templates" TO "anon";
GRANT ALL ON TABLE "public"."floor_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."floor_templates" TO "service_role";


--
-- Name: TABLE "manual_assignment_overrides"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."manual_assignment_overrides" TO "service_role";
GRANT SELECT ON TABLE "public"."manual_assignment_overrides" TO "authenticated";


--
-- Name: SEQUENCE "manual_assignment_overrides_server_sequence_seq"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE "public"."manual_assignment_overrides_server_sequence_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."manual_assignment_overrides_server_sequence_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."manual_assignment_overrides_server_sequence_seq" TO "service_role";


--
-- Name: TABLE "notification_events"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."notification_events" TO "service_role";


--
-- Name: TABLE "nurse_request_messages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."nurse_request_messages" TO "service_role";
GRANT SELECT ON TABLE "public"."nurse_request_messages" TO "authenticated";


--
-- Name: TABLE "optimizer_runs"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."optimizer_runs" TO "service_role";


--
-- Name: TABLE "previous_shift_snapshots"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."previous_shift_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."previous_shift_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."previous_shift_snapshots" TO "service_role";


--
-- Name: TABLE "profiles"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";


--
-- Name: TABLE "shift_nurse_access"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."shift_nurse_access" TO "anon";
GRANT ALL ON TABLE "public"."shift_nurse_access" TO "authenticated";
GRANT ALL ON TABLE "public"."shift_nurse_access" TO "service_role";


--
-- Name: TABLE "shift_nurse_invites"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."shift_nurse_invites" TO "anon";
GRANT ALL ON TABLE "public"."shift_nurse_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."shift_nurse_invites" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- PostgreSQL database dump complete
--

