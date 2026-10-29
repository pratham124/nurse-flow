import { z } from "zod";

import type { FloorTemplate, FloorTemplateRecord } from "../types/models";

const doctorSideSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const roomSchema = z.object({
  id: z.string(),
  doctorSideId: z.string(),
  label: z.string(),
  bedCount: z.number(),
});

const bedSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  label: z.string(),
  bedNumber: z.number(),
});

const floorLayoutSchema = z.object({
  doctorSides: z.array(doctorSideSchema),
  rooms: z.array(roomSchema),
  beds: z.array(bedSchema),
});

const floorTemplateSnapshotSchema = floorLayoutSchema.extend({
  id: z.string(),
  name: z.string().trim(),
});

type FloorTemplateSnapshot = z.infer<typeof floorTemplateSnapshotSchema>;

// Preserve extra stored element fields, but never send them back in a save.
const storedFloorLayoutSchema = floorLayoutSchema.extend({
  doctorSides: z.array(z.looseObject(doctorSideSchema.shape)),
  rooms: z.array(z.looseObject(roomSchema.shape)),
  beds: z.array(z.looseObject(bedSchema.shape)),
});

const floorTemplateRowSchema = z.object({
  id: z.string(),
  owner_profile_id: z.string(),
  name: z.string(),
  template_snapshot: storedFloorLayoutSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

function toFloorTemplateRecord(
  row: z.infer<typeof floorTemplateRowSchema>,
): FloorTemplateRecord {
  return {
    id: row.id,
    ownerProfileId: row.owner_profile_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Zod has already validated and copied the layout; row metadata wins.
    templateSnapshot: { ...row.template_snapshot, id: row.id, name: row.name },
  };
}

export const floorTemplateListSchema = z.object({
  templates: z.array(floorTemplateRowSchema.transform(toFloorTemplateRecord)),
});

export const floorTemplateSaveSchema = z.object({
  template: floorTemplateRowSchema
    .extend({ id: z.uuid() })
    .transform(toFloorTemplateRecord),
});

export function toFloorTemplateSnapshot(
  template: FloorTemplate,
): FloorTemplateSnapshot {
  const result = floorTemplateSnapshotSchema.safeParse(template);
  if (!result.success) {
    throw new Error("The floor template layout is incomplete or inconsistent.");
  }
  return result.data;
}
