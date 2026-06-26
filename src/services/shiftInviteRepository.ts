import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ActiveShiftRecord,
  ShiftNurseInviteRecord,
  ShiftNurseInviteStatus,
  UserProfile,
} from "../types/models";

type ShiftNurseInviteRow = {
  created_at: string;
  created_by_profile_id: string;
  expires_at: string;
  id: string;
  nurse_id: string;
  revoked_at: string | null;
  shift_id: string;
  status: string;
  token_hash: string;
  used_at: string | null;
  used_by_profile_id: string | null;
};

type CreateShiftNurseInviteRecordInput = {
  activeShift: ActiveShiftRecord;
  expiresAt: string;
  nurseId: string;
  tokenHash: string;
};

const inviteColumns =
  "id, shift_id, nurse_id, created_by_profile_id, token_hash, status, created_at, expires_at, used_at, used_by_profile_id, revoked_at";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function assertChargeNurse(profile: Pick<UserProfile, "role">) {
  if (profile.role !== "charge_nurse") {
    throw new Error("Sign in as a charge nurse to manage nurse invites.");
  }
}

function assertOwnedActiveShift(
  activeShift: ActiveShiftRecord,
  profile: UserProfile,
) {
  if (!uuidPattern.test(activeShift.id)) {
    throw new Error("Start a server-backed shift before creating nurse invites.");
  }

  if (activeShift.chargeProfileId !== profile.id) {
    throw new Error("You can only manage invites for your own active shift.");
  }

  if (activeShift.endedAt) {
    throw new Error("Nurse invites can only be created for an active shift.");
  }
}

function assertNurseBelongsToShift(
  activeShift: ActiveShiftRecord,
  nurseId: string,
) {
  const nurseExists = activeShift.shiftSnapshot.nurses.some(
    (nurse) => nurse.id === nurseId,
  );

  if (!nurseExists) {
    throw new Error(
      "Choose a nurse from the active shift before creating an invite.",
    );
  }
}

function assertTokenHash(tokenHash: string) {
  if (tokenHash.trim().length < 32) {
    throw new Error("Invite token validation data is missing or too short.");
  }
}

function assertFutureExpiration(expiresAt: string) {
  const expiresAtMs = Date.parse(expiresAt);

  if (Number.isNaN(expiresAtMs)) {
    throw new Error("Invite expiration must be a valid date.");
  }

  if (expiresAtMs <= Date.now()) {
    throw new Error("Invite expiration must be in the future.");
  }
}

function isShiftNurseInviteStatus(
  status: string,
): status is ShiftNurseInviteStatus {
  return (
    status === "active" ||
    status === "used" ||
    status === "revoked" ||
    status === "expired"
  );
}

function mapInviteRow(row: ShiftNurseInviteRow): ShiftNurseInviteRecord {
  if (!isShiftNurseInviteStatus(row.status)) {
    throw new Error("The nurse invite has an unsupported status.");
  }

  return {
    createdAt: row.created_at,
    createdByProfileId: row.created_by_profile_id,
    expiresAt: row.expires_at,
    id: row.id,
    nurseId: row.nurse_id,
    revokedAt: row.revoked_at ?? undefined,
    shiftId: row.shift_id,
    status: row.status,
    tokenHash: row.token_hash,
    usedAt: row.used_at ?? undefined,
    usedByProfileId: row.used_by_profile_id ?? undefined,
  };
}

export async function loadShiftNurseInvitesForActiveShift(
  supabase: SupabaseClient,
  profile: UserProfile,
  activeShift: ActiveShiftRecord,
) {
  assertChargeNurse(profile);
  assertOwnedActiveShift(activeShift, profile);

  const { data, error } = await supabase
    .from("shift_nurse_invites")
    .select(inviteColumns)
    .eq("shift_id", activeShift.id)
    .order("created_at", { ascending: false })
    .overrideTypes<ShiftNurseInviteRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapInviteRow);
}

export async function createShiftNurseInviteRecord(
  supabase: SupabaseClient,
  profile: UserProfile,
  {
    activeShift,
    expiresAt,
    nurseId,
    tokenHash,
  }: CreateShiftNurseInviteRecordInput,
) {
  assertChargeNurse(profile);
  assertOwnedActiveShift(activeShift, profile);
  assertNurseBelongsToShift(activeShift, nurseId);
  assertTokenHash(tokenHash);
  assertFutureExpiration(expiresAt);

  const activeInvites = await loadShiftNurseInvitesForActiveShift(
    supabase,
    profile,
    activeShift,
  );
  const existingActiveInvite = activeInvites.find(
    (invite) => invite.nurseId === nurseId && invite.status === "active",
  );

  if (existingActiveInvite) {
    throw new Error("This nurse already has an active invite for this shift.");
  }

  const { data, error } = await supabase
    .from("shift_nurse_invites")
    .insert({
      created_by_profile_id: profile.id,
      expires_at: expiresAt,
      nurse_id: nurseId,
      shift_id: activeShift.id,
      status: "active",
      token_hash: tokenHash.trim(),
    })
    .select(inviteColumns)
    .single<ShiftNurseInviteRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapInviteRow(data);
}
