import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SubscribeControl from "./subscribe-control";

// Public charity directory. Anyone can browse this (RLS allows public
// select on charities), signed in or not — subscribers pick their charity
// from here or from the dashboard once they're on a plan.
export default async function CharitiesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: charities } = await supabase
    .from("charities")
    .select("id, name, description, is_featured")
    .order("is_featured", { ascending: false })
    .order("name", { ascending: true });

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <Link href="/" className="text-sm text-paper/60 underline underline-offset-2">
        ← Back home
      </Link>

      <p className="mt-6 font-mono text-xs uppercase tracking-widest text-sand">
        Digital Heroes
      </p>
      <h1 className="mt-2 font-display text-3xl italic text-paper">Charities</h1>
      <p className="mt-3 max-w-xl text-paper/70">
        Every subscription sends a share of its fee to the charity the
        subscriber picks. Here's who's currently taking part.
      </p>

      {!charities || charities.length === 0 ? (
        <p className="mt-10 text-sm text-paper/50">No charities listed yet.</p>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {charities.map((c) => (
            <div key={c.id} className="panel space-y-2 p-5">
              {c.is_featured && <span className="stamp-sand">Featured</span>}
              <Link href={`/charities/${c.id}`} className="block">
                <h2 className="font-display text-lg italic text-paper hover:text-sand">
                  {c.name}
                </h2>
              </Link>
              {c.description && <p className="text-sm text-paper/60">{c.description}</p>}
              <SubscribeControl charityId={c.id} signedIn={!!user} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
