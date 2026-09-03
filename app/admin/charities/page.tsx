import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/admin/page-header";
import CharityCard from "./charity-card";
import NewCharityPanel from "./new-charity-panel";

export default async function CharitiesPage() {
  const supabase = createClient();
  const { data: charities } = await supabase
    .from("charities")
    .select("*")
    .order("is_featured", { ascending: false })
    .order("name");

  return (
    <div>
      <PageHeader eyebrow="03 · Charity management" title="Charities" action={<NewCharityPanel />} />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {charities?.map((c) => (
          <CharityCard key={c.id} charity={c} />
        ))}
        {(!charities || charities.length === 0) && (
          <p className="text-ink/40">No charities yet — add the first one above.</p>
        )}
      </div>
    </div>
  );
}
