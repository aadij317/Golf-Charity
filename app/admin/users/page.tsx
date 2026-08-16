import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/admin/page-header";
import SearchInput from "@/components/admin/search-input";

type Row = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  created_at: string;
  subscriptions: { plan: string; status: string }[] | null;
};

const STATUS_STAMP: Record<string, string> = {
  active: "stamp-fairway",
  cancelled: "stamp-flag",
  lapsed: "stamp-sand",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createClient();
  const q = searchParams.q?.trim() ?? "";

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at, subscriptions(plan, status)")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data: users, error } = await query.returns<Row[]>();

  return (
    <div>
      <PageHeader
        eyebrow="01 · User management"
        title="Users"
        action={<SearchInput placeholder="Search name or email…" />}
      />

      {error && (
        <p className="stamp-flag mb-4">Couldn&apos;t load users: {error.message}</p>
      )}

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="score-row bg-ink text-xs uppercase tracking-wide text-paper/50">
              <th className="px-4 py-3 font-normal">Name</th>
              <th className="px-4 py-3 font-normal">Email</th>
              <th className="px-4 py-3 font-normal">Role</th>
              <th className="px-4 py-3 font-normal">Subscription</th>
              <th className="px-4 py-3 font-normal">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => {
              const sub = u.subscriptions?.[0];
              return (
                <tr key={u.id} className="score-row">
                  <td className="px-4 py-3 text-paper">{u.full_name || "—"}</td>
                  <td className="px-4 py-3 text-paper/70">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={u.role === "admin" ? "stamp-sand" : "stamp-fairway"}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {sub ? (
                      <span className={STATUS_STAMP[sub.status] ?? "stamp-sand"}>
                        {sub.plan} · {sub.status}
                      </span>
                    ) : (
                      <span className="text-paper/40">none</span>
                    )}
                  </td>
                  <td className="score-num px-4 py-3 text-paper/60">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-xs text-sand underline underline-offset-2"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              );
            })}

            {users?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-paper/40">
                  No users match &ldquo;{q}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
