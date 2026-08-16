"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { requireAdmin } from "@/lib/admin-auth";

export type DrawRunResult = {
  ok: boolean;
  status: number;
  body: any;
};

/**
 * This workstream doesn't own /api/draws/run's matching/prize logic (the
 * backend workstream does, per its README) — this action is purely a
 * thin, authenticated bridge from the admin UI to that existing route.
 * It forwards the admin's own session cookie so the route's own
 * profiles.role check runs against a real admin session rather than this
 * UI asserting admin-ness on the route's behalf.
 */
export async function runDraw(params: {
  mode: "simulate" | "publish";
  month: string;
  draw_type: "random" | "algorithmic";
  algorithm_weighting?: "favor_rare" | "favor_common";
  subscription_fee?: number;
}): Promise<DrawRunResult> {
  await requireAdmin();

  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  // Build an absolute URL from the incoming request's own host, since
  // Server Actions don't have a implicit base URL the way a browser fetch
  // does — this works whether we're on localhost or the deployed Vercel
  // domain without hardcoding either.
  const host = headers().get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  try {
    const res = await fetch(`${baseUrl}/api/draws/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify(params),
      cache: "no-store",
    });

    const body = await res.json().catch(() => ({}));

    if (params.mode === "publish" && res.ok) {
      revalidatePath("/admin/draws");
    }

    return { ok: res.ok, status: res.status, body };
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      body: { error: `Couldn't reach /api/draws/run: ${e.message}` },
    };
  }
}
