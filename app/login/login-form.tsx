"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const notAuthorized = params.get("error") === "not_authorized";
  const nextParam = params.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;

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

    router.push(profile?.role === "admin" ? "/admin/users" : safeNext || "/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-paper p-4 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-card border border-line bg-white shadow-soft lg:grid-cols-[1fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-fairway p-10 text-white lg:block" style={{backgroundImage:"linear-gradient(rgba(12,52,38,.42),rgba(12,52,38,.78)),url(\'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?auto=format&fit=crop&w=1200&q=85\')",backgroundSize:"cover",backgroundPosition:"center"}}><div className="absolute inset-0 bg-gradient-to-t from-[#0b2e22]/80 via-transparent"/><div className="relative flex h-full flex-col justify-end"><p className="eyebrow text-white/65">Welcome back</p><h1 className="mt-3 max-w-md font-display text-5xl leading-tight">Sign in to<br/>Golf Charity</h1><p className="mt-4 max-w-sm text-sm leading-6 text-white/70">Manage your scores, track your impact, and stay entered in every draw.</p><div className="mt-8 space-y-4 text-sm"><p>◌ &nbsp; Track your scores</p><p>⌘ &nbsp; Support charities</p><p>♧ &nbsp; Win exciting prizes</p></div></div></section>
        <div className="flex items-center justify-center p-7 sm:p-12"><div className="w-full max-w-sm">
        <div className="mb-10 flex items-center gap-2 font-semibold"><span className="grid h-8 w-8 place-items-center rounded-full bg-fairway/10 text-fairway">◒</span> Golf Charity</div><h1 className="font-display text-4xl">Sign In</h1><p className="mt-2 mb-8 text-sm text-ink/50">Enter your email and password to continue.</p>

        {notAuthorized && (
          <p className="mb-4 rounded-card border border-flag/40 bg-flag/10 px-3 py-2 text-sm text-flag">
            That account isn&apos;t an admin. Sign in with an admin account.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs text-ink/55">
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
            <label htmlFor="password" className="mb-1 block text-xs text-ink/55">
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

          {error && <p className="text-sm text-flag">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div></div></div>
    </main>
  );
}
