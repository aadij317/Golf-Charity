"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

export default function SignupForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // full_name is passed via auth metadata, not a separate insert — the
    // public.handle_new_user trigger (0001_init_schema.sql) reads
    // raw_user_meta_data ->> 'full_name' and creates the profiles row
    // itself, role defaulting to 'subscriber'. Inserting into profiles
    // here directly would race that trigger and risk a duplicate-key
    // error, so this signup flow relies entirely on it.
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Fire-and-forget: a welcome email failing (or a provider not being
    // configured yet) should never block getting the new subscriber to
    // /subscribe.
    fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});

    // New subscribers aren't on a plan yet — send them to pick one rather
    // than /dashboard, which would just show an empty "no subscription"
    // state they'd have to click through anyway.
    router.push("/subscribe");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-sand">
          Digital Heroes
        </p>
        <h1 className="mb-8 font-display text-3xl italic text-paper">
          Create your account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="fullName" className="mb-1 block text-xs text-paper/60">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input w-full"
              placeholder="Jordan Rivera"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-xs text-paper/60">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs text-paper/60">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full"
            />
          </div>

          {error && <p className="text-sm text-flag-soft">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-xs text-paper/50">
          Already have an account?{" "}
          <a href="/login" className="text-sand underline underline-offset-2">
            Sign in
          </a>
        </p>
      </motion.div>
    </main>
  );
}
