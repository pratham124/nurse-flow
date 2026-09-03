import type { SupabaseClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";

import type {
  ActiveShiftRecord,
  ShiftNurseAccess,
  ShiftNurseInviteRecord,
  ShiftNurseInviteStatus,
  UserProfile,
} from "../types/models";
import { getEffectiveAssignmentResult } from "../utils/effectiveAssignment";
import { getNurseAssignedPatientCount } from "../utils/nurseInviteEligibility";

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

export type GeneratedShiftNurseInviteCode = {
  code: string;
  invite: ShiftNurseInviteRecord;
};

type GenerateShiftNurseInviteCodeInput = {
  activeShift: ActiveShiftRecord;
  getTokenHash: (code: string) => Promise<string>;
  nurseId: string;
};

export type ShiftNurseInviteValidationBlockReason =
  | "invalid_format"
  | "not_found"
  | "expired"
  | "revoked"
  | "already_used"
  | "ended_shift"
  | "stale_nurse"
  | "participation_conflict";

export type ShiftNurseInviteValidationResult =
  | {
      expiresAt: string;
      floorName: string;
      inviteId: string;
      nurseId: string;
      nurseName: string;
      shiftId: string;
      status: "valid";
    }
  | {
      message: string;
      reason: ShiftNurseInviteValidationBlockReason;
      status: "blocked";
    };

export type ShiftNurseInviteAcceptResult =
  | {
      accessId: string;
      floorName: string;
      nurseId: string;
      nurseName: string;
      shiftId: string;
      status: "joined";
    }
  | {
      message: string;
      reason: ShiftNurseInviteValidationBlockReason;
      status: "blocked";
    };

type ShiftNurseAccessRow = {
  created_at: string;
  id: string;
  nurse_email: string | null;
  nurse_id: string;
  nurse_name: string;
  nurse_profile_id: string | null;
  shift_id: string;
  status: string;
  updated_at: string;
};

type ValidateShiftNurseInviteRpcResult = {
  accessId?: string;
  access_id?: string;
  expiresAt?: string;
  expires_at?: string;
  floorName?: string;
  floor_name?: string;
  inviteId?: string;
  invite_id?: string;
  nurseId?: string;
  nurseName?: string;
  nurse_id?: string;
  nurse_name?: string;
  reason?: string;
  shiftId?: string;
  shift_id?: string;
  status?: string;
};

const inviteColumns =
  "id, shift_id, nurse_id, created_by_profile_id, token_hash, status, created_at, expires_at, used_at, used_by_profile_id, revoked_at";
const accessColumns =
  "id, shift_id, nurse_id, nurse_name, nurse_profile_id, nurse_email, status, created_at, updated_at";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const inviteCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const inviteCodePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const inviteCodeLength = 6;
const inviteExpirationHours = 24;

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

function assertNurseHasAssignedPatients(
  activeShift: ActiveShiftRecord,
  nurseId: string,
) {
  const baselineAssignmentResult = activeShift.shiftSnapshot.assignmentResult;
  const effectiveAssignmentResult = baselineAssignmentResult
    ? getEffectiveAssignmentResult(
        baselineAssignmentResult,
        activeShift.activeAssignmentOverridesByBedId ?? {},
      )
    : undefined;

  if (
    getNurseAssignedPatientCount(
      activeShift.shiftSnapshot,
      effectiveAssignmentResult,
      nurseId,
    ) === 0
  ) {
    throw new Error(
      "Assign at least one patient to this nurse before generating a code.",
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

function createInviteCode() {
  const bytes = Crypto.getRandomBytes(inviteCodeLength);

  return Array.from(bytes)
    .map((byte) => inviteCodeAlphabet[byte % inviteCodeAlphabet.length])
    .join("");
}

export function getNormalizedNurseInviteCode(code: string) {
  return code.trim().replace(/[\s-]/g, "").toUpperCase();
}

export function getNurseInviteCodeFormatMessage(code: string) {
  const normalizedCode = getNormalizedNurseInviteCode(code);

  if (!normalizedCode) {
    return "Enter the 6-character code from your charge nurse.";
  }

  if (normalizedCode.length < inviteCodeLength) {
    return "That code needs 6 characters.";
  }

  if (
    normalizedCode.length > inviteCodeLength ||
    !inviteCodePattern.test(normalizedCode)
  ) {
    return "Use the 6 letters or numbers shown by your charge nurse.";
  }

  return "";
}

export async function getShiftNurseInviteCodeHash(code: string) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    getNormalizedNurseInviteCode(code),
  );
}

function createDefaultExpiration() {
  const expiresAt = new Date();

  expiresAt.setHours(expiresAt.getHours() + inviteExpirationHours);

  return expiresAt.toISOString();
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

function mapAccessRow(row: ShiftNurseAccessRow): ShiftNurseAccess {
  if (
    row.status !== "pending_link" &&
    row.status !== "linked" &&
    row.status !== "removed"
  ) {
    throw new Error("The nurse access record has an unsupported status.");
  }

  return {
    createdAt: row.created_at,
    id: row.id,
    nurseEmail: row.nurse_email ?? undefined,
    nurseId: row.nurse_id,
    nurseName: row.nurse_name,
    nurseProfileId: row.nurse_profile_id ?? undefined,
    shiftId: row.shift_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function getValidationBlockMessage(
  reason: ShiftNurseInviteValidationBlockReason,
) {
  if (reason === "invalid_format") {
    return "Use the 6-character code from your charge nurse.";
  }

  if (reason === "expired") {
    return "That code has expired. Ask your charge nurse for a new one.";
  }

  if (reason === "revoked") {
    return "That code is no longer active. Ask your charge nurse for a new one.";
  }

  if (reason === "already_used") {
    return "That code has already been used. Ask your charge nurse for a new one.";
  }

  if (reason === "ended_shift") {
    return "This shift has ended. Ask your charge nurse for a current code.";
  }

  if (reason === "stale_nurse") {
    return "This nurse is no longer on this shift. Ask your charge nurse for help.";
  }

  if (reason === "participation_conflict") {
    return "You are already connected to another active shift.";
  }

  return "That code is not valid. Check it and try again.";
}

function isValidationBlockReason(
  reason: string,
): reason is ShiftNurseInviteValidationBlockReason {
  return (
    reason === "invalid_format" ||
    reason === "not_found" ||
    reason === "expired" ||
    reason === "revoked" ||
    reason === "already_used" ||
    reason === "ended_shift" ||
    reason === "stale_nurse" ||
    reason === "participation_conflict"
  );
}

function getValidationResultRow(data: unknown) {
  if (Array.isArray(data)) {
    return data[0] as ValidateShiftNurseInviteRpcResult | undefined;
  }

  return data as ValidateShiftNurseInviteRpcResult | undefined;
}

function mapValidationResult(
  data: unknown,
): ShiftNurseInviteValidationResult {
  const row = getValidationResultRow(data);

  if (!row) {
    return {
      message: getValidationBlockMessage("not_found"),
      reason: "not_found",
      status: "blocked",
    };
  }

  const rawReason = row.reason ?? row.status ?? "not_found";
  const reason = isValidationBlockReason(rawReason) ? rawReason : "not_found";

  if (row.status !== "valid") {
    return {
      message: getValidationBlockMessage(reason),
      reason,
      status: "blocked",
    };
  }

  const expiresAt = row.expiresAt ?? row.expires_at ?? "";
  const floorName = row.floorName ?? row.floor_name ?? "";
  const inviteId = row.inviteId ?? row.invite_id ?? "";
  const nurseId = row.nurseId ?? row.nurse_id ?? "";
  const nurseName = row.nurseName ?? row.nurse_name ?? "";
  const shiftId = row.shiftId ?? row.shift_id ?? "";

  if (
    !expiresAt ||
    !floorName ||
    !inviteId ||
    !nurseId ||
    !nurseName ||
    !shiftId
  ) {
    throw new Error("Invite validation returned an incomplete confirmation.");
  }

  if (Date.parse(expiresAt) <= Date.now()) {
    return {
      message: getValidationBlockMessage("expired"),
      reason: "expired",
      status: "blocked",
    };
  }

  return {
    expiresAt,
    floorName,
    inviteId,
    nurseId,
    nurseName,
    shiftId,
    status: "valid",
  };
}

function mapAcceptResult(data: unknown): ShiftNurseInviteAcceptResult {
  const row = getValidationResultRow(data);

  if (!row) {
    return {
      message: getValidationBlockMessage("not_found"),
      reason: "not_found",
      status: "blocked",
    };
  }

  const rawReason = row.reason ?? row.status ?? "not_found";
  const reason = isValidationBlockReason(rawReason) ? rawReason : "not_found";

  if (row.status !== "joined") {
    return {
      message: getValidationBlockMessage(reason),
      reason,
      status: "blocked",
    };
  }

  const accessId = row.accessId ?? row.access_id ?? "";
  const floorName = row.floorName ?? row.floor_name ?? "";
  const nurseId = row.nurseId ?? row.nurse_id ?? "";
  const nurseName = row.nurseName ?? row.nurse_name ?? "";
  const shiftId = row.shiftId ?? row.shift_id ?? "";

  if (!accessId || !floorName || !nurseId || !nurseName || !shiftId) {
    throw new Error("Invite join returned an incomplete access record.");
  }

  return {
    accessId,
    floorName,
    nurseId,
    nurseName,
    shiftId,
    status: "joined",
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

export async function loadShiftNurseAccessForActiveShift(
  supabase: SupabaseClient,
  profile: UserProfile,
  activeShift: ActiveShiftRecord,
) {
  assertChargeNurse(profile);
  assertOwnedActiveShift(activeShift, profile);

  const { data, error } = await supabase
    .from("shift_nurse_access")
    .select(accessColumns)
    .eq("shift_id", activeShift.id)
    .order("updated_at", { ascending: false })
    .overrideTypes<ShiftNurseAccessRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapAccessRow);
}

export async function expireActiveShiftNurseInvites(
  supabase: SupabaseClient,
  profile: UserProfile,
  activeShift: ActiveShiftRecord,
) {
  assertChargeNurse(profile);
  assertOwnedActiveShift(activeShift, profile);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("shift_nurse_invites")
    .update({
      status: "expired",
      updated_at: now,
    })
    .eq("shift_id", activeShift.id)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }
}

export async function validateShiftNurseInviteCode(
  supabase: SupabaseClient,
  code: string,
): Promise<ShiftNurseInviteValidationResult> {
  const formatMessage = getNurseInviteCodeFormatMessage(code);

  if (formatMessage) {
    return {
      message: formatMessage,
      reason: "invalid_format",
      status: "blocked",
    };
  }

  const tokenHash = await getShiftNurseInviteCodeHash(code);
  const { data, error } = await supabase.rpc(
    "validate_shift_nurse_invite_code",
    {
      invite_token_hash: tokenHash,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return mapValidationResult(data);
}

export async function acceptShiftNurseInviteCode(
  supabase: SupabaseClient,
  code: string,
): Promise<ShiftNurseInviteAcceptResult> {
  const formatMessage = getNurseInviteCodeFormatMessage(code);

  if (formatMessage) {
    return {
      message: formatMessage,
      reason: "invalid_format",
      status: "blocked",
    };
  }

  const tokenHash = await getShiftNurseInviteCodeHash(code);
  const { data, error } = await supabase.rpc("accept_shift_nurse_invite_code", {
    invite_token_hash: tokenHash,
  });

  if (error) {
    throw new Error(error.message);
  }

  return mapAcceptResult(data);
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
  assertNurseHasAssignedPatients(activeShift, nurseId);
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

async function revokeActiveShiftNurseInviteRecord(
  supabase: SupabaseClient,
  profile: UserProfile,
  activeShift: ActiveShiftRecord,
  nurseId: string,
) {
  assertChargeNurse(profile);
  assertOwnedActiveShift(activeShift, profile);
  assertNurseBelongsToShift(activeShift, nurseId);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("shift_nurse_invites")
    .update({
      revoked_at: now,
      status: "revoked",
    })
    .eq("shift_id", activeShift.id)
    .eq("nurse_id", nurseId)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }
}

export async function generateShiftNurseInviteCode(
  supabase: SupabaseClient,
  profile: UserProfile,
  {
    activeShift,
    getTokenHash,
    nurseId,
  }: GenerateShiftNurseInviteCodeInput,
): Promise<GeneratedShiftNurseInviteCode> {
  const code = createInviteCode();
  const tokenHash = await getTokenHash(code);
  const invite = await createShiftNurseInviteRecord(supabase, profile, {
    activeShift,
    expiresAt: createDefaultExpiration(),
    nurseId,
    tokenHash,
  });

  return {
    code,
    invite,
  };
}

export async function regenerateShiftNurseInviteCode(
  supabase: SupabaseClient,
  profile: UserProfile,
  input: GenerateShiftNurseInviteCodeInput,
): Promise<GeneratedShiftNurseInviteCode> {
  assertNurseHasAssignedPatients(input.activeShift, input.nurseId);

  await revokeActiveShiftNurseInviteRecord(
    supabase,
    profile,
    input.activeShift,
    input.nurseId,
  );

  return generateShiftNurseInviteCode(supabase, profile, input);
}
