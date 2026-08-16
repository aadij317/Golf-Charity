"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const notAuthorized = params.get("error") === "not_authorized";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // This is a shared login page for both admins and subscribers, so
    // route each to their own home rather than assuming admin — a
    // subscriber landing on /admin/users would just get bounced straight
    // back out by requireAdmin().
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user?.id)
      .single();

    router.push(profile?.role === "admin" ? "/admin/users" : "/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-sand">
          Digital Heroes
        </p>
        <h1 className="mb-8 font-display text-3xl italic text-paper">
          Admin sign in
        </h1>

        {notAuthorized && (
          <p className="mb-4 rounded-card border border-flag/40 bg-flag/10 px-3 py-2 text-sm text-flag-soft">
            That account isn&apos;t an admin. Sign in with an admin account.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
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
              placeholder="admin@digitalheroes.co.in"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full"
            />
          </div>

          {error && <p className="text-sm text-flag-soft">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
