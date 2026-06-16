import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserProfile, UserRole } from "../types/models";

type ProfileRow = {
  auth_user_id: string;
  created_at: string;
  display_name: string;
  id: string;
  role: string;
  updated_at: string;
};

function isUserRole(role: string): role is UserRole {
  return role === "charge_nurse" || role === "regular_nurse";
}

function mapProfileRow(row: ProfileRow): UserProfile {
  if (!isUserRole(row.role)) {
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
