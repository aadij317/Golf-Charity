import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email";

/**
 * POST /api/auth/welcome
 *
 * Called once from signup-form.tsx right after supabase.auth.signUp()
 * succeeds. Kept as its own tiny server route (rather than sending the
 * email from the client) because the email provider API key must never
 * reach the browser. Uses the caller's own cookie-bound session, so this
 * can only ever send a welcome email to the account that's actually
 * signed in — not an arbitrary address.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.email) {
    await sendWelcomeEmail(profile.email, profile.full_name);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
