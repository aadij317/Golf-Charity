import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import AdminNav from "@/components/admin/admin-nav";

// The public homepage/site is meant to be indexed (PRD §12: the site is
// a public-facing product, not a private tool) — but the admin console
// specifically should stay out of search results. Next.js merges nested
// metadata, so this only overrides `robots` for everything under /admin.
export const metadata: Metadata = {
  title: "Digital Heroes — Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Every admin route is gated here, once, at the layout level — individual
  // pages don't each re-implement the check. requireAdmin() redirects on
  // failure, so reaching the return below means we have a real admin.
  const profile = await requireAdmin();

  return (
    <div className="flex min-h-screen">
      <AdminNav adminName={profile.full_name || profile.email} />
      <main className="flex-1 px-8 py-8 md:px-12">{children}</main>
    </div>
  );
}
