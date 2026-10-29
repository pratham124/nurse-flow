import { z } from "zod";

import { goApiClient } from "./goApiClient";
import { readGoApiFailure, throwGoNetworkError } from "./goApiErrors";
import type { UserProfile } from "../types/models";

const profileRowSchema = z.object({
  auth_user_id: z.string(),
  created_at: z.string(),
  display_name: z.string(),
  id: z.string(),
  role: z.string(),
  updated_at: z.string(),
});

const profileResponseSchema = z.object({ profile: profileRowSchema });

type ProfileRow = z.infer<typeof profileRowSchema>;

const invalidResponse = "The profile service returned an invalid response.";

function mapProfileRow(row: ProfileRow): UserProfile {
  if (row.role !== "charge_nurse") {
    throw new Error("This account profile has an unsupported role.");
  }

  return {
    authUserId: row.auth_user_id,
    createdAt: row.created_at,
    displayName: row.display_name,
    id: row.id,
    role: row.role,
    updatedAt: row.updated_at,
  };
}

function profileRequestError(error: unknown): never {
  const failure = readGoApiFailure(error);

  if (!failure) {
    return throwGoNetworkError(error, "profile service");
  }

  if (failure.status === 401) {
    throw new Error("Your session expired. Sign in again.");
  }

  throw new Error(
    failure.message || "Your profile is temporarily unavailable. Try again.",
  );
}

function readProfile(status: number, data: unknown) {
  const result = profileResponseSchema.safeParse(data);

  if (status !== 200 || !result.success) {
    throw new Error(invalidResponse);
  }

  return mapProfileRow(result.data.profile);
}

// Loads the signed-in user's application profile. Returns undefined when none exists yet.
export async function loadUserProfile(accessToken: string) {
  const response = await goApiClient
    .get<unknown>("/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .catch((error: unknown) =>
      readGoApiFailure(error)?.code === "profile_missing"
        ? undefined
        : profileRequestError(error),
    );

  return response ? readProfile(response.status, response.data) : undefined;
}

// The server derives the display name and role from the verified token, so
// the request carries no body.
export async function loadOrCreateUserProfile(accessToken: string) {
  const response = await goApiClient
    .put<unknown>("/profile", undefined, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .catch(profileRequestError);

  return readProfile(response.status, response.data);
}
