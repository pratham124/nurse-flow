import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  loadFloorTemplates,
  saveFloorTemplate,
  deleteFloorTemplate,
} from "./floorTemplateRepository";
import { goApiClient } from "./goApiClient";
import { getGoAuthHeaders } from "./goApiAuth";
import { readGoApiFailure, throwGoNetworkError } from "./goApiErrors";
import {
  loadServerActiveShift,
  loadPreviousShiftSnapshots,
} from "./shiftRepository";
import { nurseRequestSchema } from "./shiftSchemas";
import {
  joinedNurseAssignedBedSchema,
  joinedNurseAssignmentResultSchema,
  manualAssignmentOverrideResultSchema,
  manualAssignmentOverrideSchema,
  requestHistorySchema,
  shiftNurseAccessSchema,
} from "./serverWorkspaceSchemas";
import type {
  ActiveAssignmentOverridesByBedId,
  FloorTemplate,
  JoinedNurseAssignedBed,
  JoinedNurseAssignmentView,
  ManualAssignmentOverride,
  OverrideWarningAcknowledgementInput,
  ServerWorkspace,
  Shift,
  ShiftAccessStatus,
  ShiftNurseAccess,
  UserProfile,
} from "../types/models";

export {
  createServerActiveShift,
  endServerActiveShift,
  loadServerActiveShift,
  resetServerActiveShiftForEditing,
  saveServerActiveShift,
} from "./shiftRepository";

type JoinedNurseAssignmentRpcResult = z.infer<
  typeof joinedNurseAssignmentResultSchema
>;

type NotificationTargetAccessRow = {
  id: string;
  shift_id: string;
  status: ShiftAccessStatus;
};

export type JoinedNurseNotificationTargetState =
  | { assignmentView: JoinedNurseAssignmentView; status: "ready" }
  | { status: "shift_ended" | "access_removed" };

export type OpenShiftNurseChatInput = {
  nurseId: string;
  shiftId: string;
};

export type ConfirmManualAssignmentOverrideInput = {
  baselineAssignmentResultId: string;
  bedId: string;
  clientMutationId: string;
  fromNurseId: string;
  relatedSwapRequestId?: string;
  shiftId: string;
  toNurseId: string;
  warningAcknowledgements: OverrideWarningAcknowledgementInput[];
};

export type ConfirmManualAssignmentOverrideResult = {
  activeAssignmentOverridesByBedId: ActiveAssignmentOverridesByBedId;
  currentBaselineAssignmentResultId?: string;
  currentEffectiveNurseId?: string;
  message?: string;
  override?: ManualAssignmentOverride;
  status: "saved" | "stale";
};

export type ResetActiveShiftForEditingResult =
  | {
      activeAssignmentOverridesByBedId: ActiveAssignmentOverridesByBedId;
      shiftSnapshot: Shift;
      status: "saved";
    }
  | {
      message: string;
      status: "stale";
    };

function assertChargeNurse(profile: Pick<UserProfile, "role">) {
  if (profile.role !== "charge_nurse") {
    throw new Error(
      "Sign in with a NurseFlow account to manage charge nurse templates.",
    );
  }
}

function assertOwnedRecord(
  recordProfileId: string,
  expectedProfileId: string,
  message: string,
) {
  if (recordProfileId !== expectedProfileId) {
    throw new Error(message);
  }
}

function requireManualAssignmentOverride(
  value: unknown,
): ManualAssignmentOverride {
  const result = manualAssignmentOverrideSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      "A manual assignment override has an invalid server shape.",
    );
  }

  return result.data;
}

function requireActiveAssignmentOverrideProjection(
  value: unknown,
): ActiveAssignmentOverridesByBedId {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([bedId, override]) => [
      bedId,
      requireManualAssignmentOverride(override),
    ]),
  );
}

function requireShiftNurseAccess(
  value: unknown,
  profile: UserProfile,
  shiftId: string,
): ShiftNurseAccess {
  const result = shiftNurseAccessSchema.safeParse(value);
  if (!result.success) {
    throw new Error("Shift access has an invalid server shape.");
  }
  const access = result.data;

  const status = access.status ?? "";
  const nurseProfileId =
    access.nurseProfileId ?? access.nurse_profile_id ?? undefined;

  if (
    status !== "pending_link" &&
    status !== "linked" &&
    status !== "removed"
  ) {
    throw new Error("Shift access has an unsupported status.");
  }

  if (status !== "linked") {
    throw new Error("No shift access yet.");
  }

  if (nurseProfileId !== profile.id) {
    throw new Error("This shift access does not belong to this account.");
  }

  return {
    createdAt: access.createdAt ?? access.created_at ?? "",
    id: access.id ?? "",
    nurseEmail: access.nurseEmail ?? access.nurse_email ?? undefined,
    nurseId: access.nurseId ?? access.nurse_id ?? "",
    nurseName: access.nurseName ?? access.nurse_name ?? "",
    nurseProfileId,
    shiftId: access.shiftId ?? access.shift_id ?? shiftId,
    status: "linked",
    updatedAt: access.updatedAt ?? access.updated_at ?? "",
  };
}

