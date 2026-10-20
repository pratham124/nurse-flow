import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadFloorTemplates,
  saveFloorTemplate,
  deleteFloorTemplate,
} from "./floorTemplateRepository";
import { loadServerActiveShift, loadPreviousShiftSnapshots } from "./shiftRepository";
import type {
  ActiveAssignmentOverridesByBedId,
  FloorTemplate,
  JoinedNurseAssignedBed,
  JoinedNurseAssignmentView,
  ManualAssignmentOverride,
  NurseIssueReviewStatus,
  OverrideWarningAcknowledgementInput,
  NurseRequestStatus,
  ServerWorkspace,
  Shift,
  ShiftAccessStatus,
  ShiftNurseAccess,
  UserProfile,
} from "../types/models";

export { createServerActiveShift, endServerActiveShift, loadServerActiveShift, resetServerActiveShiftForEditing, saveServerActiveShift } from "./shiftRepository";

type ManualAssignmentOverrideRpcResult = {
  activeAssignmentOverridesByBedId?: unknown;
  currentBaselineAssignmentResultId?: string;
  currentEffectiveNurseId?: string;
  message?: string;
  override?: unknown;
  status?: string;
};

type JoinedNurseAssignmentRpcResult = {
  access: unknown;
  assignedBeds?: unknown;
  assigned_beds?: unknown;
  floorName?: string;
  floor_name?: string;
  nurseName?: string;
  nurse_name?: string;
  requestHistory?: unknown;
  request_history?: unknown;
  shiftId?: string;
  shift_id?: string;
};

type ShiftNurseAccessSnapshot = {
  createdAt?: string;
  created_at?: string;
  id?: string;
  nurseEmail?: string | null;
  nurseId?: string;
  nurseName?: string;
  nurseProfileId?: string | null;
  nurse_email?: string | null;
  nurse_id?: string;
  nurse_name?: string;
  nurse_profile_id?: string | null;
  shiftId?: string;
  shift_id?: string;
  status?: string;
  updatedAt?: string;
  updated_at?: string;
};

type NotificationTargetAccessRow = {
  id: string;
  shift_id: string;
  status: ShiftAccessStatus;
};

export type JoinedNurseNotificationTargetState =
  | { assignmentView: JoinedNurseAssignmentView; status: "ready" }
  | { status: "shift_ended" | "access_removed" };

type SubmitJoinedNurseIssueRequestInput = {
  message: string;
};

type SubmitJoinedNurseSwapRequestInput = {
  message: string;
  sourceBedId: string;
};

type ResolveShiftNurseSwapRequestInput = {
  nextStatus: Extract<NurseRequestStatus, "accepted" | "declined">;
  requestId: string;
};

type UpdateShiftNurseIssueStatusInput = {
  nextStatus: NurseIssueReviewStatus;
  requestId: string;
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
    throw new Error("Sign in with a NurseFlow account to manage charge nurse templates.");
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
  const override = value as Partial<ManualAssignmentOverride> | undefined;

  if (
    !override?.id ||
    !override.shiftId ||
    !override.baselineAssignmentResultId ||
    !override.bedId ||
    !override.fromNurseId ||
    !override.toNurseId ||
    !override.createdByProfileId ||
    !override.createdAt ||
    (override.status !== "active" && override.status !== "superseded") ||
    typeof override.serverSequence !== "number"
  ) {
    throw new Error("A manual assignment override has an invalid server shape.");
  }

  return {
    ...override,
    warningAcknowledgements: Array.isArray(override.warningAcknowledgements)
      ? override.warningAcknowledgements
      : [],
  } as ManualAssignmentOverride;
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
  const access = value as ShiftNurseAccessSnapshot | undefined;

  if (!access) {
    throw new Error("Shift access has an invalid server shape.");
  }

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
    const bedView = assignedBed as Partial<JoinedNurseAssignedBed>;

    if (!bedView.bed || !bedView.doctorSide || !bedView.room) {
      throw new Error("The nurse assignment view has a missing bed, room, or side.");
    }

    return {
      bed: { ...bedView.bed },
      bedState: bedView.bedState ? { ...bedView.bedState } : undefined,
      doctorSide: { ...bedView.doctorSide },
      room: { ...bedView.room },
    };
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

  return {
    access: requireShiftNurseAccess(result.access, profile, shiftId),
    assignedBeds: requireNurseAssignedBeds(assignedBeds),
    floorName,
    nurseName,
    requestHistory: Array.isArray(requestHistory) ? requestHistory : [],
    shiftId,
  };
}

