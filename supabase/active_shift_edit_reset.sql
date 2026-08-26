-- Reset an assigned active shift before the charge nurse edits setup data.
-- Run this in the Supabase SQL editor after the active shift, invite,
-- nurse-access, and manual-assignment-override tables have been created.

create or replace function public.reset_active_shift_for_editing(
  p_shift_id uuid,
  p_expected_baseline_assignment_result_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

revoke all on function public.reset_active_shift_for_editing(uuid, text)
from public, anon;

grant execute on function public.reset_active_shift_for_editing(uuid, text)
to authenticated;
