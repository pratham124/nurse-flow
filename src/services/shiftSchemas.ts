import { z } from "zod";

import type {
  ActiveShiftRecord,
  ManualAssignmentOverride,
  ServerPreviousShiftSnapshot,
  Shift,
} from "../types/models";

const license = z.enum(["RN", "LPN"]);
const experience = z.enum(["new_grad", "mid", "experienced"]);
const acuity = z.enum(["green", "yellow", "red"]);
const patient = z.looseObject({
  initials: z.string(),
  age: z.number().optional(),
  sex: z.enum(["female", "male", "other", "unknown"]).optional(),
  diagnosis: z.string().optional(),
});
const nurse = z.looseObject({
  id: z.string(),
  name: z.string(),
  licenseType: license,
  experienceLevel: experience,
  maxPatientLoad: z.number(),
});
const bed = z.looseObject({
  id: z.string(),
  roomId: z.string(),
  label: z.string(),
  bedNumber: z.number(),
});
const doctorSide = z.looseObject({ id: z.string(), name: z.string() });
const room = z.looseObject({
  id: z.string(),
  doctorSideId: z.string(),
  label: z.string(),
  bedCount: z.number(),
});
const range = z.object({ min: z.number(), max: z.number() });
const flag = z.looseObject({
  id: z.string(),
  type: z.enum([
    "validation",
    "unassigned_bed",
    "no_eligible_coverage",
    "rn_required",
    "over_side_load_limit",
    "over_max_load",
    "team_imbalance",
    "understaffed",
  ]),
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string(),
  nurseId: z.string().optional(),
  roomId: z.string().optional(),
  bedId: z.string().optional(),
  teamId: z.string().optional(),
});
const request = z.looseObject({
  id: z.string(),
  type: z.enum(["issue", "swap"]),
  status: z.enum(["pending", "accepted", "declined"]),
  requestingNurseId: z.string(),
  requestingNurseName: z.string(),
  message: z.string(),
  createdAt: z.string(),
  sourceBedId: z.string().optional(),
  targetNurseId: z.string().optional(),
  targetBedId: z.string().optional(),
  resolvedAt: z.string().optional(),
  resolutionNote: z.string().optional(),
  issueReviewStatus: z.enum(["open", "reviewed", "resolved"]).optional(),
  reviewedAt: z.string().optional(),
  reviewedByProfileId: z.string().optional(),
  issueResolvedAt: z.string().optional(),
  issueResolvedByProfileId: z.string().optional(),
  swapCompletedAt: z.string().optional(),
  swapCompletedByProfileId: z.string().optional(),
  completedOverrideId: z.string().optional(),
  completedAssignmentChangedLater: z.boolean().optional(),
});

export const shiftSnapshotSchema = z.object({
  id: z.string(),
  floorTemplateId: z.string(),
  floorName: z.string(),
  startedAt: z.string().optional(),
  status: z.enum(["setup", "assigned"]),
  admittingDoctorSideId: z.string(),
  doctorSides: z.array(doctorSide),
  rooms: z.array(room),
  beds: z.array(bed),
  sideLoadLimits: z.object({ admitting: range, nonAdmitting: range }),
  nurses: z.array(nurse),
  bedStates: z.array(
    z.looseObject({
      id: z.string(),
      bedId: z.string(),
      patient: patient.optional(),
      acuity: acuity.optional(),
    }),
  ),
  assignmentResult: z
    .looseObject({
      id: z.string(),
      generatedTeams: z.array(
        z.looseObject({
          id: z.string(),
          label: z.string(),
          nurseIds: z.array(z.string()),
        }),
      ),
      roomCoverage: z.array(
        z.looseObject({
          id: z.string(),
          roomId: z.string(),
          nurseIds: z.array(z.string()),
        }),
      ),
      bedAssignments: z.array(
        z.looseObject({
          id: z.string(),
          bedId: z.string(),
          nurseId: z.string(),
        }),
      ),
    })
    .optional(),
  flags: z.array(flag),
  nurseRequests: z.array(request).optional(),
  carryOverReviewedAt: z.string().optional(),
});

const warning = z.looseObject({
  id: z.string(),
  warningType: z.enum([
    "over_side_load_limit",
    "over_max_load",
    "team_imbalance",
  ]),
  message: z.string(),
  nurseId: z.string().optional(),
  bedId: z.string().optional(),
  acknowledgedByProfileId: z.string(),
  acknowledgedAt: z.string(),
});

