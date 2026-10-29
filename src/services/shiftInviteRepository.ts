import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { goApiClient } from "./goApiClient";
import { getGoAuthHeaders } from "./goApiAuth";
import { readGoApiFailure, throwGoNetworkError } from "./goApiErrors";
import { savedAccountIdSchema } from "./identifierSchemas";

import type {
  ActiveShiftRecord,
  ShiftNurseAccess,
  ShiftNurseInviteRecord,
  UserProfile,
} from "../types/models";

export type GeneratedShiftNurseInviteCode = {
  code: string;
  invite: ShiftNurseInviteRecord;
};

type GenerateShiftNurseInviteCodeInput = {
  activeShift: ActiveShiftRecord;
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

const inviteRowSchema = z.object({
  created_at: z.string(),
  created_by_profile_id: z.string(),
  expires_at: z.string(),
  id: z.string(),
  nurse_id: z.string(),
  revoked_at: z.string().nullish(),
  shift_id: z.string(),
  status: z.enum(["active", "used", "revoked", "expired"]),
  used_at: z.string().nullish(),
  used_by_profile_id: z.string().nullish(),
});

const accessRowSchema = z.object({
  created_at: z.string(),
  id: z.string(),
  nurse_email: z.string().nullish(),
  nurse_id: z.string(),
  nurse_name: z.string(),
  nurse_profile_id: z.string().nullish(),
  shift_id: z.string(),
  status: z.enum(["pending_link", "linked", "removed"]),
  updated_at: z.string(),
});

const inviteListSchema = z.object({
  access: z.array(accessRowSchema),
  invites: z.array(inviteRowSchema),
});

const generatedInviteSchema = z.object({
  code: z.string().min(1),
  invite: inviteRowSchema,
});

const blockReasonSchema = z.enum([
  "invalid_format",
  "not_found",
  "expired",
  "revoked",
  "already_used",
  "ended_shift",
  "stale_nurse",
  "participation_conflict",
]);

const validateResponseSchema = z.discriminatedUnion("status", [
  z.object({
    expires_at: z.string().min(1),
    floor_name: z.string().min(1),
    invite_id: z.string().min(1),
    nurse_id: z.string().min(1),
    nurse_name: z.string().min(1),
    shift_id: z.string().min(1),
    status: z.literal("valid"),
  }),
  z.object({ reason: blockReasonSchema, status: z.literal("blocked") }),
]);

const acceptResponseSchema = z.discriminatedUnion("status", [
  z.object({
    access_id: z.string().min(1),
    floor_name: z.string().min(1),
    nurse_id: z.string().min(1),
    nurse_name: z.string().min(1),
    shift_id: z.string().min(1),
    status: z.literal("joined"),
  }),
  z.object({ reason: blockReasonSchema, status: z.literal("blocked") }),
]);

type InviteRow = z.infer<typeof inviteRowSchema>;
type AccessRow = z.infer<typeof accessRowSchema>;

type ShiftNurseInviteBlockedResult = Extract<
  ShiftNurseInviteValidationResult,
  { status: "blocked" }
>;

const invalidResponse = "The invite service returned an invalid response.";
const inviteCodePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const inviteCodeLength = 6;

function assertChargeNurse(profile: Pick<UserProfile, "role">) {
  if (profile.role !== "charge_nurse") {
    throw new Error("Sign in as a charge nurse to manage nurse invites.");
  }
}

function assertOwnedActiveShift(
  activeShift: ActiveShiftRecord,
  profile: UserProfile,
) {
  if (!savedAccountIdSchema.safeParse(activeShift.id).success) {
    throw new Error("Start a server-backed shift before creating nurse invites.");
  }

  if (activeShift.chargeProfileId !== profile.id) {
    throw new Error("You can only manage invites for your own active shift.");
  }

  if (activeShift.endedAt) {
    throw new Error("Nurse invites can only be created for an active shift.");
  }
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

// Turns a failed Go request into an error the screen can show. The server's own
// message is used when it sent one, so its wording is never contradicted.
function inviteRequestError(error: unknown): never {
  const failure = readGoApiFailure(error);

  if (!failure) {
    return throwGoNetworkError(error, "invite service");
  }

  if (failure.status === 401) {
    throw new Error("Your session expired. Sign in again to manage invites.");
  }

  if (failure.status === 403) {
    throw new Error("This account cannot manage nurse invites.");
  }

  throw new Error(
    failure.message || "Nurse invites are temporarily unavailable. Try again.",
  );
}

// Joining nurses get their own wording: they are not managing invites. A
// missing profile reads as "not found", as the old database functions did.
function joinRequestError(error: unknown): ShiftNurseInviteBlockedResult {
  const failure = readGoApiFailure(error);

  if (failure?.status === 403 && failure.code === "profile_missing") {
    return {
      message: getValidationBlockMessage("not_found"),
      reason: "not_found",
      status: "blocked",
    };
  }

  if (failure?.status === 401) {
    throw new Error("Your session expired. Sign in again.");
  }

  if (failure) {
    throw new Error(
      failure.message || "Joining is temporarily unavailable. Try again.",
    );
  }

  return throwGoNetworkError(error, "invite service");
}

function mapInviteRow(row: InviteRow): ShiftNurseInviteRecord {
  return {
    createdAt: row.created_at,
    createdByProfileId: row.created_by_profile_id,
    expiresAt: row.expires_at,
    id: row.id,
    nurseId: row.nurse_id,
    revokedAt: row.revoked_at ?? undefined,
    shiftId: row.shift_id,
    status: row.status,
    usedAt: row.used_at ?? undefined,
    usedByProfileId: row.used_by_profile_id ?? undefined,
  };
}

function mapAccessRow(row: AccessRow): ShiftNurseAccess {
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

function blockedFormatResult(message: string) {
  return {
    message,
    reason: "invalid_format" as const,
    status: "blocked" as const,
  };
}

// One call returns both the invites and the linked-nurse access rows.
export async function loadShiftNurseInvitesAndAccess(
  supabase: SupabaseClient,
  profile: UserProfile,
  activeShift: ActiveShiftRecord,
) {
  assertChargeNurse(profile);
  assertOwnedActiveShift(activeShift, profile);

  const headers = await getGoAuthHeaders(supabase);
  const response = await goApiClient
    .get<unknown>(`/shifts/${activeShift.id}/invites`, { headers })
    .catch(inviteRequestError);
  const result = inviteListSchema.safeParse(response.data);

  if (response.status !== 200 || !result.success) {
    throw new Error(invalidResponse);
  }

  return {
    access: result.data.access.map(mapAccessRow),
    invites: result.data.invites.map(mapInviteRow),
  };
}

async function postInvite(
  path: "invites" | "invites/regenerate",
  supabase: SupabaseClient,
  profile: UserProfile,
  { activeShift, nurseId }: GenerateShiftNurseInviteCodeInput,
): Promise<GeneratedShiftNurseInviteCode> {
  assertChargeNurse(profile);
  assertOwnedActiveShift(activeShift, profile);

  const headers = await getGoAuthHeaders(supabase);
  const response = await goApiClient
    .post<unknown>(`/shifts/${activeShift.id}/${path}`, { nurse_id: nurseId }, { headers })
    .catch(inviteRequestError);
  const result = generatedInviteSchema.safeParse(response.data);

  if (response.status !== 201 || !result.success) {
    throw new Error(invalidResponse);
  }

  const invite = mapInviteRow(result.data.invite);

  if (invite.shiftId !== activeShift.id || invite.nurseId !== nurseId) {
    throw new Error(invalidResponse);
  }

  return { code: result.data.code, invite };
}

export function generateShiftNurseInviteCode(
  supabase: SupabaseClient,
  profile: UserProfile,
  input: GenerateShiftNurseInviteCodeInput,
) {
  return postInvite("invites", supabase, profile, input);
}

export function regenerateShiftNurseInviteCode(
  supabase: SupabaseClient,
  profile: UserProfile,
  input: GenerateShiftNurseInviteCodeInput,
) {
  return postInvite("invites/regenerate", supabase, profile, input);
}

export async function validateShiftNurseInviteCode(
  supabase: SupabaseClient,
  code: string,
): Promise<ShiftNurseInviteValidationResult> {
  const formatMessage = getNurseInviteCodeFormatMessage(code);

  if (formatMessage) {
    return blockedFormatResult(formatMessage);
  }

  const headers = await getGoAuthHeaders(supabase);
  const response = await goApiClient
    .post<unknown>(
      "/invites/validate",
      { code: getNormalizedNurseInviteCode(code) },
      { headers },
    )
    .catch(joinRequestError);

  // A missing profile comes back as a ready-made blocked result.
  if (!("data" in response)) {
    return response;
  }

  const result = validateResponseSchema.safeParse(response.data);

  if (response.status !== 200 || !result.success) {
    throw new Error(invalidResponse);
  }

  if (result.data.status === "blocked") {
    return {
      message: getValidationBlockMessage(result.data.reason),
      reason: result.data.reason,
      status: "blocked",
    };
  }

  if (Date.parse(result.data.expires_at) <= Date.now()) {
    return {
      message: getValidationBlockMessage("expired"),
      reason: "expired",
      status: "blocked",
    };
  }

  return {
    expiresAt: result.data.expires_at,
    floorName: result.data.floor_name,
    inviteId: result.data.invite_id,
    nurseId: result.data.nurse_id,
    nurseName: result.data.nurse_name,
    shiftId: result.data.shift_id,
    status: "valid",
  };
}

export async function acceptShiftNurseInviteCode(
  supabase: SupabaseClient,
  code: string,
): Promise<ShiftNurseInviteAcceptResult> {
  const formatMessage = getNurseInviteCodeFormatMessage(code);

  if (formatMessage) {
    return blockedFormatResult(formatMessage);
  }

  const headers = await getGoAuthHeaders(supabase);
  const response = await goApiClient
    .post<unknown>(
      "/invites/accept",
      { code: getNormalizedNurseInviteCode(code) },
      { headers },
    )
    .catch(joinRequestError);

  // A missing profile comes back as a ready-made blocked result.
  if (!("data" in response)) {
    return response;
  }

  const result = acceptResponseSchema.safeParse(response.data);

  if (response.status !== 200 || !result.success) {
    throw new Error(invalidResponse);
  }

  if (result.data.status === "blocked") {
    return {
      message: getValidationBlockMessage(result.data.reason),
      reason: result.data.reason,
      status: "blocked",
    };
  }

  return {
    accessId: result.data.access_id,
    floorName: result.data.floor_name,
    nurseId: result.data.nurse_id,
    nurseName: result.data.nurse_name,
    shiftId: result.data.shift_id,
    status: "joined",
  };
}
