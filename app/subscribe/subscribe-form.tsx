"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";

type Charity = {
  id: string;
  name: string;
  description: string | null;
  is_featured: boolean;
};

const PLANS = [
  { id: "monthly" as const, label: "Monthly", detail: "Billed every month" },
  { id: "yearly" as const, label: "Yearly", detail: "Billed once a year" },
];

export default function SubscribeForm({
  charities,
  initialCharityId,
}: {
  charities: Charity[];
  initialCharityId?: string;
}) {
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");
  const [charityId, setCharityId] = useState<string | null>(
    // Prefer a charity passed in via ?charity=<id> (e.g. from a charity
    // detail page's CTA) if it's actually one of the charities we have;
    // fall back to the first one so the form never opens with nothing
    // selected.
    (initialCharityId &&
      charities.some((c) => c.id === initialCharityId) &&
      initialCharityId) ||
      charities[0]?.id ||
      null
  );
  const [contributionPct, setContributionPct] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!charityId) {
      setError("Pick a charity to continue.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // /api/subscribe only reads `plan` and `charity_id` today (see
        // app/api/subscribe/route.ts) — contribution_pct is sent for
        // forward compatibility but the backend currently ignores it and
        // the subscription row is created by the Stripe webhook at the
        // schema default of 10%, not this value. Flagged in the build
        // summary; not fixed here since that route is out of this
        // workstream's scope.
        body: JSON.stringify({
          plan,
          charity_id: charityId,
          contribution_pct: contributionPct,
        }),
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
    <main className="mx-auto max-w-3xl px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <p className="font-mono text-xs uppercase tracking-widest text-sand">
          Digital Heroes
        </p>
        <h1 className="mt-2 font-display text-3xl italic text-paper">
          Set up your subscription
        </h1>
        <p className="mt-3 max-w-xl text-paper/70">
          Choose a plan, pick the charity you want to support, and set how
          much of your subscription goes to them.
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="mt-10 space-y-10">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05, ease: "easeOut" }}
        >
          <h2 className="font-display text-lg italic text-paper">Plan</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {PLANS.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setPlan(p.id)}
                className={clsx(
                  "panel p-5 text-left transition",
                  plan === p.id
                    ? "border-sand"
                    : "hover:border-paper/30"
                )}
              >
                <p className="font-display text-base italic text-paper">
                  {p.label}
                </p>
                <p className="mt-1 text-sm text-paper/60">{p.detail}</p>
              </button>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
        >
          <h2 className="font-display text-lg italic text-paper">Charity</h2>
          {charities.length === 0 ? (
            <p className="mt-3 text-sm text-paper/50">
              No charities are listed yet — check back soon.
            </p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {charities.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCharityId(c.id)}
                  className={clsx(
                    "panel space-y-2 p-5 text-left transition",
                    charityId === c.id ? "border-sand" : "hover:border-paper/30"
                  )}
                >
                  {c.is_featured && <span className="stamp-sand">Featured</span>}
                  <p className="font-display text-base italic text-paper">
                    {c.name}
                  </p>
                  {c.description && (
                    <p className="line-clamp-2 text-sm text-paper/60">
                      {c.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
        >
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg italic text-paper">
              Contribution
            </h2>
            <span className="score-num text-paper">{contributionPct}%</span>
          </div>
          <p className="mt-1 text-sm text-paper/60">
            Share of your subscription fee that goes to your chosen charity.
            10% minimum.
          </p>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={contributionPct}
            onChange={(e) => setContributionPct(Number(e.target.value))}
            className="mt-4 w-full accent-sand"
          />
        </motion.section>

        {error && <p className="text-sm text-flag-soft">{error}</p>}

        <button
          type="submit"
          disabled={loading || !charityId || charities.length === 0}
          className="btn-primary w-full sm:w-auto"
        >
          {loading ? "Redirecting…" : "Continue to checkout"}
        </button>
      </form>
    </main>
  );
}
