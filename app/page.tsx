import { createClient } from "@/lib/supabase/server";
import HeroMotion from "./hero-motion";
import FeaturedCharitiesMotion from "./featured-charities-motion";
import Link from "next/link";
import SiteHeader from "@/components/site-header";

export default async function HomePage() {
  const supabase = createClient();
  const [{ data: charities }, { count: charityCount }, { data: auth }] = await Promise.all([
    supabase
      .from("charities")
      .select("id, name, description, is_featured")
      .order("is_featured", { ascending: false })
      .limit(3),
    supabase.from("charities").select("*", { count: "exact", head: true }),
    supabase.auth.getUser(),
  ]);

  return (
    <main>
      <SiteHeader />
      <div className="site-shell pb-14">
        <div className="pt-5 sm:pt-7"><HeroMotion signedIn={!!auth?.user} /></div>

        <section className="mt-4 grid divide-y divide-line overflow-hidden rounded-card border border-line bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            ["01", "Subscribe your way", "Monthly or yearly access with a charity you choose."],
            ["02", "Track your latest five", "A simple Stableford score flow that always keeps your latest scores."],
            ["03", `${charityCount ?? 0} causes available`, "A portion of your subscription supports meaningful work beyond the game."],
          ].map(([number, title, text]) => (
            <div key={number} className="p-5 sm:p-6">
              <span className="font-mono text-[10px] tracking-[.18em] text-sand">{number}</span>
              <h2 className="mt-4 font-display text-xl">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/55">{text}</p>
            </div>
          ))}
        </section>

        <section id="how-it-works" className="py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">A simple rhythm</p>
            <h2 className="section-title mt-3">Four small steps. One bigger impact.</h2>
            <p className="mt-4 text-sm leading-7 text-ink/55">The product is designed to keep the mechanics clear: subscribe, keep your latest scores up to date, participate in monthly draws, and support a cause along the way.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              ["01", "Choose a plan", "Pick monthly or yearly access and decide how much of your fee supports your charity."],
              ["02", "Keep scores current", "Enter scores from 1–45 with a date. Your latest five are retained automatically."],
              ["03", "Watch the draw", "Published monthly results reveal five winning numbers and the prize breakdown."],
              ["04", "Celebrate impact", "Winners can submit proof for review while every subscription keeps a chosen cause in the loop."],
            ].map(([n, t, d]) => (
              <article key={n} className="panel group min-h-[230px] p-5 transition hover:-translate-y-1">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-fairway text-[10px] font-mono text-white">{n}</span>
                <h3 className="mt-8 font-display text-xl">{t}</h3>
                <p className="mt-3 text-xs leading-6 text-ink/55">{d}</p>
              </article>
            ))}
          </div>
        </section>

        <FeaturedCharitiesMotion charities={charities ?? []} />

        <section className="grid gap-4 py-16 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-card border border-fairway/10 bg-fairway p-7 text-white sm:p-9">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-white/55">Monthly reward engine</p>
            <h2 className="mt-3 max-w-xl font-display text-4xl leading-tight">A draw system with clear rules, before anything is published.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/70">Admins can simulate random or algorithmic draws before publishing results. Prize tiers are automatically split and the five-match jackpot can roll forward when unclaimed.</p>
            <Link href="/draws" className="mt-7 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-fairway transition hover:-translate-y-0.5">Explore draw results →</Link>
          </div>
          <div className="panel p-7 sm:p-9">
            <p className="eyebrow">Prize distribution</p>
            <div className="mt-7 space-y-5">
              {[
                ["5-number match", "40%", "Jackpot tier · rolls forward if unclaimed"],
                ["4-number match", "35%", "Split equally between winners"],
                ["3-number match", "25%", "Split equally between winners"],
              ].map(([tier, pct, copy]) => (
                <div key={tier} className="flex gap-4 border-b border-line pb-5 last:border-b-0 last:pb-0">
                  <span className="number-chip">{pct}</span>
                  <div><h3 className="font-semibold text-ink">{tier}</h3><p className="mt-1 text-xs leading-5 text-ink/50">{copy}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[22px] border border-fairway/10 bg-[#F0F4EF] px-6 py-10 sm:px-10 sm:py-14">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-fairway/5" />
          <div className="relative max-w-2xl">
            <p className="eyebrow">Ready when you are</p>
            <h2 className="mt-3 font-display text-4xl">Turn your next round into something that reaches further.</h2>
            <p className="mt-4 text-sm leading-7 text-ink/60">Create an account, choose a cause, and set up the subscription that unlocks your score and draw experience.</p>
            <div className="mt-7 flex flex-wrap gap-3"><Link href={auth?.user ? "/dashboard" : "/signup"} className="btn-primary">{auth?.user ? "Go to dashboard →" : "Create an account →"}</Link><Link href="/charities" className="btn-ghost">Explore charities</Link></div>
          </div>
        </section>

        <footer className="flex flex-col gap-4 py-10 text-xs text-ink/45 sm:flex-row sm:items-center sm:justify-between">
          <p><span className="font-semibold text-ink">Golf Charity</span> · Play golf. Give back. Win real prizes.</p>
          <div className="flex gap-5"><Link href="/charities">Charities</Link><Link href="/draws">Draws</Link><Link href="/subscribe">Subscribe</Link></div>
        </footer>
      </div>
    </main>
  );
}
