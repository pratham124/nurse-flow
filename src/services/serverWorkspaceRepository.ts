import type { SupabaseClient } from "@supabase/supabase-js";

import { expireActiveShiftNurseInvites } from "./shiftInviteRepository";
import type {
  ActiveShiftRecord,
  FloorTemplate,
  FloorTemplateRecord,
  JoinedNurseAssignedBed,
  JoinedNurseAssignmentView,
  NurseRequestStatus,
  PreviousShiftSnapshot,
  ServerPreviousShiftSnapshot,
  ServerWorkspace,
  Shift,
  ShiftAccessStatus,
  ShiftStatus,
  UserProfile,
} from "../types/models";

type FloorTemplateRow = {
  created_at: string;
  id: string;
  name: string;
  owner_profile_id: string;
  template_snapshot: unknown;
  updated_at: string;
};

type ActiveShiftRow = {
  charge_profile_id: string;
  created_at: string;
  ended_at: string | null;
  floor_template_id: string;
  id: string;
  shift_snapshot: unknown;
  status: string;
  updated_at: string;
};

type PreviousShiftSnapshotRow = {
  charge_profile_id: string;
  completed_at: string;
  floor_template_id: string;
  id: string;
  nurse_suggestions: unknown;
  patient_suggestions: unknown;
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

type ChargeProfileIdentifier = Pick<UserProfile, "id" | "role">;

const templateColumns =
  "id, owner_profile_id, name, template_snapshot, created_at, updated_at";
const activeShiftColumns =
  "id, charge_profile_id, floor_template_id, status, shift_snapshot, created_at, updated_at, ended_at";
const previousShiftColumns =
  "id, charge_profile_id, floor_template_id, completed_at, nurse_suggestions, patient_suggestions";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function requireFloorTemplateSnapshot(value: unknown, row: FloorTemplateRow) {
  const snapshot = value as Partial<FloorTemplate> | undefined;

  if (
    !snapshot ||
    !Array.isArray(snapshot.doctorSides) ||
    !Array.isArray(snapshot.rooms) ||
    !Array.isArray(snapshot.beds)
  ) {
    throw new Error("A saved floor template has an invalid server shape.");
  }

  return {
    beds: snapshot.beds.map((bed) => ({ ...bed })),
    doctorSides: snapshot.doctorSides.map((doctorSide) => ({ ...doctorSide })),
    id: row.id,
    name: row.name,
    rooms: snapshot.rooms.map((room) => ({ ...room })),
  };
}

function requireShiftSnapshot(value: unknown) {
  const shift = value as Shift | undefined;

  if (
    !shift ||
    !Array.isArray(shift.doctorSides) ||
    !Array.isArray(shift.rooms) ||
    !Array.isArray(shift.beds) ||
    !Array.isArray(shift.nurses) ||
    !Array.isArray(shift.bedStates) ||
    !Array.isArray(shift.flags)
  ) {
    throw new Error("The active shift has an invalid server shape.");
  }

  return {
    admittingDoctorSideId: shift.admittingDoctorSideId,
    assignmentResult: shift.assignmentResult,
    bedStates: shift.bedStates,
    beds: shift.beds,
    carryOverReviewedAt: shift.carryOverReviewedAt,
    doctorSides: shift.doctorSides,
    flags: shift.flags,
    floorName: shift.floorName,
    floorTemplateId: shift.floorTemplateId,
    id: shift.id,
    nurseRequests: shift.nurseRequests,
    nurses: shift.nurses,
    rooms: shift.rooms,
    sideLoadLimits: shift.sideLoadLimits,
    startedAt: shift.startedAt,
    status: shift.status,
  };
}

function getActiveShiftPayload(activeShift: Shift) {
  return {
    shift_snapshot: activeShift,
    status: activeShift.status,
    updated_at: new Date().toISOString(),
  };
}

function isShiftStatus(status: string): status is ShiftStatus {
  return status === "setup" || status === "assigned";
}

function isShiftAccessStatus(status: string): status is ShiftAccessStatus {
  return (
    status === "pending_link" || status === "linked" || status === "removed"
  );
}

function mapTemplateRow(row: FloorTemplateRow): FloorTemplateRecord {
  return {
    createdAt: row.created_at,
    id: row.id,
    name: row.name,
    ownerProfileId: row.owner_profile_id,
    templateSnapshot: requireFloorTemplateSnapshot(row.template_snapshot, row),
    updatedAt: row.updated_at,
  };
}

function mapActiveShiftRow(row: ActiveShiftRow): ActiveShiftRecord {
  if (!isShiftStatus(row.status)) {
    throw new Error("The active shift has an unsupported status.");
  }

  return {
    chargeProfileId: row.charge_profile_id,
    createdAt: row.created_at,
    endedAt: row.ended_at ?? undefined,
    floorTemplateId: row.floor_template_id,
    id: row.id,
    shiftSnapshot: requireShiftSnapshot(row.shift_snapshot),
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function mapPreviousShiftRow(
  row: PreviousShiftSnapshotRow,
): ServerPreviousShiftSnapshot {
  const nurseSuggestions = Array.isArray(row.nurse_suggestions)
    ? row.nurse_suggestions
    : [];
  const patientSuggestions = Array.isArray(row.patient_suggestions)
    ? row.patient_suggestions
    : [];

  return {
    chargeProfileId: row.charge_profile_id,
    completedAt: row.completed_at,
    floorTemplateId: row.floor_template_id,
    id: row.id,
    nurseSuggestions,
    patientSuggestions,
  } as ServerPreviousShiftSnapshot;
}

function requireShiftNurseAccess(
  value: unknown,
  profile: UserProfile,
  shiftId: string,
) {
  const access = value as ShiftNurseAccessSnapshot | undefined;

  if (!access) {
    throw new Error("Shift access has an invalid server shape.");
  }

  const status = access.status ?? "";
  const nurseProfileId =
    access.nurseProfileId ?? access.nurse_profile_id ?? undefined;

  if (!isShiftAccessStatus(status)) {
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
    status,
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

function getReusableTemplateSnapshot(
  floorTemplate: FloorTemplate,
): FloorTemplate {
  return {
    beds: floorTemplate.beds.map((bed) => ({ ...bed })),
    doctorSides: floorTemplate.doctorSides.map((doctorSide) => ({
      ...doctorSide,
    })),
    id: floorTemplate.id,
    name: floorTemplate.name.trim(),
    rooms: floorTemplate.rooms.map((room) => ({ ...room })),
  };
}

async function loadFloorTemplates(
  supabase: SupabaseClient,
  profileId: string,
) {
  const { data, error } = await supabase
    .from("floor_templates")
    .select(templateColumns)
    .eq("owner_profile_id", profileId)
    .order("updated_at", { ascending: false })
    .overrideTypes<FloorTemplateRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapTemplateRow);
}

export async function loadServerActiveShift(
  supabase: SupabaseClient,
  profile: ChargeProfileIdentifier,
) {
  assertChargeNurse(profile);

  const { data, error } = await supabase
    .from("active_shifts")
    .select(activeShiftColumns)
    .eq("charge_profile_id", profile.id)
    .is("ended_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<ActiveShiftRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return undefined;
  }

  const activeShift = mapActiveShiftRow(data);

  assertOwnedRecord(
    activeShift.chargeProfileId,
    profile.id,
    "A server shift was returned for the wrong account.",
  );

  return activeShift;
}

async function loadPreviousShiftSnapshots(
  supabase: SupabaseClient,
  profileId: string,
) {
  const { data, error } = await supabase
    .from("previous_shift_snapshots")
    .select(previousShiftColumns)
    .eq("charge_profile_id", profileId)
    .order("completed_at", { ascending: false })
    .overrideTypes<PreviousShiftSnapshotRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapPreviousShiftRow);
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
      loadPreviousShiftSnapshots(supabase, profile.id),
    ]);

  floorTemplates.forEach((template) => {
    assertOwnedRecord(
      template.ownerProfileId,
      profile.id,
      "A server template was returned for the wrong account.",
    );
  });

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

export async function saveServerFloorTemplate(
  supabase: SupabaseClient,
  profile: UserProfile,
  floorTemplate: FloorTemplate,
) {
  assertChargeNurse(profile);

  const templateSnapshot = getReusableTemplateSnapshot(floorTemplate);
  const basePayload = {
    name: templateSnapshot.name,
    template_snapshot: templateSnapshot,
    updated_at: new Date().toISOString(),
  };
  const isExistingServerTemplate = uuidPattern.test(floorTemplate.id);

  if (isExistingServerTemplate) {
    const { data, error } = await supabase
      .from("floor_templates")
      .update(basePayload)
      .eq("id", floorTemplate.id)
      .eq("owner_profile_id", profile.id)
      .select(templateColumns)
      .single<FloorTemplateRow>();

    if (error) {
      throw new Error(error.message);
    }

    return mapTemplateRow(data);
  }

  const { data, error } = await supabase
    .from("floor_templates")
    .insert({
      ...basePayload,
      owner_profile_id: profile.id,
    })
    .select(templateColumns)
    .single<FloorTemplateRow>();

  if (error) {
    throw new Error(error.message);
  }

  const savedSnapshot = {
    ...templateSnapshot,
    id: data.id,
  };

  const { data: refreshedData, error: refreshError } = await supabase
    .from("floor_templates")
    .update({ template_snapshot: savedSnapshot })
    .eq("id", data.id)
    .eq("owner_profile_id", profile.id)
    .select(templateColumns)
    .single<FloorTemplateRow>();

  if (refreshError) {
    throw new Error(refreshError.message);
  }

  return mapTemplateRow(refreshedData);
}

export async function deleteServerFloorTemplate(
  supabase: SupabaseClient,
  profile: UserProfile,
  floorTemplateId: string,
) {
  assertChargeNurse(profile);

  if (!uuidPattern.test(floorTemplateId)) {
    throw new Error("Only saved account templates can be deleted.");
  }

  const { error } = await supabase
    .from("floor_templates")
    .delete()
    .eq("id", floorTemplateId)
    .eq("owner_profile_id", profile.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createServerActiveShift(
  supabase: SupabaseClient,
  profile: UserProfile,
  activeShift: Shift,
) {
  assertChargeNurse(profile);

  if (!uuidPattern.test(activeShift.floorTemplateId)) {
    throw new Error("Save the floor template to this account before starting a shift.");
  }

  const { data, error } = await supabase
    .from("active_shifts")
    .insert({
      charge_profile_id: profile.id,
      floor_template_id: activeShift.floorTemplateId,
      ...getActiveShiftPayload(activeShift),
    })
    .select(activeShiftColumns)
    .single<ActiveShiftRow>();

  if (error) {
    throw new Error(error.message);
  }

  const serverShiftSnapshot = {
    ...activeShift,
    id: data.id,
  };

  const { data: refreshedData, error: refreshError } = await supabase
    .from("active_shifts")
    .update(getActiveShiftPayload(serverShiftSnapshot))
    .eq("id", data.id)
    .eq("charge_profile_id", profile.id)
    .select(activeShiftColumns)
    .single<ActiveShiftRow>();

  if (refreshError) {
    throw new Error(refreshError.message);
  }

  return mapActiveShiftRow(refreshedData);
}

export async function saveServerActiveShift(
  supabase: SupabaseClient,
  profile: UserProfile,
  activeShift: Shift,
) {
  assertChargeNurse(profile);

  if (!uuidPattern.test(activeShift.id)) {
    throw new Error("Start this shift from a saved account template before saving changes.");
  }

  const { data, error } = await supabase
    .from("active_shifts")
    .update(getActiveShiftPayload(activeShift))
    .eq("id", activeShift.id)
    .eq("charge_profile_id", profile.id)
    .is("ended_at", null)
    .select(activeShiftColumns)
    .single<ActiveShiftRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapActiveShiftRow(data);
}

export async function endServerActiveShift(
  supabase: SupabaseClient,
  profile: UserProfile,
  activeShift: Shift,
) {
  assertChargeNurse(profile);

  if (!uuidPattern.test(activeShift.id)) {
    throw new Error("Only server active shifts can be ended from this account.");
  }

  const currentActiveShift = await loadServerActiveShift(supabase, profile);

  if (!currentActiveShift || currentActiveShift.id !== activeShift.id) {
    throw new Error("This active shift is no longer open.");
  }

  await expireActiveShiftNurseInvites(supabase, profile, currentActiveShift);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("active_shifts")
    .update({
      ended_at: now,
      shift_snapshot: activeShift,
      updated_at: now,
    })
    .eq("id", activeShift.id)
    .eq("charge_profile_id", profile.id)
    .is("ended_at", null)
    .select(activeShiftColumns)
    .single<ActiveShiftRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapActiveShiftRow(data);
}

export async function saveServerPreviousShiftSnapshot(
  supabase: SupabaseClient,
  profile: UserProfile,
  snapshot: PreviousShiftSnapshot,
) {
  assertChargeNurse(profile);

  if (!uuidPattern.test(snapshot.floorTemplateId)) {
    throw new Error("Save the floor template to this account before saving carry-over.");
  }

  const { error: deleteError } = await supabase
    .from("previous_shift_snapshots")
    .delete()
    .eq("charge_profile_id", profile.id)
    .eq("floor_template_id", snapshot.floorTemplateId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const hasUsefulSuggestions =
    snapshot.nurseSuggestions.length > 0 ||
    snapshot.patientSuggestions.length > 0;

  if (!hasUsefulSuggestions) {
    return undefined;
  }

  const { data, error } = await supabase
    .from("previous_shift_snapshots")
    .insert({
      charge_profile_id: profile.id,
      completed_at: snapshot.completedAt,
      floor_template_id: snapshot.floorTemplateId,
      nurse_suggestions: snapshot.nurseSuggestions,
      patient_suggestions: snapshot.patientSuggestions,
    })
    .select(previousShiftColumns)
    .single<PreviousShiftSnapshotRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapPreviousShiftRow(data);
}
