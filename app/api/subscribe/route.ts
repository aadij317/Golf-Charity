import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

/**
 * POST /api/subscribe
 *
 * Called from the subscriber-facing UI (e.g. the charities page / a
 * "Subscribe" button) once a signed-in user picks a plan + charity.
 * Creates a Stripe Checkout session and returns its URL for the client
 * to redirect to. Does NOT write the subscription row itself — that
 * happens in /api/webhooks/stripe once Stripe confirms the payment,
 * since a Checkout session can be abandoned and we don't want a
 * "subscription" row for something that was never actually paid.
 *
 * Body: { plan: "monthly" | "yearly", charity_id: string, contribution_pct?: number }
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { plan, charity_id, contribution_pct } = body ?? {};
  if (plan !== "monthly" && plan !== "yearly") {
    return NextResponse.json({ error: "plan must be 'monthly' or 'yearly'" }, { status: 400 });
  }
  if (!charity_id || typeof charity_id !== "string") {
    return NextResponse.json({ error: "charity_id is required" }, { status: 400 });
  }
  const contributionPct =
    typeof contribution_pct === "number" && contribution_pct >= 10 && contribution_pct <= 100
      ? contribution_pct
      : 10;

  const admin = createAdminClient();
  const { data: charity } = await admin
    .from("charities")
    .select("id")
    .eq("id", charity_id)
    .maybeSingle();

  if (!charity) {
    return NextResponse.json({ error: "Charity not found" }, { status: 404 });
  }

  const priceId =
    plan === "monthly"
      ? process.env.STRIPE_PRICE_ID_MONTHLY
      : process.env.STRIPE_PRICE_ID_YEARLY;

  if (!priceId) {
    return NextResponse.json(
      { error: `Missing STRIPE_PRICE_ID_${plan.toUpperCase()} in env` },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.origin}`;

  try {
    const stripe = getStripe();

    // Reuse an existing Stripe customer for this user if we've already
    // created one (from an earlier subscription attempt), else let
    // Checkout create one and we'll capture it in the webhook.
    const { data: existingSub } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .maybeSingle();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: existingSub?.stripe_customer_id ?? undefined,
      customer_email: existingSub?.stripe_customer_id ? undefined : user.email,
      success_url: `${appUrl}/dashboard?subscribed=1`,
      cancel_url: `${appUrl}/charities?cancelled=1`,
      metadata: {
        user_id: user.id,
        plan,
        charity_id,
        contribution_pct: String(contributionPct),
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
          charity_id,
          contribution_pct: String(contributionPct),
        },
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Stripe error" }, { status: 500 });
  }
}