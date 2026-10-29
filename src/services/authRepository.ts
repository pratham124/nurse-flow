import { loadOrCreateUserProfile } from "./profileRepository";
import { getSupabaseClient } from "./supabaseClient";
import type { UserProfile } from "../types/models";

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

function getAuthClient() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase is not configured yet.");
  }

  return supabase;
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
    // The Go server reads display_name from the verified token; it also
    // chooses the role, so the client sends none.
    options: { data: { display_name: displayName } },
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

  const profile = await loadOrCreateUserProfile(data.session.access_token);

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

  if (!data.user || !data.session) {
    throw new Error("Supabase did not return the signed-in user.");
  }

  const profile = await loadOrCreateUserProfile(data.session.access_token);

  return { profile };
}

export async function signOutCurrentSession() {
  const supabase = getAuthClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    throw new Error(error.message);
  }
}
