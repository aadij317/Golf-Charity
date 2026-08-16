"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendVerificationStatusEmail, sendPayoutPaidEmail } from "@/lib/email";

export async function setVerificationStatus(
  winnerId: string,
  status: "approved" | "rejected"
) {
  await requireAdmin();
  const supabase = createClient();
  const { data: winner, error } = await supabase
    .from("winners")
    .update({ verification_status: status })
    .eq("id", winnerId)
    .select("user_id, profiles(email, full_name)")
    .single();
  if (error) return { error: error.message };

  // Winner alert (PRD §13) — approve/reject is exactly the event the
  // README used to flag as an unbuilt "integration point."
  const profile = (winner as any)?.profiles;
  if (profile?.email) {
    await sendVerificationStatusEmail(profile.email, profile.full_name, status);
  }

  revalidatePath("/admin/winners");
  return { error: null };
}

export async function setPaymentStatus(winnerId: string, status: "pending" | "paid") {
  await requireAdmin();
  const supabase = createClient();

  // A payout can only be marked paid once a human has actually approved
  // the proof — guards against a stray click paying out a still-pending
  // or already-rejected claim.
  const { data: winner } = await supabase
    .from("winners")
    .select("verification_status, prize_amount, profiles(email, full_name)")
    .eq("id", winnerId)
    .single();

  if (status === "paid" && winner?.verification_status !== "approved") {
    return { error: "Can't mark as paid until the proof is approved." };
  }

  const { error } = await supabase.from("winners").update({ payment_status: status }).eq("id", winnerId);
  if (error) return { error: error.message };

  if (status === "paid") {
    const profile = (winner as any)?.profiles;
    if (profile?.email) {
      await sendPayoutPaidEmail(profile.email, profile.full_name, Number(winner!.prize_amount));
    }
  }

  revalidatePath("/admin/winners");
  return { error: null };
}
