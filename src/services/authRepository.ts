import type { User } from "@supabase/supabase-js";

import { loadOrCreateUserProfile } from "./profileRepository";
import { getSupabaseClient } from "./supabaseClient";
import type { UserProfile, UserRole } from "../types/models";

type SignUpInput = {
  displayName: string;
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type AuthResult = {
  profile: UserProfile;
};

const defaultSignupRole: UserRole = "charge_nurse";

function getAuthClient() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase is not configured yet.");
  }

  return supabase;
}

function getProfileInputFromUser(user: User, displayName?: string) {
  const metadata = user.user_metadata;
  const metadataDisplayName =
    typeof metadata.display_name === "string" ? metadata.display_name : "";

  return {
    authUserId: user.id,
    displayName:
      displayName?.trim() || metadataDisplayName.trim() || user.email || "NurseFlow user",
    role: defaultSignupRole,
  };
}

export async function signUpWithEmail({
  displayName,
  email,
  password,
}: SignUpInput): Promise<AuthResult> {
  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        role: defaultSignupRole,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Supabase did not return a new user.");
  }

  if (!data.session) {
    throw new Error(
      "Account created. Confirm your email, then sign in to finish creating the NurseFlow profile.",
    );
  }

  const profile = await loadOrCreateUserProfile(
    supabase,
    getProfileInputFromUser(data.user, displayName),
  );

  return { profile };
}

export async function loginWithEmail({
  email,
  password,
}: LoginInput): Promise<AuthResult> {
  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Supabase did not return the signed-in user.");
  }

  const profile = await loadOrCreateUserProfile(
    supabase,
    getProfileInputFromUser(data.user),
  );

  return { profile };
}

export async function signOutCurrentSession() {
  const supabase = getAuthClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    throw new Error(error.message);
  }
}
