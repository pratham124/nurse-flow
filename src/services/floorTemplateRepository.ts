import type { SupabaseClient } from "@supabase/supabase-js";
import { isAxiosError } from "axios";

import {
  floorTemplateListSchema,
  floorTemplateSaveSchema,
  toFloorTemplateSnapshot,
} from "./floorTemplateSchemas";
import { goApiClient } from "./goApiClient";
import { savedAccountIdSchema } from "./identifierSchemas";

import type { FloorTemplate, FloorTemplateRecord } from "../types/models";

type TemplateAction = "load" | "save" | "delete";

const sessionActions = {
  load: "loading",
  save: "saving",
  delete: "deleting",
};

const invalidResponseMessage =
  "The template service returned an invalid response.";

function templateRequestErrorMessage(status: number, action: TemplateAction) {
  if (action === "load" && [400, 404, 413].includes(status)) {
    return "The template service could not load floor templates. Try again.";
  }
  switch (status) {
    case 400:
      return "The floor template layout is incomplete or inconsistent.";
    case 401:
      return `Your session expired. Sign in again to ${action} floor templates.`;
    case 403:
      return `This account cannot ${action} charge nurse floor templates.`;
    case 404:
      return "This floor template is no longer available. Refresh and try again.";
    case 413:
      return "The floor template is too large.";
    case 503:
      return "Floor templates are temporarily unavailable. Try again.";
    default:
      return `The template service could not ${action} floor templates. Try again.`;
  }
}

function throwTemplateRequestError(
  error: unknown,
  action: TemplateAction = "load",
): never {
  if (!isAxiosError(error)) {
    throw error;
  }
  if (error.response) {
    throw new Error(templateRequestErrorMessage(error.response.status, action));
  }
  if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
    throw new Error("The template service took too long. Try again.");
  }
  throw new Error(
    "Could not reach the template service. Check the API address and connection, then try again.",
  );
}

async function templateAuthorization(
  supabase: SupabaseClient,
  action: TemplateAction,
) {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error("Your session could not be loaded. Sign in again.");
  }
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error(`Sign in before ${sessionActions[action]} floor templates.`);
  }
  return { Authorization: `Bearer ${accessToken}` };
}

export async function loadFloorTemplates(
  supabase: SupabaseClient,
  profileId: string,
): Promise<FloorTemplateRecord[]> {
  const headers = await templateAuthorization(supabase, "load");
  const response = await goApiClient
    .get<unknown>("/floor-templates", { headers })
    .catch(throwTemplateRequestError);

  const result = floorTemplateListSchema.safeParse(response.data);
  if (response.status !== 200 || !result.success) {
    throw new Error(invalidResponseMessage);
  }
  const templates = result.data.templates;
  if (templates.some((template) => template.ownerProfileId !== profileId)) {
    throw new Error("A server template was returned for the wrong account.");
  }
  return templates;
}

export async function saveFloorTemplate(
  supabase: SupabaseClient,
  profileId: string,
  floorTemplate: FloorTemplate,
): Promise<FloorTemplateRecord> {
  const headers = await templateAuthorization(supabase, "save");
  const snapshot = toFloorTemplateSnapshot(floorTemplate);
  const existing = savedAccountIdSchema.safeParse(floorTemplate.id).success;
  const response = await goApiClient
    .request<unknown>({
      method: existing ? "PUT" : "POST",
      url: existing ? `/floor-templates/${floorTemplate.id}` : "/floor-templates",
      data: { template_snapshot: snapshot },
      headers,
    })
    .catch((error: unknown) => throwTemplateRequestError(error, "save"));

  const result = floorTemplateSaveSchema.safeParse(response.data);
  if (response.status !== (existing ? 200 : 201) || !result.success) {
    throw new Error(invalidResponseMessage);
  }
  const saved = result.data.template;
  if (
    saved.ownerProfileId !== profileId ||
    (existing && saved.id.toLowerCase() !== floorTemplate.id.toLowerCase())
  ) {
    throw new Error("A server template was returned for the wrong account or template.");
  }
  return saved;
}

export async function deleteFloorTemplate(
  supabase: SupabaseClient,
  floorTemplateId: string,
): Promise<void> {
  if (!savedAccountIdSchema.safeParse(floorTemplateId).success) {
    throw new Error("Only saved account templates can be deleted.");
  }
  const headers = await templateAuthorization(supabase, "delete");
  const response = await goApiClient
    .delete<unknown>(`/floor-templates/${floorTemplateId}`, { headers })
    .catch((error: unknown) => throwTemplateRequestError(error, "delete"));
  if (response.status !== 204) {
    throw new Error(invalidResponseMessage);
  }
}
