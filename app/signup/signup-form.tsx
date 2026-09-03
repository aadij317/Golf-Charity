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
  const [confirmationRequired, setConfirmationRequired] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // When Supabase email confirmation is enabled, signUp succeeds without a
    // browser session. Sending that user to /subscribe would immediately
    // bounce them to /login, so show an explicit confirmation state instead.
    if (!data.session) {
      setConfirmationRequired(true);
      setLoading(false);
      return;
    }

    // Best-effort only; a welcome-email provider failure must never block the
    // account and subscription journey.
    fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});
    router.push("/subscribe");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-paper p-4 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-card border border-line bg-white shadow-soft lg:grid-cols-[220px_1fr]">
        <aside className="hidden border-r border-line bg-paper/70 p-7 lg:block">
          <div className="flex items-center gap-2 font-semibold"><span className="grid h-8 w-8 place-items-center rounded-full bg-fairway/10 text-fairway">◒</span>Golf Charity</div>
          <div className="mt-16 space-y-8 text-xs text-ink/45"><p className="font-semibold text-fairway">1 &nbsp; Create Account</p><p>2 &nbsp; Choose Charity</p><p>3 &nbsp; Set Contribution</p><p>4 &nbsp; Subscribe</p></div>
        </aside>
        <div className="flex items-center justify-center p-7 sm:p-12">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="w-full max-w-lg">
            {confirmationRequired ? (
              <div className="rounded-card border border-fairway/15 bg-fairway/5 p-7">
                <p className="eyebrow">One last step</p>
                <h1 className="mt-3 font-display text-4xl">Check your email.</h1>
                <p className="mt-4 text-sm leading-7 text-ink/60">We&apos;ve created your account and sent a confirmation link to <span className="font-semibold text-ink">{email}</span>. Confirm your email, then sign in to choose your charity and subscription.</p>
                <a href="/login" className="btn-primary mt-7">Go to sign in →</a>
              </div>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between text-xs text-ink/45"><span>Step 1 of 4</span><span>Already have an account? <a href="/login" className="font-semibold text-fairway">Sign in</a></span></div>
                <h1 className="font-display text-4xl">Create Your Account</h1>
                <p className="mb-8 mt-2 text-sm text-ink/50">Join Golf Charity and make an impact.</p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div><label htmlFor="fullName" className="mb-1 block text-xs text-ink/55">Full name</label><input id="fullName" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input w-full" placeholder="Jordan Rivera" /></div>
                  <div><label htmlFor="email" className="mb-1 block text-xs text-ink/55">Email</label><input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" placeholder="you@example.com" /></div>
                  <div><label htmlFor="password" className="mb-1 block text-xs text-ink/55">Password</label><input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input w-full" /></div>
                  {error && <p className="text-sm text-flag">{error}</p>}
                  <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Creating account…" : "Create account"}</button>
                </form>
                <p className="mt-6 text-xs text-ink/45">Already have an account? <a href="/login" className="text-fairway underline underline-offset-2">Sign in</a></p>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </main>
  );
}
