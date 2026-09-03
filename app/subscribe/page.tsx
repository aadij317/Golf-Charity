import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SubscribeForm from "./subscribe-form";

// Dedicated subscribe flow: plan + charity + contribution % in one place,
// vs. the quick per-card control on /charities. Signed-in users only —
// this is where /signup sends new accounts, and where the dashboard
// sends anyone without an active subscription yet.
export default async function SubscribePage({
  searchParams,
}: {
  searchParams: { charity?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: charities } = await supabase
    .from("charities")
    .select("id, name, description, is_featured")
    .order("is_featured", { ascending: false })
    .order("name", { ascending: true });

  return (
    <SubscribeForm
      charities={charities ?? []}
      initialCharityId={searchParams.charity}
    />
  );
}
