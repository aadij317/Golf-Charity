import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ScoreForm from "./score-form";
import ScoreRow from "./score-row";
import ProofUpload from "./proof-upload";

/**
 * Subscriber dashboard. Any signed-in user can land here (admins get
 * redirected to /admin/users at login instead, but nothing stops an
 * admin from visiting this page directly — that's fine, RLS still scopes
 * every query below to auth.uid() = the signed-in user's own rows).
 *
 * Covers every PRD §10 module:
 *   - Subscription status
 *   - Score entry / edit / delete
 *   - Selected charity + contribution %
 *   - Participation summary (draws entered, upcoming draw)
 *   - Winnings overview (total won, payment status, proof upload)
 */
export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, charity_contribution_pct, charities(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isActive = subscription?.status === "active";

  const { data: scores } = await supabase
    .from("scores")
    .select("id, score, score_date")
    .eq("user_id", user.id)
    .order("score_date", { ascending: false });

  // --- Participation summary (PRD §10) ---
  const { data: drawEntries } = await supabase
    .from("draw_entries")
    .select("id, matched_tier, draws(month, draw_type)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const today = new Date();
  const nextDrawMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextDrawLabel = nextDrawMonth.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  // --- Winnings overview (PRD §10) ---
  const { data: winnings } = await supabase
    .from("winners")
    .select("id, tier, prize_amount, proof_url, verification_status, payment_status, draws(month)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const totalWon = (winnings ?? []).reduce((sum, w) => sum + Number(w.prize_amount), 0);
  const totalPaid = (winnings ?? [])
    .filter((w) => w.payment_status === "paid")
    .reduce((sum, w) => sum + Number(w.prize_amount), 0);

  const charityName = (subscription as any)?.charities?.name as string | undefined;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-sand">Digital Heroes</p>
      <h1 className="mt-2 font-display text-3xl italic text-paper">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
      </h1>
      <p className="mt-2 text-sm text-paper/60">{profile?.email}</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="panel space-y-2 p-5">
          <h2 className="font-display text-base italic text-paper">Subscription</h2>
          {subscription ? (
            <>
              <p className="text-sm text-paper/80">
                {subscription.plan} ·{" "}
                <span className={isActive ? "stamp-fairway" : "stamp-flag"}>
                  {subscription.status}
                </span>
              </p>
              {charityName && (
                <p className="text-sm text-paper/60">
                  Supporting <span className="text-paper">{charityName}</span> (
                  {subscription.charity_contribution_pct}% of fee)
                </p>
              )}
              {subscription.current_period_end && (
                <p className="text-xs text-paper/40">
                  Renews {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
              {!isActive && (
                <>
                  <p className="text-xs text-flag-soft">
                    Score entry and draw participation are paused while your subscription is{" "}
                    {subscription.status}.
                  </p>
                  <Link href="/subscribe" className="btn-primary mt-2 inline-flex text-xs">
                    Reactivate subscription
                  </Link>
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-paper/60">No active subscription yet.</p>
              <Link href="/charities" className="btn-primary mt-2 inline-flex text-xs">
                Choose a charity to get started
              </Link>
            </>
          )}
        </div>

        <div className="panel space-y-2 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base italic text-paper">Scores</h2>
            <span className="score-num text-paper/50">{scores?.length ?? 0} / 5 kept</span>
          </div>
          {scores && scores.length > 0 ? (
            <ul>
              {scores.map((s) => (
                <ScoreRow
                  key={s.id}
                  id={s.id}
                  score={s.score}
                  scoreDate={s.score_date}
                  disabled={!isActive}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-paper/60">No scores submitted yet.</p>
          )}
          <ScoreForm disabled={!isActive} />
        </div>

        <div className="panel space-y-2 p-5">
          <h2 className="font-display text-base italic text-paper">Participation</h2>
          <p className="text-sm text-paper/60">
            Next draw: <span className="text-paper">{nextDrawLabel}</span>
            {isActive ? " — you're entered automatically." : " — reactivate your subscription to enter."}
          </p>
          {drawEntries && drawEntries.length > 0 ? (
            <ul className="mt-2">
              {drawEntries.map((e: any) => (
                <li key={e.id} className="score-row flex items-center justify-between py-2">
                  <span className="text-sm text-paper/80">
                    {e.draws?.month
                      ? new Date(e.draws.month).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                        })
                      : "—"}{" "}
                    · {e.draws?.draw_type}
                  </span>
                  <span className={e.matched_tier ? "stamp-fairway" : "text-xs text-paper/40"}>
                    {e.matched_tier ? `${e.matched_tier}-match` : "No match"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-paper/60">You haven't been entered into a draw yet.</p>
          )}
        </div>

        <div className="panel space-y-2 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base italic text-paper">Winnings</h2>
            <span className="score-num text-paper">${totalWon.toFixed(2)}</span>
          </div>
          <p className="text-xs text-paper/50">
            ${totalPaid.toFixed(2)} paid out · ${(totalWon - totalPaid).toFixed(2)} pending
          </p>
          {winnings && winnings.length > 0 ? (
            <ul className="mt-2 space-y-3">
              {winnings.map((w: any) => (
                <li key={w.id} className="score-row py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-paper/80">
                      {w.tier}-match ·{" "}
                      {w.draws?.month
                        ? new Date(w.draws.month).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </span>
                    <span className="score-num text-paper">${Number(w.prize_amount).toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={
                        w.verification_status === "approved"
                          ? "stamp-fairway"
                          : w.verification_status === "rejected"
                          ? "stamp-flag"
                          : "stamp-sand"
                      }
                    >
                      {w.verification_status}
                    </span>
                    <span className={w.payment_status === "paid" ? "stamp-fairway" : "stamp-sand"}>
                      {w.payment_status}
                    </span>
                  </div>
                  <ProofUpload
                    winnerId={w.id}
                    userId={user.id}
                    hasExistingProof={!!w.proof_url}
                    verificationStatus={w.verification_status}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-paper/60">No winnings yet — good luck next draw.</p>
          )}
        </div>
      </div>
    </div>
  );
}
