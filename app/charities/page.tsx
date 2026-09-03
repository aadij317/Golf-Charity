import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import CharityDirectory from "./charity-directory";

export default async function CharitiesPage() {
  const supabase = createClient();
  const [{ data: { user } }, { data: charities }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("charities").select("id,name,description,image_url,is_featured").order("is_featured", { ascending: false }).order("name", { ascending: true }),
  ]);

  return <main><SiteHeader /><section className="page-wrap">
    <div className="max-w-3xl"><p className="eyebrow">Choose your charity</p><h1 className="mt-3 font-display text-5xl leading-tight sm:text-6xl">Make every subscription point somewhere meaningful.</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-ink/60">Explore the causes available on the platform, read their profiles, and choose where your contribution goes. You can select more than the 10% minimum when setting up your subscription.</p></div>
    <CharityDirectory charities={charities ?? []} signedIn={!!user} />
  </section></main>;
}
