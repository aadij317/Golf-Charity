import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { sendSubscriptionConfirmedEmail } from "@/lib/email";
import type Stripe from "stripe";

/**
 * POST /api/webhooks/stripe
 *
 * Stripe calls this directly (not the browser), so there's no user
 * session/cookie here — trust is established purely via the webhook
 * signature check below using STRIPE_WEBHOOK_SECRET. Uses the
 * service-role client throughout since there's no auth.uid() to scope
 * RLS against.
 *
 * Handles the events that matter for keeping `subscriptions` accurate:
 *  - checkout.session.completed      -> create/activate the subscription row
 *  - customer.subscription.updated   -> keep status/period_end in sync
 *  - customer.subscription.deleted   -> mark as cancelled
 *
 * Register this URL in the Stripe Dashboard (Developers -> Webhooks)
 * pointing at {your deployed domain}/api/webhooks/stripe, and put the
 * signing secret it gives you into STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not set" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // Stripe signature verification needs the raw, unparsed body.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e: any) {
    return NextResponse.json({ error: `Invalid signature: ${e.message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan as "monthly" | "yearly" | undefined;
        const charityId = session.metadata?.charity_id;
        const contributionPct = session.metadata?.contribution_pct
          ? Number(session.metadata.contribution_pct)
          : 10;

        if (!userId || !plan) break; // not one of our sessions, ignore

        const stripe = getStripe();
        const stripeSub = session.subscription
          ? await stripe.subscriptions.retrieve(session.subscription as string)
          : null;

        await admin.from("subscriptions").upsert(
          {
            user_id: userId,
            plan,
            status: "active",
            stripe_customer_id: (session.customer as string) ?? null,
            stripe_subscription_id: (session.subscription as string) ?? null,
            current_period_end: stripeSub
              ? new Date(stripeSub.current_period_end * 1000).toISOString()
              : null,
            charity_id: charityId ?? null,
            charity_contribution_pct: contributionPct,
          },
          { onConflict: "stripe_subscription_id" }
        );

        // System update email (PRD §13) — confirms the subscription is live.
        const { data: profile } = await admin
          .from("profiles")
          .select("email, full_name")
          .eq("id", userId)
          .single();
        let charityName: string | null = null;
        if (charityId) {
          const { data: charity } = await admin
            .from("charities")
            .select("name")
            .eq("id", charityId)
            .maybeSingle();
          charityName = charity?.name ?? null;
        }
        if (profile?.email) {
          await sendSubscriptionConfirmedEmail(profile.email, profile.full_name, {
            plan,
            charityName,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status =
          sub.status === "active"
            ? "active"
            : sub.status === "canceled"
            ? "cancelled"
            : "lapsed";

        await admin
          .from("subscriptions")
          .update({
            status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", sub.id);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await admin
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("stripe_subscription_id", sub.id);
        break;
      }

      default:
        // Unhandled event types are fine to ignore — Stripe sends many
        // more than we care about here.
        break;
    }
  } catch (e: any) {
    // Return 500 so Stripe retries; log-worthy but not this workstream's
    // logging setup to build out.
    return NextResponse.json({ error: e.message ?? "Webhook handling failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}