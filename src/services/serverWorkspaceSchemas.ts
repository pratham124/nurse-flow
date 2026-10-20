import { z } from "zod";

import { overrideWarningSchema, shiftSnapshotSchema } from "./shiftSchemas";

const requiredText = z.string().min(1);
const optionalRpcText = z.string().nullish().transform((value) => value ?? undefined);

export const manualAssignmentOverrideSchema = z.looseObject({
  id: requiredText,
  shiftId: requiredText,
  baselineAssignmentResultId: requiredText,
  bedId: requiredText,
  fromNurseId: requiredText,
  toNurseId: requiredText,
  createdByProfileId: requiredText,
  createdAt: requiredText,
  status: z.enum(["active", "superseded"]),
  supersededAt: optionalRpcText,
  serverSequence: z.number(),
  relatedSwapRequestId: optionalRpcText,
  warningAcknowledgements: z.preprocess(
    (value) => (Array.isArray(value) ? value : []),
    z.array(overrideWarningSchema),
  ),
});

export const manualAssignmentOverrideResultSchema = z.object({
  activeAssignmentOverridesByBedId: z.unknown().optional(),
  currentBaselineAssignmentResultId: optionalRpcText,
  currentEffectiveNurseId: optionalRpcText,
  message: optionalRpcText,
  override: z.unknown().optional(),
  status: z.enum(["saved", "stale"]),
});

export const shiftNurseAccessSchema = z.object({
  createdAt: z.string().nullish(),
  created_at: z.string().nullish(),
  id: z.string().nullish(),
  nurseEmail: z.string().nullish(),
  nurseId: z.string().nullish(),
  nurseName: z.string().nullish(),
  nurseProfileId: z.string().nullish(),
  nurse_email: z.string().nullish(),
  nurse_id: z.string().nullish(),
  nurse_name: z.string().nullish(),
  nurse_profile_id: z.string().nullish(),
  shiftId: z.string().nullish(),
  shift_id: z.string().nullish(),
  status: z.string().nullish(),
  updatedAt: z.string().nullish(),
  updated_at: z.string().nullish(),
});

export const joinedNurseAssignedBedSchema = z.object({
  bed: shiftSnapshotSchema.shape.beds.element,
  bedState: shiftSnapshotSchema.shape.bedStates.element.nullish()
    .transform((value) => value ?? undefined),
  doctorSide: shiftSnapshotSchema.shape.doctorSides.element,
  room: shiftSnapshotSchema.shape.rooms.element,
});

export const joinedNurseAssignmentResultSchema = z.object({
  access: z.unknown(),
  assignedBeds: z.unknown().optional(),
  assigned_beds: z.unknown().optional(),
  floorName: z.string().nullish(),
  floor_name: z.string().nullish(),
  nurseName: z.string().nullish(),
  nurse_name: z.string().nullish(),
  requestHistory: z.unknown().optional(),
  request_history: z.unknown().optional(),
  shiftId: z.string().nullish(),
  shift_id: z.string().nullish(),
});

export const requestHistorySchema = z.preprocess(
  (value) => (Array.isArray(value) ? value : []),
  shiftSnapshotSchema.shape.nurseRequests.unwrap(),
);
