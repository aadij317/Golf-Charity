import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ScoreForm from "./score-form";
import ScoreRow from "./score-row";
import ProofUpload from "./proof-upload";
import SiteHeader from "@/components/site-header";
import BillingPortalButton from "./billing-portal-button";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { subscribed?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: subscription }, { data: scores }, { data: drawEntries }, { data: winnings }, { data: charityContributions }, { data: latestPublishedDraw }] = await Promise.all([
    supabase.from("profiles").select("full_name,email").eq("id", user.id).single(),
    supabase.from("subscriptions").select("plan,status,current_period_end,stripe_customer_id,charity_id,charity_contribution_pct,charities(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("scores").select("id,score,score_date").eq("user_id", user.id).order("score_date", { ascending: false }),
    supabase.from("draw_entries").select("id,matched_tier,draws(month,draw_type)").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("winners").select("id,tier,prize_amount,proof_url,verification_status,payment_status,draws(month)").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("subscription_charity_contributions").select("amount,charity_id").eq("user_id", user.id),
    supabase.from("draws").select("month").eq("status", "published").order("month", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const isActive =
    subscription?.status === "active" &&
    (!subscription.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now());
  const scoreCount = scores?.length ?? 0;
  const entryCount = drawEntries?.length ?? 0;
  const payableWinnings = (winnings ?? []).filter((w) => w.verification_status !== "rejected");
  const totalWon = payableWinnings.reduce((sum, w) => sum + Number(w.prize_amount), 0);
  const totalPaid = payableWinnings.filter((w) => w.payment_status === "paid").reduce((sum, w) => sum + Number(w.prize_amount), 0);
  const charityName = (subscription as any)?.charities?.name as string | undefined;
  const recordedCharityContributions = (charityContributions ?? []).filter((contribution: any) => contribution.charity_id === subscription?.charity_id).reduce((sum, contribution) => sum + Number(contribution.amount), 0);
  const nextDrawMonth = new Date();
  nextDrawMonth.setDate(1);
  nextDrawMonth.setHours(0, 0, 0, 0);
  if (latestPublishedDraw?.month) {
    const latestMonth = new Date(`${latestPublishedDraw.month}T00:00:00`);
    if (latestMonth >= nextDrawMonth) nextDrawMonth.setMonth(nextDrawMonth.getMonth() + 1, 1);
  }
  const nextDrawLabel = nextDrawMonth.toLocaleDateString(undefined, { year: "numeric", month: "long" });
  const renewalLabel = subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null;

  const justSubscribed = searchParams?.subscribed === "1";

  return <main><SiteHeader /><div className="page-wrap max-w-[1180px]">
    {justSubscribed && (
      <div className="mb-5 rounded-card border border-fairway/20 bg-fairway/5 px-5 py-4 text-sm text-fairway" role="status">
        <span className="font-semibold">Checkout complete.</span> Your subscription is being confirmed and your dashboard will reflect the latest status automatically.
      </div>
    )}
    <div className="flex flex-col gap-6 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow">Your member space</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">Welcome{profile?.full_name ? `, ${profile.full_name}` : " back"}.</h1><p className="mt-3 text-sm text-ink/55">Keep your latest five scores current, follow your draw participation, and see where your subscription is making an impact.</p></div>
      <div className="flex flex-wrap items-start gap-2"><Link href="/charities" className="btn-ghost px-4 py-2 text-xs">Explore charities</Link><Link href="/draws" className="btn-ghost px-4 py-2 text-xs">Draw archive</Link>{isActive && subscription?.stripe_customer_id && <BillingPortalButton />}</div>
    </div>

    <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="panel p-5"><p className="metric-label">Subscription</p><div className="mt-3 flex items-center justify-between gap-3"><p className="font-display text-2xl capitalize">{subscription?.plan ?? "Not active"}</p><span className={isActive ? "stamp-fairway" : subscription ? "stamp-flag" : "stamp-sand"}>{subscription?.status ?? "inactive"}</span></div><p className="mt-3 text-xs leading-5 text-ink/50">{renewalLabel ? `Next renewal · ${renewalLabel}` : "Choose a plan to unlock scores and draw entry."}</p></div>
      <div className="panel p-5"><p className="metric-label">Score record</p><div className="mt-3 flex items-end justify-between"><p className="metric-value">{scoreCount}<span className="ml-1 text-base text-ink/35">/ 5</span></p><span className="text-xs font-semibold text-fairway">Latest kept</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-fairway transition-all" style={{ width: `${Math.min(100, scoreCount * 20)}%` }} /></div></div>
      <div className="panel p-5"><p className="metric-label">Draw participation</p><p className="metric-value">{entryCount}</p><p className="mt-3 text-xs leading-5 text-ink/50">{isActive ? `Next expected draw · ${nextDrawLabel}` : "Reactivate your subscription to be eligible."}</p></div>
      <div className="panel p-5"><p className="metric-label">Winnings</p><p className="metric-value">${totalWon.toFixed(2)}</p><p className="mt-3 text-xs leading-5 text-ink/50">${totalPaid.toFixed(2)} paid · ${(totalWon-totalPaid).toFixed(2)} pending</p></div>
    </section>

    <section className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-line p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="eyebrow">Your latest scores</p><h2 className="mt-2 font-display text-3xl">Keep your five current.</h2><p className="mt-2 text-xs leading-5 text-ink/50">Scores are displayed newest first. Adding a sixth score automatically removes the oldest one.</p></div><span className="stamp-fairway">{scoreCount} of 5</span></div>
        <div className="p-6">
          {scores && scores.length > 0 ? <ul className="rounded-xl border border-line bg-paper/45 px-4">{scores.map((s) => <ScoreRow key={s.id} id={s.id} score={s.score} scoreDate={s.score_date} disabled={!isActive} />)}</ul> : <div className="rounded-xl border border-dashed border-line bg-paper/40 p-8 text-center"><p className="font-display text-xl">No scores yet.</p><p className="mt-2 text-xs text-ink/50">Your next score will start your rolling record.</p></div>}
          <ScoreForm disabled={!isActive} />
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-card border border-fairway/10 bg-fairway p-6 text-white"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-white/55">Your chosen cause</p><h2 className="mt-3 font-display text-3xl">{charityName ?? "Choose a charity"}</h2>{subscription ? <><p className="mt-3 text-sm leading-6 text-white/70">{subscription.charity_contribution_pct}% of each paid subscription invoice is allocated to this cause.</p><div className="mt-5 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2"><div className="flex items-center justify-between gap-3"><span className="text-xs text-white/55">Contribution setting</span><span className="font-mono text-lg">{subscription.charity_contribution_pct}%</span></div><div className="flex items-center justify-between gap-3"><span className="text-xs text-white/55">Recorded impact</span><span className="font-mono text-lg">${recordedCharityContributions.toFixed(2)}</span></div></div></> : <><p className="mt-3 text-sm leading-6 text-white/70">Pick a cause as part of your subscription setup.</p><Link href="/charities" className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-fairway">Choose a charity →</Link></>}</div>
        <div className="panel p-6"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Participation</p><h2 className="mt-2 font-display text-2xl">Your draw history</h2></div><span className="number-chip">{entryCount}</span></div><p className="mt-3 text-xs text-ink/50">{isActive ? `You have an active subscription. Next monthly draw: ${nextDrawLabel}.` : "No active subscription means new draw participation is paused."}</p>{drawEntries?.length ? <ul className="mt-5 divide-y divide-line">{drawEntries.slice(0,4).map((e:any)=><li key={e.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{e.draws?.month ? new Date(e.draws.month + "T00:00:00").toLocaleDateString(undefined,{year:"numeric",month:"short"}) : "Published draw"}</p><p className="mt-1 text-[10px] text-ink/45">{e.draws?.draw_type ?? "Monthly"} draw</p></div><span className={e.matched_tier ? "stamp-fairway" : "stamp-sand"}>{e.matched_tier ? `${e.matched_tier}-match` : "No match"}</span></li>)}</ul> : <p className="mt-5 rounded-xl bg-paper p-4 text-xs text-ink/50">Your published draw participation will appear here.</p>}</div>
      </div>
    </section>

    <section className="mt-5 panel p-6 sm:p-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Winnings & verification</p><h2 className="mt-2 font-display text-3xl">Keep track of every reward.</h2></div><span className="score-num text-ink/50">${totalWon.toFixed(2)} total awarded</span></div>{winnings?.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{winnings.map((w:any)=><article key={w.id} className="rounded-xl border border-line bg-paper/45 p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">{w.tier}-number match</p><p className="mt-1 text-xs text-ink/45">{w.draws?.month ? new Date(w.draws.month + "T00:00:00").toLocaleDateString(undefined,{year:"numeric",month:"long"}) : "Monthly draw"}</p></div><p className="font-display text-2xl">${Number(w.prize_amount).toFixed(2)}</p></div><div className="mt-4 flex flex-wrap gap-2"><span className={w.verification_status === "approved" ? "stamp-fairway" : w.verification_status === "rejected" ? "stamp-flag" : "stamp-sand"}>{w.verification_status}</span><span className={w.payment_status === "paid" ? "stamp-fairway" : "stamp-sand"}>{w.payment_status}</span></div><ProofUpload winnerId={w.id} userId={user.id} hasExistingProof={!!w.proof_url} verificationStatus={w.verification_status} /></article>)}</div> : <div className="mt-6 rounded-xl border border-dashed border-line bg-paper/40 p-8 text-center"><p className="font-display text-xl">No winnings yet.</p><p className="mt-2 text-xs text-ink/50">When you match a published draw tier, your prize and verification status will live here.</p></div>}</section>
  </div></main>;
}
