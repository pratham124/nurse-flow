import type { SupabaseClient } from "@supabase/supabase-js";
import { isAxiosError, type AxiosResponse } from "axios";
import { z } from "zod";

import { goApiClient } from "./goApiClient";

import type { FloorTemplate, FloorTemplateRecord } from "../types/models";

const floorTemplateRowSchema = z.object({
  created_at: z.string(),
  id: z.string(),
  name: z.string(),
  owner_profile_id: z.string(),
  template_snapshot: z.unknown(),
  updated_at: z.string(),
});

const floorTemplateListSchema = z.object({
  templates: z.array(floorTemplateRowSchema),
});

export type FloorTemplateRow = z.infer<typeof floorTemplateRowSchema>;

const invalidResponseMessage =
  "The template service returned an invalid response.";

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
    doctorSides: snapshot.doctorSides.map((doctorSide) => ({
      ...doctorSide,
    })),
    id: row.id,
    name: row.name,
    rooms: snapshot.rooms.map((room) => ({ ...room })),
  };
}

// Shared by Go list reads and the existing Supabase template writes.
export function mapTemplateRow(row: FloorTemplateRow): FloorTemplateRecord {
  return {
    createdAt: row.created_at,
    id: row.id,
    name: row.name,
    ownerProfileId: row.owner_profile_id,
    templateSnapshot: requireFloorTemplateSnapshot(row.template_snapshot, row),
    updatedAt: row.updated_at,
  };
}

function templateRequestErrorMessage(status: number) {
  switch (status) {
    case 401:
      return "Your session expired. Sign in again to load floor templates.";
    case 403:
      return "This account cannot load charge nurse floor templates.";
    case 503:
      return "Floor templates are temporarily unavailable. Try again.";
    default:
      return "The template service could not load floor templates. Try again.";
  }
}

function throwTemplateRequestError(error: unknown): never {
  if (!isAxiosError(error)) {
    throw error;
  }
  if (error.response) {
    throw new Error(templateRequestErrorMessage(error.response.status));
  }
  if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
    throw new Error("The template service took too long. Try again.");
  }
  throw new Error(
    "Could not reach the template service. Check the API address and connection, then try again.",
  );
}

function parseFloorTemplateList(
  response: AxiosResponse<unknown>,
  profileId: string,
): FloorTemplateRecord[] {
  if (response.status !== 200) {
    throw new Error(invalidResponseMessage);
  }
  const result = floorTemplateListSchema.safeParse(response.data);
  if (!result.success) {
    throw new Error(invalidResponseMessage);
  }

  const templates = result.data.templates.map(mapTemplateRow);
  if (templates.some((template) => template.ownerProfileId !== profileId)) {
    throw new Error("A server template was returned for the wrong account.");
  }
  return templates;
}

export async function loadFloorTemplates(
  supabase: SupabaseClient,
  profileId: string,
): Promise<FloorTemplateRecord[]> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error("Your session could not be loaded. Sign in again.");
  }
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error("Sign in before loading floor templates.");
  }

  const response = await goApiClient
    .get<unknown>("/floor-templates", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .catch(throwTemplateRequestError);

  return parseFloorTemplateList(response, profileId);
}
