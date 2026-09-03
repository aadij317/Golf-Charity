"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS=[
  {href:"/admin/users",label:"Users",short:"Users"},
  {href:"/admin/draws",label:"Draws",short:"Draws"},
  {href:"/admin/charities",label:"Charities",short:"Causes"},
  {href:"/admin/winners",label:"Winners",short:"Winners"},
  {href:"/admin/reports",label:"Reports",short:"Reports"},
];

export default function AdminNav({adminName}:{adminName:string}) {
  const pathname=usePathname(); const router=useRouter();
  async function handleSignOut(){const supabase=createClient();await supabase.auth.signOut();router.push('/login');router.refresh();}
  return <>
    <div className="sticky top-0 z-30 border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3"><Link href="/" className="font-semibold text-ink">Golf Charity <span className="text-ink/35">/ Admin</span></Link><button onClick={handleSignOut} className="text-xs font-semibold text-fairway">Sign out</button></div>
      <nav className="mx-auto mt-3 flex max-w-5xl gap-1 overflow-x-auto pb-1">{LINKS.map(link=>{const active=pathname?.startsWith(link.href);return <Link key={link.href} href={link.href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${active?'bg-fairway text-white':'text-ink/55 hover:bg-paper'}`}>{link.short}</Link>})}</nav>
    </div>
    <aside className="fixed inset-y-0 left-0 z-30 hidden h-screen w-64 flex-col justify-between border-r border-line bg-white/90 p-5 backdrop-blur lg:flex">
      <div><Link href="/" className="flex items-center gap-3 font-semibold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-fairway text-sm font-display text-white">G</span><span>Golf Charity<span className="mt-1 block text-[9px] font-mono uppercase tracking-[.18em] text-ink/35">Administration</span></span></Link><p className="mt-10 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-ink/35">Control centre</p><nav className="mt-3 space-y-1">{LINKS.map(link=>{const active=pathname?.startsWith(link.href);return <Link key={link.href} href={link.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${active?'bg-fairway text-white shadow-soft':'text-ink/55 hover:bg-paper hover:text-fairway'}`}><span className="text-[10px]">{active?'●':'○'}</span>{link.label}</Link>})}</nav></div>
      <div className="border-t border-line pt-4"><p className="mb-3 truncate text-xs text-ink/45">{adminName}</p><button onClick={handleSignOut} className="text-xs font-medium text-ink/45 hover:text-fairway">Sign out</button></div>
    </aside>
  </>;
}
