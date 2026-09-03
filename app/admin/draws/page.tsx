import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/admin/page-header";
import DrawRunner from "./draw-runner";

const STATUS_STAMP: Record<string, string> = {
  published: "stamp-fairway",
  simulated: "stamp-sand",
  draft: "stamp-flag",
};

export default async function DrawsPage() {
  const supabase = createClient();
  const { data: draws } = await supabase
    .from("draws")
    .select("*")
    .order("month", { ascending: false })
    .limit(24);

  return (
    <div>
      <PageHeader eyebrow="02 · Draw management" title="Draws" />

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <DrawRunner />

        <div className="panel overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="score-row bg-paper text-xs uppercase tracking-wide text-ink/50">
                <th className="px-4 py-3 font-normal">Month</th>
                <th className="px-4 py-3 font-normal">Type</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal">Winning numbers</th>
                <th className="px-4 py-3 font-normal">Rollover</th>
              </tr>
            </thead>
            <tbody>
              {draws?.map((d) => (
                <tr key={d.id} className="score-row">
                  <td className="score-num px-4 py-3 text-ink">
                    {new Date(d.month).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 text-ink/70">{d.draw_type}</td>
                  <td className="px-4 py-3">
                    <span className={STATUS_STAMP[d.status] ?? "stamp-sand"}>{d.status}</span>
                  </td>
                  <td className="score-num px-4 py-3 text-ink/70">
                    {d.winning_numbers?.length ? d.winning_numbers.join(", ") : "—"}
                  </td>
                  <td className="score-num px-4 py-3 text-ink/70">
                    {d.jackpot_rollover_amount ? `$${d.jackpot_rollover_amount}` : "—"}
                  </td>
                </tr>
              ))}
              {(!draws || draws.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-ink/40">
                    No draws yet — run a simulation to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
