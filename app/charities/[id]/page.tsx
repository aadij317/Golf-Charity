import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";

export default async function CharityDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: charity }, { data: { user } }] = await Promise.all([
    supabase.from("charities").select("id,name,description,image_url,is_featured").eq("id", params.id).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!charity) notFound();

  const { data: subscription } = user
    ? await supabase.from("subscriptions").select("status,current_period_end").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const hasActiveSubscription =
    subscription?.status === "active" &&
    (!subscription.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now());
  const supportHref = hasActiveSubscription ? "/dashboard" : user ? `/subscribe?charity=${charity.id}` : `/login?next=${encodeURIComponent(`/subscribe?charity=${charity.id}`)}`;
  const supportLabel = hasActiveSubscription ? "View your dashboard →" : user ? "Subscribe & support →" : "Sign in to support →";
  return <main><SiteHeader compact /><section className="page-wrap">
    <Link href="/charities" className="text-xs font-semibold text-fairway">← Back to all charities</Link>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
      <article className="overflow-hidden rounded-[22px] border border-line bg-white shadow-soft">
        <div className="relative h-72 bg-paper sm:h-96">{charity.image_url ? <Image src={charity.image_url} alt={charity.name} fill className="object-cover" unoptimized /> : <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#f6f1e6,#eef4ef)] font-display text-2xl text-ink/35">{charity.name}</div>}{charity.is_featured && <span className="stamp-sand absolute left-5 top-5">Featured cause</span>}</div>
        <div className="p-7 sm:p-9"><p className="eyebrow">Charity profile</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">{charity.name}</h1><p className="mt-6 text-sm leading-8 text-ink/65">{charity.description || "This organisation is part of the Golf Charity directory, where members can direct a portion of their subscription toward a cause they care about."}</p></div>
      </article>
      <aside className="space-y-5"><div className="rounded-card border border-fairway/10 bg-fairway p-7 text-white"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-white/55">Support this cause</p><h2 className="mt-3 font-display text-3xl">Choose where your membership gives.</h2><p className="mt-3 text-sm leading-7 text-white/70">Every subscription lets you set at least 10% of the fee aside for your selected charity, with the option to contribute more.</p><Link href={supportHref} className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-fairway">{supportLabel}</Link></div><div className="panel p-6"><p className="eyebrow">Events & updates</p><h2 className="mt-2 font-display text-2xl">What&apos;s coming up</h2><p className="mt-3 text-sm leading-7 text-ink/55">Upcoming charity events and golf days can be managed alongside this profile. There are no upcoming events published for this charity yet.</p></div><div className="panel-muted p-6"><p className="text-xs leading-6 text-ink/55"><span className="font-semibold text-ink">Why this matters:</span> the charity directory is designed as part of the member journey, not a decorative page — your selected cause is carried into your subscription record and shown in your dashboard.</p></div></aside>
    </div>
  </section></main>;
}
