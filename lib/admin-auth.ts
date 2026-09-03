import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminProfile = {
  id: string;
  full_name: string | null;
  email: string;
  role: "subscriber" | "admin";
};

/**
 * Call at the top of every admin Server Component / layout / Server Action.
 * Two-step check, deliberately not trusting either step alone:
 *   1. Is there a signed-in user at all? -> /login
 *   2. Does profiles.role = 'admin' for that user? -> redirect to a plain
 *      "not authorized" state rather than looping back to /login, since
 *      looping back to a login screen for an already-authenticated
 *      non-admin user is confusing ("didn't I just log in?").
 *
 * This is a defense-in-depth check, not the only gate: RLS policies
 * (is_admin() in the backend workstream's migration) are the real
 * boundary on the data itself. This function protects the admin UI/UX;
 * RLS protects the rows even if this check were ever bypassed or a new
 * route forgot to call it.
 */
export async function requireAdmin(): Promise<AdminProfile> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.role !== "admin") {
    redirect("/login?error=not_authorized");
  }

  return profile as AdminProfile;
}
