"use client";

import { useState } from "react";

/**
 * Small client-side control on an otherwise server-rendered charity card.
 * Calls /api/subscribe, then redirects the browser straight to the
 * Stripe Checkout URL it returns.
 */
export default function SubscribeControl({
  charityId,
  signedIn,
}: {
  charityId: string;
  signedIn: boolean;
}) {
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <a href="/login" className="btn-ghost mt-3 inline-flex text-xs">
        Sign in to subscribe
      </a>
    );
  }

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, charity_id: charityId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong");
      window.location.href = body.url;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <select
        value={plan}
        onChange={(e) => setPlan(e.target.value as "monthly" | "yearly")}
        className="input w-full text-xs"
      >
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
      </select>
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="btn-primary w-full text-xs"
      >
        {loading ? "Redirecting…" : "Subscribe"}
      </button>
      {error && <p className="text-xs text-flag-soft">{error}</p>}
    </div>
  );
}
