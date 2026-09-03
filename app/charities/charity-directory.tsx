"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SubscribeControl from "./subscribe-control";

type Charity = { id: string; name: string; description: string | null; image_url?: string | null; is_featured: boolean };
const photos = [
  "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=900&q=80",
];

export default function CharityDirectory({ charities, signedIn }: { charities: Charity[]; signedIn: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "featured">("all");
  const visible = useMemo(() => charities.filter((charity) => {
    const haystack = `${charity.name} ${charity.description ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (filter === "all" || charity.is_featured);
  }), [charities, filter, query]);

  return (
    <>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/35">⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="input w-full pl-10" placeholder="Search charities" aria-label="Search charities" />
        </div>
        <div className="flex rounded-xl border border-line bg-white p-1 text-xs">
          <button onClick={() => setFilter("all")} className={`rounded-lg px-3 py-2 font-medium transition ${filter === "all" ? "bg-paper text-fairway" : "text-ink/50"}`}>All causes</button>
          <button onClick={() => setFilter("featured")} className={`rounded-lg px-3 py-2 font-medium transition ${filter === "featured" ? "bg-paper text-fairway" : "text-ink/50"}`}>Featured</button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="panel mt-7 p-12 text-center"><p className="font-display text-2xl">No matches found.</p><p className="mt-2 text-sm text-ink/50">Try another name or clear the featured filter.</p></div>
      ) : (
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c, i) => (
            <article key={c.id} className="group photo-card flex flex-col">
              <Link href={`/charities/${c.id}`} className="overflow-hidden">
                <div className="photo-cover h-48" style={{ backgroundImage: `url('${c.image_url || photos[i % photos.length]}')` }} />
              </Link>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3"><h2 className="font-display text-xl text-ink">{c.name}</h2>{c.is_featured && <span className="stamp-sand">Spotlight</span>}</div>
                <p className="mt-3 flex-1 text-xs leading-6 text-ink/55">{c.description || "Creating meaningful change through community action."}</p>
                <Link href={`/charities/${c.id}`} className="mt-5 text-xs font-semibold text-fairway">Discover the cause →</Link>
                <div className="mt-4 border-t border-line pt-4"><SubscribeControl charityId={c.id} signedIn={signedIn} /></div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
