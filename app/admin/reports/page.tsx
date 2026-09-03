import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/admin/page-header";
import StatCard from "@/components/admin/stat-card";
import TierChart from "./tier-chart";

const money = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ReportsPage() {
  const supabase = createClient();
  const now = new Date().toISOString();

  const [
    { count: totalUsers },
    { count: activeSubs },
    { data: winners },
    { data: independentDonations },
    { data: subscriptionContributions },
    { data: draws },
    { count: simulationCount },
    { data: latestDraw },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active").or(`current_period_end.is.null,current_period_end.gt.${now}`),
    supabase.from("winners").select("tier, prize_amount, payment_status, verification_status"),
    supabase.from("donations").select("amount"),
    supabase.from("subscription_charity_contributions").select("amount"),
    supabase.from("draws").select("status"),
    supabase.from("draw_simulations").select("*", { count: "exact", head: true }).is("published_at", null).gt("expires_at", now),
    supabase.from("draws").select("jackpot_rollover_amount").eq("status", "published").order("month", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const eligibleWinners = (winners ?? []).filter((winner) => winner.verification_status !== "rejected");
  const totalPrizesPaid = eligibleWinners.filter((winner) => winner.payment_status === "paid").reduce((sum, winner) => sum + Number(winner.prize_amount), 0);
  const totalPrizesPending = eligibleWinners.filter((winner) => winner.payment_status !== "paid").reduce((sum, winner) => sum + Number(winner.prize_amount), 0);
  const totalPrizePoolAwarded = totalPrizesPaid + totalPrizesPending;

  const independentTotal = (independentDonations ?? []).reduce((sum, donation) => sum + Number(donation.amount), 0);
  const subscriptionContributionTotal = (subscriptionContributions ?? []).reduce((sum, contribution) => sum + Number(contribution.amount), 0);
  const totalCharityContributions = independentTotal + subscriptionContributionTotal;

  const drawsByStatus = { draft: 0, published: 0 };
  draws?.forEach((draw) => {
    if (draw.status in drawsByStatus) drawsByStatus[draw.status as keyof typeof drawsByStatus]++;
  });

  const tierCounts = { "5": 0, "4": 0, "3": 0 };
  eligibleWinners.forEach((winner) => {
    if (winner.tier in tierCounts) tierCounts[winner.tier as keyof typeof tierCounts]++;
  });
  const tierData = [
    { tier: "5-match", winners: tierCounts["5"] },
    { tier: "4-match", winners: tierCounts["4"] },
    { tier: "3-match", winners: tierCounts["3"] },
  ];
  const hasWinners = tierData.some((item) => item.winners > 0);

  return (
    <div>
      <PageHeader eyebrow="05 · Reports & analytics" title="Reports" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={String(totalUsers ?? 0)} sub={`${activeSubs ?? 0} active subscribers`} />
        <StatCard label="Prize pool awarded" value={money(totalPrizePoolAwarded)} sub={`${money(totalPrizesPaid)} paid · ${money(totalPrizesPending)} pending`} />
        <StatCard label="Charity contributions" value={money(totalCharityContributions)} sub={`${money(subscriptionContributionTotal)} from subscriptions · ${money(independentTotal)} direct`} />
        <StatCard label="Current jackpot rollover" value={money(Number(latestDraw?.jackpot_rollover_amount ?? 0))} sub="Latest published draw" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="panel p-5">
          <h2 className="mb-4 font-display text-lg italic text-ink">Winners by tier</h2>
          {hasWinners ? (
            <TierChart data={tierData} />
          ) : (
            <div className="grid h-[240px] place-items-center rounded-xl border border-dashed border-line bg-paper/35 p-8 text-center">
              <div><p className="font-display text-xl">No winners yet.</p><p className="mt-2 text-xs text-ink/50">The chart will populate when a published draw produces a winner claim.</p></div>
            </div>
          )}
        </div>

        <div className="panel p-5">
          <h2 className="mb-4 font-display text-lg italic text-ink">Draw statistics</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-ink/60">Published</dt><dd className="score-num text-ink">{drawsByStatus.published}</dd></div>
            <div className="flex justify-between"><dt className="text-ink/60">Active simulations</dt><dd className="score-num text-ink">{simulationCount ?? 0}</dd></div>
            <div className="flex justify-between"><dt className="text-ink/60">Draft</dt><dd className="score-num text-ink">{drawsByStatus.draft}</dd></div>
          </dl>
        </div>
      </div>

      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-ink/50">
        Charity contributions are now based on immutable paid-invoice ledger entries plus independent direct donations. A subscription percentage alone is never presented as money until Stripe confirms that the invoice was actually paid.
      </p>
    </div>
  );
}
