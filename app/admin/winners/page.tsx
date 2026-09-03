import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/admin/page-header";
import WinnerRow from "./winner-row";

export default async function WinnersPage({
  searchParams,
}: {
  searchParams: { verification?: string };
}) {
  const supabase = createClient();
  const filter = searchParams.verification;

  let query = supabase
    .from("winners")
    .select(
      "id, tier, prize_amount, proof_url, verification_status, payment_status, profiles(full_name, email), draws(month, draw_type)"
    )
    .order("created_at", { ascending: false });

  if (filter && filter !== "all") {
    query = query.eq("verification_status", filter);
  }

  const { data: winners, error } = await query;

  // proof_url is a private-bucket storage path (see
  // supabase/migrations/0003_storage_winner_proofs.sql), not a public
  // URL — resolve a short-lived signed URL for display here rather than
  // in the client row, since the admin session (is_admin() RLS) is what
  // grants read access to every subscriber's proof, not just the caller's own.
  const winnersWithSignedUrls = await Promise.all(
    ((winners as any[]) ?? []).map(async (w) => {
      if (!w.proof_url) return w;
      const { data: signed } = await supabase.storage
        .from("winner-proofs")
        .createSignedUrl(w.proof_url, 3600);
      return { ...w, signed_proof_url: signed?.signedUrl ?? null };
    })
  );

  const filters = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending review" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  const emptyLabel = filter && filter !== "all"
    ? `No ${filters.find((item) => item.key === filter)?.label.toLowerCase() ?? filter} winners in this view.`
    : "No winners have been created yet.";

  return (
    <div>
      <PageHeader eyebrow="04 · Winners management" title="Winners" />

      <div className="mb-4 flex gap-2">
        {filters.map((f) => (
          <a
            key={f.key}
            href={`/admin/winners${f.key === "all" ? "" : `?verification=${f.key}`}`}
            className={`stamp ${(!filter && f.key === "all") || filter === f.key ? "border-paper/40 text-ink" : "border-line text-ink/50"}`}
          >
            {f.label}
          </a>
        ))}
      </div>

      {error && <p className="stamp-flag mb-4">Couldn&apos;t load winners: {error.message}</p>}

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="score-row bg-paper text-xs uppercase tracking-wide text-ink/50">
              <th className="px-4 py-3 font-normal">Winner</th>
              <th className="px-4 py-3 font-normal">Tier</th>
              <th className="px-4 py-3 font-normal">Prize</th>
              <th className="px-4 py-3 font-normal">Proof</th>
              <th className="px-4 py-3 font-normal">Verification</th>
              <th className="px-4 py-3 font-normal">Payment</th>
            </tr>
          </thead>
          <tbody>
            {winnersWithSignedUrls.map((w) => (
              <WinnerRow key={w.id} winner={w} />
            ))}
            {(!winners || winners.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink/40">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
