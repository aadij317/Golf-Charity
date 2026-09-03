"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * Every action here re-checks requireAdmin() itself rather than trusting
 * that the page that rendered the form was gated — Server Actions are
 * callable directly (e.g. from a crafted request), so the page-level gate
 * in layout.tsx is not sufficient on its own for anything that mutates.
 * The Supabase client used is still the RLS-scoped server client (not the
 * service-role one), so is_admin() in the DB is the actual backstop even
 * if this check were ever removed by mistake.
 */

export async function updateProfile(userId: string, formData: FormData) {
  await requireAdmin();
  const supabase = createClient();

  const full_name = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "subscriber");

  const { error } = await supabase
    .from("profiles")
    .update({ full_name, role })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${userId}`);
  return { error: null };
}

export async function upsertScore(userId: string, formData: FormData) {
  await requireAdmin();
  const supabase = createClient();

  const score = Number(formData.get("score"));
  const score_date = String(formData.get("score_date"));
  const existingId = formData.get("score_id");

  // Mirror the same 1–45 bound the DB enforces, so an admin gets an
  // immediate, specific message instead of a raw constraint-violation
  // error surfaced from Postgres.
  if (!Number.isInteger(score) || score < 1 || score > 45) {
    return { error: "Score must be a whole number between 1 and 45." };
  }
  if (!score_date) {
    return { error: "A date is required." };
  }

  const query = existingId
    ? supabase.from("scores").update({ score, score_date }).eq("id", String(existingId))
    : supabase.from("scores").insert({ user_id: userId, score, score_date });

  const { error } = await query;

  if (error) {
    // unique_violation on (user_id, score_date) — same rule the PRD states
    // for the subscriber-facing flow: existing dates can only be edited,
    // not re-inserted.
    if (error.code === "23505") {
      return { error: "A score already exists for that date. Edit it instead of adding a new one." };
    }
    return { error: error.message };
  }

  revalidatePath(`/admin/users/${userId}`);
  return { error: null };
}

export async function deleteScore(userId: string, scoreId: string) {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("scores").delete().eq("id", scoreId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${userId}`);
  return { error: null };
}

export async function overrideSubscription(
  userId: string,
  subscriptionId: string | null,
  formData: FormData
) {
  await requireAdmin();
  const supabase = createClient();

  const status = String(formData.get("status"));
  const plan = String(formData.get("plan"));

  // Manual override path, explicitly for the edge cases the brief calls
  // out (a Stripe webhook that never landed, a comped account, a support
  // ticket) — normal lifecycle changes still come from the Stripe webhook
  // this workstream doesn't own. We don't touch stripe_subscription_id or
  // current_period_end here, so a later real webhook event still
  // reconciles correctly instead of fighting this override.
  if (subscriptionId) {
    const { error } = await supabase
      .from("subscriptions")
      .update({ status, plan })
      .eq("id", subscriptionId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("subscriptions")
      .insert({ user_id: userId, status, plan, charity_contribution_pct: 10 });
    if (error) return { error: error.message };
  }

  revalidatePath(`/admin/users/${userId}`);
  return { error: null };
}
