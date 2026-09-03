import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * PRD §04: "Non-subscribers receive restricted access to platform
 * features" and "Real-time subscription status check on every
 * authenticated request." This is deliberately a live DB read on every
 * call rather than something cached on the session/JWT, so a lapsed or
 * cancelled subscription (e.g. from a Stripe webhook that just fired)
 * takes effect immediately instead of waiting for the user's token to
 * refresh.
 *
 * Call this with the request-scoped, cookie-bound client (lib/supabase/
 * server.ts) so the query stays RLS-scoped to the caller's own row —
 * never pass the service-role client in here.
 */
export async function getActiveSubscription(supabase: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("subscriptions")
    .select("id, plan, status, current_period_end, charity_id, charity_contribution_pct")
    .eq("user_id", userId)
    .eq("status", "active")
    // Seeded/manual subscriptions may not have a Stripe period end, but a
    // Stripe-backed subscription must not remain feature-active past expiry
    // merely because a webhook was delayed.
    .or(`current_period_end.is.null,current_period_end.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function hasActiveSubscription(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const sub = await getActiveSubscription(supabase, userId);
  return sub !== null;
}