function requireNurseAssignedBeds(value: unknown): JoinedNurseAssignedBed[] {
  if (!Array.isArray(value)) {
    throw new Error("The nurse assignment view has invalid assigned beds.");
  }

  return value.map((assignedBed) => {
    const result = joinedNurseAssignedBedSchema.safeParse(assignedBed);
    if (!result.success) {
      throw new Error(
        "The nurse assignment view has a missing bed, room, or side.",
      );
    }

    return result.data;
  });
}

function mapJoinedNurseAssignmentView(
  result: JoinedNurseAssignmentRpcResult,
  profile: UserProfile,
): JoinedNurseAssignmentView {
  const shiftId = result.shiftId ?? result.shift_id ?? "";
  const floorName = result.floorName ?? result.floor_name ?? "";
  const nurseName = result.nurseName ?? result.nurse_name ?? "";
  const assignedBeds = result.assignedBeds ?? result.assigned_beds;
  const requestHistory = result.requestHistory ?? result.request_history ?? [];

  if (!shiftId || !floorName || !nurseName) {
    throw new Error("The nurse assignment view has an invalid server shape.");
  }
  const history = requestHistorySchema.safeParse(requestHistory);
  if (!history.success) {
    throw new Error("The nurse assignment view has an invalid server shape.");
  }

  return {
    access: requireShiftNurseAccess(result.access, profile, shiftId),
    assignedBeds: requireNurseAssignedBeds(assignedBeds),
    floorName,
    nurseName,
    requestHistory: history.data,
    shiftId,
  };
}

// Turns a failed Go request into an error the screen can show. The server's
// own user-facing message is used when it sent one.
function requestWriteError(
  error: unknown,
  serviceName: string,
  fallbackMessage: string,
): never {
  const failure = readGoApiFailure(error);

  if (!failure) {
    return throwGoNetworkError(error, serviceName);
  }

  if (failure.status === 401) {
    throw new Error("Your session expired. Sign in again.");
  }

  throw new Error(failure.message || fallbackMessage);
}

export async function confirmManualAssignmentOverride(
  supabase: SupabaseClient,
  input: ConfirmManualAssignmentOverrideInput,
): Promise<ConfirmManualAssignmentOverrideResult> {
  const headers = await getGoAuthHeaders(supabase);
  const response = await goApiClient
    .post<unknown>(
      `/shifts/${encodeURIComponent(input.shiftId)}/assignment-moves`,
      {
        baseline_assignment_result_id: input.baselineAssignmentResultId,
        bed_id: input.bedId,
        client_mutation_id: input.clientMutationId,
        from_nurse_id: input.fromNurseId,
        related_swap_request_id: input.relatedSwapRequestId ?? null,
        to_nurse_id: input.toNurseId,
        warning_acknowledgements: input.warningAcknowledgements,
      },
      { headers },
    )
    .catch((error) =>
      requestWriteError(
        error,
        "assignment service",
        "The assignment move could not be saved. Try again.",
      ),
    );

  const parsed = manualAssignmentOverrideResultSchema.safeParse(response.data);
  if (response.status !== 200 || !parsed.success) {
    throw new Error(
      "The manual assignment override returned an invalid result.",
    );
  }
  const result = parsed.data;

  return {
    activeAssignmentOverridesByBedId: requireActiveAssignmentOverrideProjection(
      result.activeAssignmentOverridesByBedId,
    ),
    currentBaselineAssignmentResultId: result.currentBaselineAssignmentResultId,
    currentEffectiveNurseId: result.currentEffectiveNurseId,
    message: result.message,
    override: result.override
      ? requireManualAssignmentOverride(result.override)
      : undefined,
    status: result.status,
  };
}

