import Stripe from "stripe";

// Single shared Stripe client, server-side only. Throws at call time
// (not at import time) if the key is missing, so the rest of the app
// doesn't crash on boot before Stripe env vars are filled in — the
// relevant route will just 500 with a clear message until they are.
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (see README \u201cEnv Vars\u201d)."
    );
  }
  return new Stripe(key, { apiVersion: "2024-06-20" });
}