export async function confirmManualAssignmentOverride(
  supabase: SupabaseClient,
  input: ConfirmManualAssignmentOverrideInput,
): Promise<ConfirmManualAssignmentOverrideResult> {
  const { data, error } = await supabase.rpc(
    "confirm_manual_assignment_override",
    {
      p_baseline_assignment_result_id: input.baselineAssignmentResultId,
      p_bed_id: input.bedId,
      p_client_mutation_id: input.clientMutationId,
      p_from_nurse_id: input.fromNurseId,
      p_related_swap_request_id: input.relatedSwapRequestId ?? null,
      p_shift_id: input.shiftId,
      p_to_nurse_id: input.toNurseId,
      p_warning_acknowledgements: input.warningAcknowledgements,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const result = data as ManualAssignmentOverrideRpcResult | null;

  if (result?.status !== "saved" && result?.status !== "stale") {
    throw new Error("The manual assignment override returned an invalid result.");
  }

  return {
    activeAssignmentOverridesByBedId:
      requireActiveAssignmentOverrideProjection(
        result.activeAssignmentOverridesByBedId,
      ),
    currentBaselineAssignmentResultId:
      result.currentBaselineAssignmentResultId,
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

export async function loadJoinedNurseAssignmentView(
  supabase: SupabaseClient,
  profile: UserProfile,
) {
  const { data, error } = await supabase.rpc(
    "get_joined_nurse_assignment_view",
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return undefined;
  }

  return mapJoinedNurseAssignmentView(
    data as JoinedNurseAssignmentRpcResult,
    profile,
  );
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

  const assignmentView = await loadJoinedNurseAssignmentView(
    supabase,
    profile,
  );

  if (
    assignmentView?.access.id === access.id &&
    assignmentView.shiftId === access.shift_id
  ) {
    return { assignmentView, status: "ready" };
  }

  return { status: "shift_ended" };
}

export async function submitJoinedNurseIssueRequest(
  supabase: SupabaseClient,
  request: SubmitJoinedNurseIssueRequestInput,
) {
  const message = request.message.trim();

  if (!message) {
    throw new Error("Add issue details before submitting.");
  }

  const { error } = await supabase.rpc("submit_joined_nurse_issue_request", {
    request_message: message,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function submitJoinedNurseSwapRequest(
  supabase: SupabaseClient,
  request: SubmitJoinedNurseSwapRequestInput,
) {
  const message = request.message.trim();

  if (!request.sourceBedId) {
    throw new Error("Choose the assigned bed for this swap request.");
  }

  if (!message) {
    throw new Error("Add swap details before submitting.");
  }

  const { error } = await supabase.rpc("submit_joined_nurse_swap_request", {
    request_message: message,
    source_bed_id: request.sourceBedId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function resolveShiftNurseSwapRequest(
  supabase: SupabaseClient,
  request: ResolveShiftNurseSwapRequestInput,
) {
  const { error } = await supabase.rpc("resolve_shift_nurse_swap_request", {
    next_status: request.nextStatus,
    request_id: request.requestId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateShiftNurseIssueStatus(
  supabase: SupabaseClient,
  request: UpdateShiftNurseIssueStatusInput,
) {
  const { error } = await supabase.rpc("update_shift_nurse_issue_status", {
    p_next_status: request.nextStatus,
    p_request_id: request.requestId,
  });

  if (error) {
    throw new Error(error.message);
  }
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
