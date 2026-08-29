import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserProfile, UserRole } from "../types/models";

type CreateUserProfileInput = {
  authUserId: string;
  displayName: string;
  role: UserRole;
};

type ProfileRow = {
  auth_user_id: string;
  created_at: string;
  display_name: string;
  id: string;
  role: string;
  updated_at: string;
};

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

export async function loadUserProfile(
  supabase: SupabaseClient,
  authUserId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, auth_user_id, display_name, role, created_at, updated_at")
    .eq("auth_user_id", authUserId)
    .maybeSingle<ProfileRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapProfileRow(data) : undefined;
}

export async function createUserProfile(
  supabase: SupabaseClient,
  input: CreateUserProfileInput,
) {
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: input.authUserId,
      display_name: input.displayName,
      role: input.role,
    })
    .select("id, auth_user_id, display_name, role, created_at, updated_at")
    .single<ProfileRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapProfileRow(data);
}

export async function loadOrCreateUserProfile(
  supabase: SupabaseClient,
  input: CreateUserProfileInput,
) {
  const existingProfile = await loadUserProfile(supabase, input.authUserId);

  if (existingProfile) {
    return existingProfile;
  }

  return createUserProfile(supabase, input);
}
