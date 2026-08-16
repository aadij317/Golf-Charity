import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/admin/page-header";
import ProfileForm from "./profile-form";
import ScoresEditor from "./scores-editor";
import SubscriptionPanel from "./subscription-panel";

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: profile }, { data: scores }, { data: subscriptions }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", params.id).single(),
    supabase.from("scores").select("id, score, score_date").eq("user_id", params.id),
    supabase.from("subscriptions").select("*").eq("user_id", params.id).limit(1),
  ]);

  if (!profile) notFound();

  return (
    <div>
      <PageHeader
        eyebrow="01 · User management"
        title={profile.full_name || profile.email}
        action={
          <Link href="/admin/users" className="text-xs text-paper/50 underline underline-offset-2">
            ← All users
          </Link>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <ProfileForm userId={profile.id} fullName={profile.full_name} role={profile.role} />
        <SubscriptionPanel userId={profile.id} subscription={subscriptions?.[0] ?? null} />
        <div className="md:col-span-2">
          <ScoresEditor userId={profile.id} scores={scores ?? []} />
        </div>
      </div>
    </div>
  );
}
