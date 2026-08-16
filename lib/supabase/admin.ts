import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely — do NOT import this into
 * anything that runs in the browser, and do not use it as a shortcut for
 * routes that should be RLS-scoped.
 *
 * Used in exactly two places in this workstream:
 *   1. scripts/seed.ts (no user session exists yet to seed against)
 *   2. app/admin/draws/actions.ts, calling POST /api/draws/run — that
 *      route is owned by the backend workstream and, per their README,
 *      already expects/uses the service-role key server-side itself. This
 *      client here is only used to attach the admin's own auth token when
 *      *calling* that route, not to bypass it locally.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
