import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

/** Redirects a subscriber to Stripe's hosted portal for cancellation, payment
 * method updates and plan lifecycle management. Subscription truth remains
 * Stripe-owned and webhooks reconcile the database afterwards. */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: subscription, error } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subscription?.stripe_customer_id) return NextResponse.json({ error: "No Stripe billing profile is available for this account." }, { status: 404 });

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl}/dashboard`,
    });
    return NextResponse.json({ url: session.url });
  } catch (portalError: any) {
    return NextResponse.json({ error: portalError?.message ?? "Could not open billing portal" }, { status: 500 });
  }
}
