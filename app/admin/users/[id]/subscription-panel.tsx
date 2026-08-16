"use client";

import { useState, useTransition } from "react";
import { overrideSubscription } from "./actions";

type Subscription = {
  id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  charity_contribution_pct: number;
} | null;

export default function SubscriptionPanel({
  userId,
  subscription,
}: {
  userId: string;
  subscription: Subscription;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(formData: FormData) {
    setSaved(false);
    startTransition(async () => {
      const res = await overrideSubscription(userId, subscription?.id ?? null, formData);
      if (res.error) setError(res.error);
      else {
        setError(null);
        setSaved(true);
      }
    });
  }

  return (
    <div className="panel space-y-4 p-5">
      <h2 className="font-display text-lg italic text-paper">Subscription</h2>

      {subscription ? (
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-paper/50">Renews / ended</dt>
          <dd className="score-num text-paper">
            {subscription.current_period_end
              ? new Date(subscription.current_period_end).toLocaleDateString()
              : "—"}
          </dd>
          <dt className="text-paper/50">Charity share</dt>
          <dd className="score-num text-paper">{subscription.charity_contribution_pct}%</dd>
        </dl>
      ) : (
        <p className="text-sm text-paper/40">
          No subscription row yet — this creates one manually (e.g. a comped account).
        </p>
      )}

      <form action={handleSubmit} className="space-y-3 border-t border-ink-line pt-4">
        <p className="text-xs text-paper/50">
          Manual override — for edge cases only. Normal renewals/cancellations flow through
          the Stripe webhook.
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-paper/60">Plan</label>
            <select name="plan" defaultValue={subscription?.plan ?? "monthly"} className="input w-full">
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-paper/60">Status</label>
            <select name="status" defaultValue={subscription?.status ?? "active"} className="input w-full">
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="lapsed">Lapsed</option>
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-flag-soft">{error}</p>}
        {saved && !error && <p className="text-sm text-fairway-soft">Saved.</p>}

        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Saving…" : subscription ? "Update subscription" : "Create subscription"}
        </button>
      </form>
    </div>
  );
}
