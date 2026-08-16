import { createClient } from "@/lib/supabase/server";
import HeroMotion from "./hero-motion";
import FeaturedCharitiesMotion from "./featured-charities-motion";

// Public homepage. Server Component so we can show real, current charity
// data (no client fetch waterfall for a page whose whole point is fast
// first impressions). Reads through the anon-key client, same as any
// other visitor — the charities table's RLS policy already allows public
// select, so no auth is required here.
export default async function HomePage() {
  const supabase = createClient();
  const { data: charities } = await supabase
    .from("charities")
    .select("id, name, description, is_featured")
    .order("is_featured", { ascending: false })
    .limit(3);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
      <HeroMotion />

      {charities && charities.length > 0 && (
        <FeaturedCharitiesMotion charities={charities} />
      )}
    </div>
  );
}
