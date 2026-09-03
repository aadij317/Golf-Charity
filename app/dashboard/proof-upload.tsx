"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * PRD §09 "Winner Verification System" — proof upload is a screenshot of
 * scores from the golf platform. Stored in the private `winner-proofs`
 * bucket (see supabase/migrations/0003_storage_winner_proofs.sql) under
 * `<user_id>/<winner_id>-...`, which the bucket's RLS policy uses to
 * scope reads/writes to the owner (or an admin).
 *
 * `winners.proof_url` stores the storage *path*, not a public URL, since
 * the bucket is private — the caller is responsible for resolving a
 * signed URL for display (see dashboard/page.tsx for the read side).
 */
export default function ProofUpload({
  winnerId,
  userId,
  hasExistingProof,
  verificationStatus,
}: {
  winnerId: string;
  userId: string;
  hasExistingProof: boolean;
  verificationStatus: "pending" | "approved" | "rejected";
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once approved, the record is locked — re-uploading after approval
  // would let a subscriber swap evidence after the fact.
  const locked = verificationStatus === "approved";

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, or WEBP).");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Proof images must be 10 MB or smaller.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const path = `${userId}/${winnerId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const { error: uploadError } = await supabase.storage
        .from("winner-proofs")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw new Error(uploadError.message);

      const { error: updateError } = await supabase
        .from("winners")
        .update({ proof_url: path, verification_status: "pending" })
        .eq("id", winnerId)
        .eq("user_id", userId);

      if (updateError) {
        // Avoid leaving a private orphaned upload behind when the winner row
        // update is rejected by RLS or verification rules.
        await supabase.storage.from("winner-proofs").remove([path]);
        throw new Error(updateError.message);
      }

      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (locked) {
    return <p className="text-xs text-fairway">Proof verified — no further action needed.</p>;
  }

  return (
    <div className="mt-2">
      <label className="btn-ghost cursor-pointer text-xs">
        {uploading ? "Uploading…" : hasExistingProof ? "Replace proof" : "Upload proof of scores"}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
      </label>
      {error && <p className="mt-1 text-xs text-flag">{error}</p>}
    </div>
  );
}
