import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Public draw results. No auth required — RLS on `draws` already allows
// anyone to select status='published' rows (see 0001_init_schema.sql,
// "draws_select_published_or_admin"), drafts/simulations stay admin-only
// automatically even though this query doesn't filter by role itself.
export default async function DrawsPage() {
  const supabase = createClient();

  const { data: draws } = await supabase
    .from("draws")
    .select("id, month, draw_type, winning_numbers, jackpot_rollover_amount")
    .eq("status", "published")
    .order("month", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-paper/60 underline underline-offset-2">
        ← Back home
      </Link>

      <p className="mt-6 font-mono text-xs uppercase tracking-widest text-sand">
        Digital Heroes
      </p>
      <h1 className="mt-2 font-display text-3xl italic text-paper">
        Draw results
      </h1>
      <p className="mt-3 max-w-xl text-paper/70">
        Every published draw, most recent first — winning numbers and
        whether the jackpot rolled over.
      </p>

      {!draws || draws.length === 0 ? (
        <div className="panel mt-10 p-8 text-center">
          <p className="font-display text-lg italic text-paper">
            First draw coming next month
          </p>
          <p className="mt-2 text-sm text-paper/60">
            No draws have been published yet — check back once the next
            round closes.
          </p>
        </div>
      ) : (
        <div className="panel mt-10 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="score-row bg-ink text-xs uppercase tracking-wide text-paper/50">
                <th className="px-4 py-3 font-normal">Month</th>
                <th className="px-4 py-3 font-normal">Type</th>
                <th className="px-4 py-3 font-normal">Winning numbers</th>
                <th className="px-4 py-3 font-normal">Rollover</th>
              </tr>
            </thead>
            <tbody>
              {draws.map((d) => (
                <tr key={d.id} className="score-row">
                  <td className="score-num px-4 py-3 text-paper">
                    {new Date(d.month).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 text-paper/70">{d.draw_type}</td>
                  <td className="score-num px-4 py-3 text-paper/70">
                    {d.winning_numbers?.length ? d.winning_numbers.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {d.jackpot_rollover_amount ? (
                      <span className="stamp-sand">
                        Rolled over — ${d.jackpot_rollover_amount}
                      </span>
                    ) : (
                      <span className="text-paper/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
