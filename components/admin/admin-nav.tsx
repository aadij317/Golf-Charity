"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/admin/users", label: "Users", eyebrow: "01" },
  { href: "/admin/draws", label: "Draws", eyebrow: "02" },
  { href: "/admin/charities", label: "Charities", eyebrow: "03" },
  { href: "/admin/winners", label: "Winners", eyebrow: "04" },
  { href: "/admin/reports", label: "Reports", eyebrow: "05" },
];

export default function AdminNav({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-ink-line px-6 py-8">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sand">
          Digital Heroes
        </p>
        <p className="mb-10 font-display text-xl italic text-paper">Admin</p>

        <nav className="space-y-1">
          {LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 rounded-card px-3 py-2 text-sm transition ${
                  active
                    ? "bg-paper text-ink"
                    : "text-paper/70 hover:bg-ink-line/60 hover:text-paper"
                }`}
              >
                <span className="font-mono text-[10px] text-current/60">
                  {link.eyebrow}
                </span>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-ink-line pt-4">
        <p className="mb-2 truncate text-xs text-paper/50">{adminName}</p>
        <button onClick={handleSignOut} className="text-xs text-paper/50 underline underline-offset-2 hover:text-paper">
          Sign out
        </button>
      </div>
    </aside>
  );
}
