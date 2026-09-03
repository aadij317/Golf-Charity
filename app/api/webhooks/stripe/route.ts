import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { sendSubscriptionConfirmedEmail } from "@/lib/email";
import type Stripe from "stripe";

type Plan = "monthly" | "yearly";

function mapSubscriptionStatus(status: string): "active" | "cancelled" | "lapsed" {
  if (status === "active" || status === "trialing") return "active";
  if (status === "canceled") return "cancelled";
  return "lapsed";
}

function validContributionPct(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 10 && number <= 100 ? number : 10;
}

/** Keep one canonical subscription row in sync with a Stripe subscription. */
async function upsertSubscriptionFromStripeSubscription(
  admin: ReturnType<typeof createAdminClient>,
  stripeSub: Stripe.Subscription,
  fallback?: { userId?: string; plan?: Plan; charityId?: string; contributionPct?: number }
) {
  const metadata = stripeSub.metadata ?? {};
  const userId = fallback?.userId ?? metadata.user_id;
  const plan = (fallback?.plan ?? metadata.plan) as Plan | undefined;
  const charityId = fallback?.charityId ?? metadata.charity_id ?? null;
  const contributionPct = validContributionPct(fallback?.contributionPct ?? metadata.contribution_pct);
  if (!userId || !plan) return null;

  const row = {
    user_id: userId,
    plan,
    status: mapSubscriptionStatus(stripeSub.status),
    stripe_customer_id: String(stripeSub.customer),
    stripe_subscription_id: stripeSub.id,
    current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
    charity_id: charityId || null,
    charity_contribution_pct: contributionPct,
  };

  const { data: existing, error: existingError } = await admin
    .from("subscriptions")
    .select("id, stripe_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw existingError;

  const write = existing
    ? await admin.from("subscriptions").update(row).eq("id", existing.id).select("*").single()
    : await admin.from("subscriptions").insert(row).select("*").single();
  if (write.error) throw write.error;
  return { subscription: write.data, existing };
}

/**
 * Stripe is the source of truth for money actually collected. Every paid
 * subscription invoice creates exactly one immutable charity ledger row.
 * `stripe_invoice_id` has a unique constraint, so webhook retries are safe.
 */
async function recordCharityContribution(
  admin: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice
) {
  const invoiceSubscription = (invoice as any).subscription;
  const stripeSubscriptionId = typeof invoiceSubscription === "string"
    ? invoiceSubscription
    : invoiceSubscription?.id;
  if (!stripeSubscriptionId || invoice.amount_paid <= 0) return;

  const { data: existingLedger } = await admin
    .from("subscription_charity_contributions")
    .select("id")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle();
  if (existingLedger) return;

  const { data: currentSubscription } = await admin
    .from("subscriptions")
    .select("id, user_id, charity_id, charity_contribution_pct")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  let userId: string | null = currentSubscription?.user_id ?? null;
  let charityId: string | null = currentSubscription?.charity_id ?? null;
  let contributionPct = currentSubscription ? Number(currentSubscription.charity_contribution_pct) : null;
  let subscriptionId: string | null = currentSubscription?.id ?? null;

  if (!currentSubscription) {
    // Do not overwrite the user's current subscription row just to account for
    // an older invoice. The one-row current-subscription schema intentionally
    // does not store history, so historical invoice attribution comes from the
    // immutable metadata on the Stripe subscription itself.
    const stripeSub = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
    if ("deleted" in stripeSub && stripeSub.deleted) return;
    const metadata = (stripeSub as Stripe.Subscription).metadata ?? {};
    userId = metadata.user_id || null;
    charityId = metadata.charity_id || null;
    contributionPct = validContributionPct(metadata.contribution_pct);
  }

  if (!userId || !charityId || contributionPct === null) return;

  // Use the paid invoice subtotal when available so tax is not represented as
  // subscription revenue donated to the charity. Fall back to amount_paid for
  // older/atypical Stripe invoice payloads.
  const grossCents = Number((invoice as any).amount_subtotal ?? invoice.amount_paid);
  if (grossCents <= 0) return;
  const contributionCents = Math.round(grossCents * contributionPct / 100);
  const { error } = await admin.from("subscription_charity_contributions").insert({
    user_id: userId,
    charity_id: charityId,
    subscription_id: subscriptionId,
    stripe_invoice_id: invoice.id,
    currency: (invoice.currency || "usd").toLowerCase(),
    gross_amount: Number((grossCents / 100).toFixed(2)),
    contribution_pct: contributionPct,
    amount: Number((contributionCents / 100).toFixed(2)),
  });
  if (error && error.code !== "23505") throw error;
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not set" }, { status: 500 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error: any) {
    return NextResponse.json({ error: `Invalid signature: ${error.message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan as Plan | undefined;
        const charityId = session.metadata?.charity_id;
        const contributionPct = validContributionPct(session.metadata?.contribution_pct);
        if (!userId || !plan || !session.subscription) break;

        const stripeSub = await getStripe().subscriptions.retrieve(session.subscription as string);
        if ("deleted" in stripeSub && stripeSub.deleted) break;
        const write = await upsertSubscriptionFromStripeSubscription(admin, stripeSub as Stripe.Subscription, {
          userId,
          plan,
          charityId,
          contributionPct,
        });

        // Release the checkout lock as soon as Stripe confirms completion.
        await admin.from("subscription_checkout_locks").delete().eq("user_id", userId);

        const shouldSendConfirmation = !!write && (!write.existing || write.existing.stripe_subscription_id !== stripeSub.id || write.existing.status !== write.subscription.status);
        if (shouldSendConfirmation) {
          const { data: profile } = await admin.from("profiles").select("email, full_name").eq("id", userId).single();
          let charityName: string | null = null;
          if (charityId) {
            const { data: charity } = await admin.from("charities").select("name").eq("id", charityId).maybeSingle();
            charityName = charity?.name ?? null;
          }
          if (profile?.email) {
            try { await sendSubscriptionConfirmedEmail(profile.email, profile.full_name, { plan, charityName }); }
            catch (emailError) { console.error("Subscription confirmation email failed:", emailError); }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const stripeSub = event.data.object as Stripe.Subscription;
        const { error } = await admin.from("subscriptions").update({
          status: mapSubscriptionStatus(stripeSub.status),
          current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
        }).eq("stripe_subscription_id", stripeSub.id);
        if (error) throw error;
        break;
      }

      case "customer.subscription.deleted": {
        const stripeSub = event.data.object as Stripe.Subscription;
        const { error } = await admin.from("subscriptions").update({ status: "cancelled" }).eq("stripe_subscription_id", stripeSub.id);
        if (error) throw error;
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await recordCharityContribution(admin, invoice);
        break;
      }

      default:
        break;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Webhook handling failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
