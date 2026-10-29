import type { SupabaseClient } from "@supabase/supabase-js";

// Builds the Authorization header the Go API expects from the current Supabase session.
export async function getGoAuthHeaders(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error("Your session could not be loaded. Sign in again.");
  }

  return { Authorization: `Bearer ${data.session.access_token}` };
}