export async function loadServerWorkspace(
  supabase: SupabaseClient,
  profile: UserProfile,
): Promise<ServerWorkspace> {
  assertChargeNurse(profile);

  const [floorTemplates, activeShift, previousShiftSnapshots] =
    await Promise.all([
      loadFloorTemplates(supabase, profile.id),
      loadServerActiveShift(supabase, profile),
      loadPreviousShiftSnapshots(supabase, profile),
    ]);

  previousShiftSnapshots.forEach((snapshot) => {
    assertOwnedRecord(
      snapshot.chargeProfileId,
      profile.id,
      "A carry-over snapshot was returned for the wrong account.",
    );
  });

  return {
    activeShift,
    floorTemplates,
    previousShiftSnapshots,
    profile,
  };
}

const joinedWorkspaceResponseSchema = z.object({
  assignment: z.record(z.string(), z.unknown()).nullable(),
});

function joinedWorkspaceRequestError(error: unknown): never {
  return requestWriteError(
    error,
    "workspace service",
    "Your shared workspace is temporarily unavailable. Try again.",
  );
}

export async function loadJoinedNurseAssignmentView(
  supabase: SupabaseClient,
  profile: UserProfile,
) {
  const headers = await getGoAuthHeaders(supabase);
  const response = await goApiClient
    .get<unknown>("/joined-workspace", { headers })
    .catch(joinedWorkspaceRequestError);
  const envelope = joinedWorkspaceResponseSchema.safeParse(response.data);

  if (response.status !== 200 || !envelope.success) {
    throw new Error("The nurse assignment view has an invalid server shape.");
  }

  if (!envelope.data.assignment) {
    return undefined;
  }

  const result = joinedNurseAssignmentResultSchema.safeParse(
    envelope.data.assignment,
  );
  if (!result.success) {
    throw new Error("The nurse assignment view has an invalid server shape.");
  }
  return mapJoinedNurseAssignmentView(result.data, profile);
}

export async function loadJoinedNurseNotificationTargetState(
  supabase: SupabaseClient,
  profile: UserProfile,
  target: { accessId: string; shiftId: string },
): Promise<JoinedNurseNotificationTargetState> {
  const { data: access, error } = await supabase
    .from("shift_nurse_access")
    .select("id, shift_id, status")
    .eq("id", target.accessId)
    .eq("shift_id", target.shiftId)
    .eq("nurse_profile_id", profile.id)
    .maybeSingle<NotificationTargetAccessRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!access || access.status !== "linked") {
    return { status: "access_removed" };
  }

  const assignmentView = await loadJoinedNurseAssignmentView(supabase, profile);

  if (
    assignmentView?.access.id === access.id &&
    assignmentView.shiftId === access.shift_id
  ) {
    return { assignmentView, status: "ready" };
  }

  return { status: "shift_ended" };
}

const requestEnvelopeSchema = z.object({ request: nurseRequestSchema });

// Both "open chat" routes answer 201 when the chat was just created and 200
// when it already existed, and return the chat entry either way.
async function openNurseChat(supabase: SupabaseClient, path: string) {
  const headers = await getGoAuthHeaders(supabase);
  const response = await goApiClient
    .post<unknown>(path, {}, { headers })
    .catch((error) =>
      requestWriteError(
        error,
        "chat service",
        "The chat could not be opened. Try again.",
      ),
    );
  const envelope = requestEnvelopeSchema.safeParse(response.data);

  if (
    (response.status !== 200 && response.status !== 201) ||
    !envelope.success
  ) {
    throw new Error("The chat service returned an invalid server shape.");
  }

  return envelope.data.request;
}

export function openJoinedNurseChat(supabase: SupabaseClient) {
  return openNurseChat(supabase, "/joined-workspace/chat");
}

export function openShiftNurseChat(
  supabase: SupabaseClient,
  input: OpenShiftNurseChatInput,
) {
  return openNurseChat(
    supabase,
    `/shifts/${encodeURIComponent(input.shiftId)}/nurses/${encodeURIComponent(input.nurseId)}/chat`,
  );
}

export async function saveServerFloorTemplate(
  supabase: SupabaseClient,
  profile: UserProfile,
  floorTemplate: FloorTemplate,
) {
  assertChargeNurse(profile);

  return saveFloorTemplate(supabase, profile.id, floorTemplate);
}

export async function deleteServerFloorTemplate(
  supabase: SupabaseClient,
  profile: UserProfile,
  floorTemplateId: string,
) {
  assertChargeNurse(profile);

  return deleteFloorTemplate(supabase, floorTemplateId);
}
