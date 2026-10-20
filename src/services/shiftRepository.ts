import type { SupabaseClient } from "@supabase/supabase-js";
import { isAxiosError } from "axios";
import { z } from "zod";

import { goApiClient } from "./goApiClient";
import {
  currentShiftSchema,
  previousShiftsSchema,
  reopenShiftSchema,
  savedShiftSchema,
  toShiftSetup,
} from "./shiftSchemas";
import type { ResetActiveShiftForEditingResult } from "./serverWorkspaceRepository";
import type { ActiveShiftRecord, Shift, UserProfile } from "../types/models";

type ChargeProfile = Pick<UserProfile, "id" | "role">;
const uuid = z.uuid();
const invalidResponse = "The shift service returned an invalid response.";

async function authorization(supabase: SupabaseClient, profile: ChargeProfile) {
  if (profile.role !== "charge_nurse")
    throw new Error("Sign in as a charge nurse to manage shifts.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token)
    throw new Error("Your session could not be loaded. Sign in again.");
  return { Authorization: `Bearer ${data.session.access_token}` };
}

function requestError(error: unknown): never {
  if (!isAxiosError(error)) throw error;
  if (error.response) {
    const status = error.response.status;
    if (status === 401)
      throw new Error("Your session expired. Sign in again to manage shifts.");
    if (status === 403)
      throw new Error("This account cannot manage charge nurse shifts.");
    if (status === 404)
      throw new Error(
        "This shift or floor template is no longer available. Refresh and try again.",
      );
    if (status === 409) {
      const result = z
        .object({ error: z.object({ code: z.string() }) })
        .safeParse(error.response.data);
      const code = result.success ? result.data.error.code : "";
      if (code === "shift_assigned")
        throw new Error("Reopen the assigned shift before saving setup.");
      if (code === "shift_already_open")
        throw new Error(
          "An active shift already exists. Reload the workspace to resume it.",
        );
      throw new Error(
        "The shift changed. Reload the workspace and review the current setup before saving.",
      );
    }
    if (status === 400)
      throw new Error("The shift setup is incomplete or inconsistent.");
    if (status === 413) throw new Error("The shift setup is too large.");
    throw new Error("Shifts are temporarily unavailable. Try again.");
  }
  if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED")
    throw new Error("The shift service took too long. Try again.");
  throw new Error(
    "Could not reach the shift service. Check the API address and connection, then try again.",
  );
}

function checkOwned(
  row: ActiveShiftRecord,
  profile: ChargeProfile,
  id?: string,
) {
  if (
    row.chargeProfileId !== profile.id ||
    (id && row.id.toLowerCase() !== id.toLowerCase())
  ) {
    throw new Error(
      "A server shift was returned for the wrong account or shift.",
    );
  }
  if (
    row.shiftSnapshot.id !== row.id ||
    row.shiftSnapshot.status !== row.status ||
    row.shiftSnapshot.floorTemplateId !== row.floorTemplateId
  ) {
    throw new Error(invalidResponse);
  }
  for (const [bedId, override] of Object.entries(
    row.activeAssignmentOverridesByBedId ?? {},
  )) {
    if (
      override.shiftId !== row.id ||
      override.bedId !== bedId ||
      override.status !== "active"
    )
      throw new Error(invalidResponse);
  }
  return row;
}

function requireID(id: string) {
  if (!uuid.safeParse(id).success)
    throw new Error(
      "Only saved account shifts and templates can use this action.",
    );
}

export async function loadServerActiveShift(
  supabase: SupabaseClient,
  profile: ChargeProfile,
) {
  const headers = await authorization(supabase, profile);
  const response = await goApiClient
    .get<unknown>("/active-shifts/current", { headers })
    .catch(requestError);
  const result = currentShiftSchema.safeParse(response.data);
  if (response.status !== 200 || !result.success)
    throw new Error(invalidResponse);
  return result.data.active_shift
    ? checkOwned(result.data.active_shift, profile)
    : undefined;
}

export async function loadPreviousShiftSnapshots(
  supabase: SupabaseClient,
  profile: ChargeProfile,
) {
  const headers = await authorization(supabase, profile);
  const response = await goApiClient
    .get<unknown>("/previous-shift-snapshots", { headers })
    .catch(requestError);
  const result = previousShiftsSchema.safeParse(response.data);
  if (response.status !== 200 || !result.success)
    throw new Error(invalidResponse);
  if (result.data.snapshots.some((row) => row.chargeProfileId !== profile.id))
    throw new Error(
      "A carry-over snapshot was returned for the wrong account.",
    );
  return result.data.snapshots;
}

export async function createServerActiveShift(
  supabase: SupabaseClient,
  profile: UserProfile,
  shift: Shift,
) {
  requireID(shift.floorTemplateId);
  const headers = await authorization(supabase, profile);
  const response = await goApiClient
    .post<unknown>(
      "/active-shifts",
      { floor_template_id: shift.floorTemplateId },
      { headers },
    )
    .catch(requestError);
  const result = savedShiftSchema.safeParse(response.data);
  if (response.status !== 201 || !result.success)
    throw new Error(invalidResponse);
  const row = checkOwned(result.data.active_shift, profile);
  if (
    row.floorTemplateId !== shift.floorTemplateId ||
    row.status !== "setup" ||
    row.endedAt
  )
    throw new Error(invalidResponse);
  return row;
}

export async function saveServerActiveShift(
  supabase: SupabaseClient,
  profile: UserProfile,
  shift: Shift,
) {
  requireID(shift.id);
  if (!shift.serverRevision)
    throw new Error("Reload the workspace before saving this shift setup.");
  const headers = await authorization(supabase, profile);
  const response = await goApiClient
    .put<unknown>(
      `/active-shifts/${shift.id}/setup`,
      {
        expected_updated_at: shift.serverRevision,
        setup: toShiftSetup(shift),
      },
      { headers },
    )
    .catch(requestError);
  const result = savedShiftSchema.safeParse(response.data);
  if (response.status !== 200 || !result.success)
    throw new Error(invalidResponse);
  const row = checkOwned(result.data.active_shift, profile, shift.id);
  if (row.endedAt || row.status !== "setup") throw new Error(invalidResponse);
  return row;
}

export async function resetServerActiveShiftForEditing(
  supabase: SupabaseClient,
  profile: UserProfile,
  shiftId: string,
  expectedBaselineAssignmentResultId: string,
): Promise<ResetActiveShiftForEditingResult> {
  requireID(shiftId);
  const headers = await authorization(supabase, profile);
  const response = await goApiClient
    .post<unknown>(
      `/active-shifts/${shiftId}/reopen`,
      {
        expected_baseline_assignment_result_id:
          expectedBaselineAssignmentResultId,
      },
      { headers },
    )
    .catch(requestError);
  const result = reopenShiftSchema.safeParse(response.data);
  if (response.status !== 200 || !result.success)
    throw new Error(invalidResponse);
  if (result.data.status === "stale") return result.data;
  if (result.data.shiftSnapshot.id !== shiftId)
    throw new Error(invalidResponse);
  return { ...result.data, activeAssignmentOverridesByBedId: {} };
}

export async function endServerActiveShift(
  supabase: SupabaseClient,
  profile: UserProfile,
  shift: Shift,
) {
  requireID(shift.id);
  const headers = await authorization(supabase, profile);
  const response = await goApiClient
    .post<unknown>(`/active-shifts/${shift.id}/end`, {}, { headers })
    .catch(requestError);
  const result = savedShiftSchema.safeParse(response.data);
  if (response.status !== 200 || !result.success)
    throw new Error(invalidResponse);
  const row = checkOwned(result.data.active_shift, profile, shift.id);
  if (!row.endedAt) throw new Error(invalidResponse);
  return row;
}
