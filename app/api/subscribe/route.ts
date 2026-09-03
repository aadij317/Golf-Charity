import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { createHash } from "crypto";

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

  // One current subscription record is enforced at the database level. Do not
  // create another Stripe Checkout session while the existing membership is
  // already active; otherwise a user can accidentally create duplicate paid
  // subscriptions by clicking Subscribe twice or revisiting the page.
  const { data: currentSubscription, error: currentSubscriptionError } = await admin
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (currentSubscriptionError && currentSubscriptionError.code !== "PGRST116") {
    return NextResponse.json({ error: currentSubscriptionError.message }, { status: 500 });
  }

  const currentSubscriptionIsLive =
    currentSubscription?.status === "active" &&
    (!currentSubscription.current_period_end || new Date(currentSubscription.current_period_end).getTime() > Date.now());

  if (currentSubscriptionIsLive) {
    return NextResponse.json(
      { error: "You already have an active subscription. Manage your membership from your dashboard." },
      { status: 409 }
    );
  }

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

  // Prevent concurrent checkout sessions for the same user. The unique user_id
  // lock closes the race where two different Subscribe clicks could create two
  // Stripe subscriptions before the first webhook writes the subscription row.
  const checkoutWindowMs = 10 * 60 * 1000;
  const idempotencyWindow = Math.floor(Date.now() / checkoutWindowMs);
  // Keep expires_at deterministic within the same idempotency window. Stripe
  // requires repeated requests using one idempotency key to have identical
  // parameters; this also guarantees at least 40 minutes before expiry.
  const lockExpiresAt = new Date((idempotencyWindow + 5) * checkoutWindowMs);
  const { data: existingLock, error: existingLockError } = await admin
    .from("subscription_checkout_locks")
    .select("stripe_session_id, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingLockError) return NextResponse.json({ error: existingLockError.message }, { status: 500 });

  if (existingLock) {
    const expired = new Date(existingLock.expires_at).getTime() <= Date.now();
    if (!expired) {
      return NextResponse.json({ error: "A checkout session is already in progress. Finish it or wait for it to expire before trying again." }, { status: 409 });
    }

    // If a paid Checkout session completed near the lock expiry, keep the lock
    // until its webhook syncs the subscription rather than risking a second
    // paid membership during webhook delivery delay.
    if (existingLock.stripe_session_id) {
      try {
        const existingSession = await getStripe().checkout.sessions.retrieve(existingLock.stripe_session_id);
        if (existingSession.status === "complete" || existingSession.payment_status === "paid") {
          return NextResponse.json({ error: "Your checkout completed and is still being confirmed. Refresh your dashboard shortly instead of starting another subscription." }, { status: 409 });
        }
      } catch (sessionLookupError) {
        return NextResponse.json({ error: "Could not verify the previous checkout session. Please try again in a few minutes." }, { status: 409 });
      }
    }

    const { error: deleteExpiredLockError } = await admin.from("subscription_checkout_locks").delete().eq("user_id", user.id);
    if (deleteExpiredLockError) return NextResponse.json({ error: deleteExpiredLockError.message }, { status: 500 });
  }

  const { error: lockError } = await admin
    .from("subscription_checkout_locks")
    .insert({ user_id: user.id, expires_at: lockExpiresAt.toISOString() });
  if (lockError) {
    if (lockError.code === "23505") {
      return NextResponse.json({ error: "A checkout session is already in progress. Finish it or wait for it to expire before trying again." }, { status: 409 });
    }
    return NextResponse.json({ error: lockError.message }, { status: 500 });
  }

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

    // Stripe's idempotency layer prevents a double-click or network retry
    // from creating two Checkout sessions for the same subscription choice.
    // Use a short time bucket: repeated clicks share one session, while a
    // genuinely abandoned/expired checkout can be retried shortly after.
    const idempotencyKey = createHash("sha256")
      .update(`${user.id}:${plan}:${charity_id}:${contributionPct}:${idempotencyWindow}`)
      .digest("hex");

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
      expires_at: Math.floor(lockExpiresAt.getTime() / 1000),
    }, { idempotencyKey });

    const { error: lockUpdateError } = await admin
      .from("subscription_checkout_locks")
      .update({ stripe_session_id: session.id, expires_at: lockExpiresAt.toISOString() })
      .eq("user_id", user.id);
    if (lockUpdateError) throw new Error(lockUpdateError.message);

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e: any) {
    await admin.from("subscription_checkout_locks").delete().eq("user_id", user.id);
    return NextResponse.json({ error: e.message ?? "Stripe error" }, { status: 500 });
  }
}