const overrideRow = z
  .object({
    id: z.string(),
    shift_id: z.string(),
    baseline_assignment_result_id: z.string(),
    bed_id: z.string(),
    from_nurse_id: z.string(),
    to_nurse_id: z.string(),
    created_by_profile_id: z.string(),
    created_at: z.string(),
    status: z.enum(["active", "superseded"]),
    superseded_at: z.string().nullable(),
    server_sequence: z.number(),
    related_swap_request_id: z.string().nullable(),
    warning_acknowledgements: z.preprocess(
      (v) => (Array.isArray(v) ? v : []),
      z.array(warning),
    ),
  })
  .transform(
    (row): ManualAssignmentOverride => ({
      id: row.id,
      shiftId: row.shift_id,
      baselineAssignmentResultId: row.baseline_assignment_result_id,
      bedId: row.bed_id,
      fromNurseId: row.from_nurse_id,
      toNurseId: row.to_nurse_id,
      createdByProfileId: row.created_by_profile_id,
      createdAt: row.created_at,
      status: row.status,
      supersededAt: row.superseded_at ?? undefined,
      serverSequence: row.server_sequence,
      relatedSwapRequestId: row.related_swap_request_id ?? undefined,
      warningAcknowledgements: row.warning_acknowledgements,
    }),
  );

const activeShiftRow = z
  .object({
    id: z.uuid(),
    charge_profile_id: z.string(),
    floor_template_id: z.string().nullable(),
    status: z.enum(["setup", "assigned"]),
    shift_snapshot: shiftSnapshotSchema,
    created_at: z.string(),
    updated_at: z.iso.datetime({ offset: true }),
    ended_at: z.string().nullable(),
    active_assignment_overrides_by_bed_id: z.record(z.string(), overrideRow),
  })
  .transform(
    (row): ActiveShiftRecord => ({
      id: row.id,
      chargeProfileId: row.charge_profile_id,
      floorTemplateId:
        row.floor_template_id ?? row.shift_snapshot.floorTemplateId,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      endedAt: row.ended_at ?? undefined,
      // This metadata travels WITH a draft. Never pair an older draft with the
      // latest store version; that would defeat optimistic concurrency checks.
      shiftSnapshot: { ...row.shift_snapshot, serverRevision: row.updated_at },
      activeAssignmentOverridesByBedId:
        row.active_assignment_overrides_by_bed_id,
    }),
  );

export const currentShiftSchema = z.object({
  active_shift: activeShiftRow.nullable(),
});
export const savedShiftSchema = z.object({ active_shift: activeShiftRow });
export const previousShiftsSchema = z.object({
  snapshots: z.array(
    z
      .object({
        id: z.string(),
        charge_profile_id: z.string(),
        floor_template_id: z.string().nullable(),
        completed_at: z.string(),
        nurse_suggestions: z.preprocess(
          (v) => (Array.isArray(v) ? v : []),
          z.array(
            z.looseObject({
              id: z.string(),
              previousNurseId: z.string(),
              name: z.string(),
              licenseType: license,
              experienceLevel: experience,
            }),
          ),
        ),
        patient_suggestions: z.preprocess(
          (v) => (Array.isArray(v) ? v : []),
          z.array(
            z.looseObject({
              id: z.string(),
              previousBedId: z.string(),
              previousBedLabel: z.string(),
              patient,
              acuity: acuity.optional(),
            }),
          ),
        ),
      })
      .transform(
        (row): ServerPreviousShiftSnapshot => ({
          id: row.id,
          chargeProfileId: row.charge_profile_id,
          floorTemplateId: row.floor_template_id ?? "",
          completedAt: row.completed_at,
          nurseSuggestions: row.nurse_suggestions,
          patientSuggestions: row.patient_suggestions,
        }),
      ),
  ),
});

// Reopen always returns an empty projection, as did the retained RPC.
export const reopenShiftSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("stale"), message: z.string() }),
  z.object({ status: z.literal("saved"), shiftSnapshot: shiftSnapshotSchema }),
]);

export function toShiftSetup(shift: Shift) {
  // Only these fields belong to setup. Layout, status, baseline and requests
  // remain authoritative on the server even if a caller sends a forged Shift.
  return {
    admittingDoctorSideId: shift.admittingDoctorSideId,
    sideLoadLimits: shift.sideLoadLimits,
    nurses: shift.nurses.map(
      ({ id, name, licenseType, experienceLevel, maxPatientLoad }) => ({
        id,
        name,
        licenseType,
        experienceLevel,
        maxPatientLoad,
      }),
    ),
    bedStates: shift.bedStates.map(({ id, bedId, acuity, patient: value }) => ({
      id,
      bedId,
      acuity,
      patient: value
        ? {
            initials: value.initials,
            age: value.age,
            sex: value.sex,
            diagnosis: value.diagnosis,
          }
        : undefined,
    })),
    carryOverReviewedAt: shift.carryOverReviewedAt,
  };
}
