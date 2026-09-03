import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";

export default async function SiteHeader({ compact = false }: { compact?: boolean }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { full_name: string | null; role: string | null } | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  }

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || "Account";
  const isAdmin = profile?.role === "admin";

  return (
    <header className="site-shell pt-4 sm:pt-6">
      <div className="rounded-2xl border border-line/80 bg-white/85 shadow-soft backdrop-blur">
        <div className="flex min-h-[68px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-3 font-semibold tracking-tight text-ink" aria-label="Golf Charity home">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-fairway text-sm font-display text-white shadow-sm">G</span>
            <span>
              <span className="block text-sm leading-none">Golf Charity</span>
              <span className="mt-1 hidden text-[9px] font-mono uppercase tracking-[.18em] text-ink/40 sm:block">Play · Give · Win</span>
            </span>
          </Link>

          {!compact && (
            <nav className="hidden items-center gap-6 lg:flex" aria-label="Main navigation">
              <Link href="/" className="nav-link">Home</Link>
              <Link href="/charities" className="nav-link">Charities</Link>
              <Link href="/draws" className="nav-link">Draws</Link>
              {user ? <Link href="/dashboard" className="nav-link">Dashboard</Link> : <Link href="/subscribe" className="nav-link">Subscribe</Link>}
            </nav>
          )}

          <div className="flex items-center justify-end gap-2">
            {user ? (
              <>
                {isAdmin && <Link href="/admin/users" className="hidden text-xs font-semibold text-fairway md:inline">Admin panel</Link>}
                <Link href="/dashboard" className="hidden max-w-[150px] truncate text-xs font-semibold text-fairway sm:inline" title={profile?.full_name || user.email || "Dashboard"}>
                  {firstName}&apos;s dashboard
                </Link>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-fairway/10 text-xs font-semibold text-fairway sm:hidden" aria-label={`${firstName}'s account`}>
                  {firstName.slice(0, 1).toUpperCase()}
                </span>
                <SignOutButton className={compact ? "" : "hidden sm:inline-flex"} />
              </>
            ) : (
              <>
                <Link href="/login" className="btn-ghost px-3 py-2 text-xs sm:px-4">Sign in</Link>
                <Link href="/signup" className="btn-primary px-3 py-2 text-xs sm:px-4">Get started</Link>
              </>
            )}
          </div>
        </div>

        {!compact && (
          <nav className="flex gap-4 overflow-x-auto border-t border-line/70 px-4 py-3 text-xs lg:hidden" aria-label="Mobile navigation">
            <Link href="/" className="nav-link whitespace-nowrap">Home</Link>
            <Link href="/charities" className="nav-link whitespace-nowrap">Charities</Link>
            <Link href="/draws" className="nav-link whitespace-nowrap">Draws</Link>
            {user ? (
              <>
                <Link href="/dashboard" className="nav-link whitespace-nowrap">Dashboard</Link>
                {isAdmin && <Link href="/admin/users" className="nav-link whitespace-nowrap">Admin panel</Link>}
                <SignOutButton className="ml-auto whitespace-nowrap" />
              </>
            ) : (
              <Link href="/subscribe" className="nav-link whitespace-nowrap">Subscribe</Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
