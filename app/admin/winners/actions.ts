"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendVerificationStatusEmail, sendPayoutPaidEmail } from "@/lib/email";

export async function setVerificationStatus(winnerId: string, status: "approved" | "rejected") {
  await requireAdmin();
  const supabase = createClient();

  const { data: current, error: currentError } = await supabase
    .from("winners")
    .select("proof_url, payment_status")
    .eq("id", winnerId)
    .single();
  if (currentError || !current) return { error: currentError?.message ?? "Winner not found" };
  if (status === "approved" && !current.proof_url) return { error: "Proof must be uploaded before approval." };
  if (status === "rejected" && current.payment_status === "paid") return { error: "A paid winner cannot be rejected. Resolve the payout outside this workflow first." };

  const { data: winner, error } = await supabase
    .from("winners")
    .update({ verification_status: status, ...(status === "rejected" ? { payment_status: "pending" } : {}) })
    .eq("id", winnerId)
    .select("user_id, profiles(email, full_name)")
    .single();
  if (error) return { error: error.message };

  const profile = (winner as any)?.profiles;
  if (profile?.email) await sendVerificationStatusEmail(profile.email, profile.full_name, status);

  revalidatePath("/admin/winners");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function setPaymentStatus(winnerId: string, status: "pending" | "paid") {
  await requireAdmin();
  const supabase = createClient();
  const { data: winner, error: winnerError } = await supabase
    .from("winners")
    .select("verification_status, prize_amount, profiles(email, full_name)")
    .eq("id", winnerId)
    .single();
  if (winnerError || !winner) return { error: winnerError?.message ?? "Winner not found" };

  if (status === "paid" && winner.verification_status !== "approved") return { error: "Can't mark as paid until the proof is approved." };

  const { error } = await supabase.from("winners").update({ payment_status: status }).eq("id", winnerId);
  if (error) return { error: error.message };

  if (status === "paid") {
    const profile = (winner as any)?.profiles;
    if (profile?.email) await sendPayoutPaidEmail(profile.email, profile.full_name, Number(winner.prize_amount));
  }

  revalidatePath("/admin/winners");
  revalidatePath("/dashboard");
  return { error: null };
}
