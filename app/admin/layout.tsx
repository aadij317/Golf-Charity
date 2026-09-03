import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import AdminNav from "@/components/admin/admin-nav";
export const metadata: Metadata={title:"Golf Charity — Admin",robots:{index:false,follow:false}};
export default async function AdminLayout({children}:{children:React.ReactNode}){const profile=await requireAdmin();return <div className="min-h-screen bg-paper"><AdminNav adminName={profile.full_name||profile.email}/><main className="mx-auto min-h-screen max-w-[1500px] px-5 py-7 lg:ml-64 lg:px-10 lg:py-10">{children}</main></div>}
