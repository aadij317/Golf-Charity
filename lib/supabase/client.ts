import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client, scoped by RLS to whatever user is signed in.
 * Used inside 'use client' components (forms, buttons that mutate state
 * optimistically). Server Components / Route Handlers should use
 * lib/supabase/server.ts instead — never share one client across both.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
