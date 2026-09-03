import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/admin/page-header";
import StatCard from "@/components/admin/stat-card";
import TierChart from "./tier-chart";

export default async function ReportsPage() {
  const supabase = createClient();

  const [
    { count: totalUsers },
    { count: activeSubs },
    { data: winners },
    { data: donations },
    { data: draws },
    { data: latestDraw },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("winners").select("tier, prize_amount, payment_status"),
    supabase.from("donations").select("amount"),
    supabase.from("draws").select("status"),
    supabase
      .from("draws")
      .select("jackpot_rollover_amount")
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const totalPrizesPaid =
    winners?.filter((w) => w.payment_status === "paid").reduce((sum, w) => sum + Number(w.prize_amount), 0) ?? 0;
  const totalPrizesPending =
    winners?.filter((w) => w.payment_status === "pending").reduce((sum, w) => sum + Number(w.prize_amount), 0) ?? 0;
  const totalDonations = donations?.reduce((sum, d) => sum + Number(d.amount), 0) ?? 0;
  const totalPrizePoolAwarded = totalPrizesPaid + totalPrizesPending;

  const drawsByStatus = { draft: 0, simulated: 0, published: 0 };
  draws?.forEach((d) => {
    if (d.status in drawsByStatus) drawsByStatus[d.status as keyof typeof drawsByStatus]++;
  });

  const tierCounts = { "5": 0, "4": 0, "3": 0 };
  winners?.forEach((w) => {
    if (w.tier in tierCounts) tierCounts[w.tier as keyof typeof tierCounts]++;
  });
  const tierData = [
    { tier: "5-match", winners: tierCounts["5"] },
    { tier: "4-match", winners: tierCounts["4"] },
    { tier: "3-match", winners: tierCounts["3"] },
  ];

  return (
    <div>
      <PageHeader eyebrow="05 · Reports & analytics" title="Reports" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={String(totalUsers ?? 0)} sub={`${activeSubs ?? 0} active subscribers`} />
        <StatCard
          label="Prize pool awarded"
          value={`$${totalPrizePoolAwarded.toLocaleString()}`}
          sub={`$${totalPrizesPaid.toLocaleString()} paid · $${totalPrizesPending.toLocaleString()} pending`}
        />
        <StatCard
          label="Charity contributions"
          value={`$${totalDonations.toLocaleString()}`}
          sub="Independent donations only — see note below"
        />
        <StatCard
          label="Current jackpot rollover"
          value={`$${Number(latestDraw?.jackpot_rollover_amount ?? 0).toLocaleString()}`}
          sub="Most recent month on record"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="panel p-5">
          <h2 className="mb-4 font-display text-lg italic text-ink">Winners by tier</h2>
          <TierChart data={tierData} />
        </div>

        <div className="panel p-5">
          <h2 className="mb-4 font-display text-lg italic text-ink">Draw statistics</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/60">Published</dt>
              <dd className="score-num text-ink">{drawsByStatus.published}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/60">Simulated</dt>
              <dd className="score-num text-ink">{drawsByStatus.simulated}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/60">Draft</dt>
              <dd className="score-num text-ink">{drawsByStatus.draft}</dd>
            </div>
          </dl>
        </div>
      </div>

      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-ink/40">
        Note: &ldquo;Charity contributions&rdquo; above totals the independent{" "}
        <code className="font-mono">donations</code> table only. The per-subscription charity
        share (min. 10% of the fee, per PRD §08) isn&apos;t written to its own ledger row
        anywhere in the locked schema — it&apos;s a percentage on the{" "}
        <code className="font-mono">subscriptions</code> row, not a transaction — so it isn&apos;t
        summed into this figure. Wiring that up would mean either the Stripe webhook
        (backend workstream) writing a donation-equivalent row per billing cycle, or this
        report estimating it as{" "}
        <code className="font-mono">active_subscribers × fee × avg(charity_contribution_pct)</code>{" "}
        — flagged rather than silently estimated, since an estimate presented as a real total
        would be misleading in a finance report.
      </p>
    </div>
  );
}
