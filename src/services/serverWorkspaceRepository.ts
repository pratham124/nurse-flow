import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ActiveShiftRecord,
  FloorTemplate,
  FloorTemplateRecord,
  PreviousShiftSnapshot,
  ServerPreviousShiftSnapshot,
  ServerWorkspace,
  Shift,
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

const templateColumns =
  "id, owner_profile_id, name, template_snapshot, created_at, updated_at";
const activeShiftColumns =
  "id, charge_profile_id, floor_template_id, status, shift_snapshot, created_at, updated_at, ended_at";
const previousShiftColumns =
  "id, charge_profile_id, floor_template_id, completed_at, nurse_suggestions, patient_suggestions";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertChargeNurse(profile: UserProfile) {
  if (profile.role !== "charge_nurse") {
    throw new Error("Regular nurse accounts cannot manage charge nurse templates.");
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

  return shift;
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

function toPreviousShiftSnapshot(
  snapshot: ServerPreviousShiftSnapshot,
): PreviousShiftSnapshot {
  return {
    completedAt: snapshot.completedAt,
    floorTemplateId: snapshot.floorTemplateId,
    id: snapshot.id,
    nurseSuggestions: snapshot.nurseSuggestions,
    patientSuggestions: snapshot.patientSuggestions,
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

async function loadActiveShift(
  supabase: SupabaseClient,
  profileId: string,
) {
  const { data, error } = await supabase
    .from("active_shifts")
    .select(activeShiftColumns)
    .eq("charge_profile_id", profileId)
    .is("ended_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<ActiveShiftRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapActiveShiftRow(data) : undefined;
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
      loadActiveShift(supabase, profile.id),
      loadPreviousShiftSnapshots(supabase, profile.id),
    ]);

  return {
    activeShift,
    floorTemplates,
    previousShiftSnapshots,
    profile,
  };
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

export function getLocalStateFromServerWorkspace(workspace: ServerWorkspace) {
  return {
    activeShift: workspace.activeShift?.shiftSnapshot,
    floorTemplates: workspace.floorTemplates.map(
      (record) => record.templateSnapshot,
    ),
    previousShiftSnapshots: workspace.previousShiftSnapshots.map(
      toPreviousShiftSnapshot,
    ),
  };
}
