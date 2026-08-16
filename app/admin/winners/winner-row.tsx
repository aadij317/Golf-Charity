"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { setVerificationStatus, setPaymentStatus } from "./actions";

type Winner = {
  id: string;
  tier: string;
  prize_amount: number;
  proof_url: string | null;
  /** Short-lived signed URL resolved server-side (winner-proofs is a private bucket) */
  signed_proof_url?: string | null;
  verification_status: "pending" | "approved" | "rejected";
  payment_status: "pending" | "paid";
  profiles: { full_name: string | null; email: string } | null;
  draws: { month: string; draw_type: string } | null;
};

const VERIFY_STAMP: Record<string, string> = {
  approved: "stamp-fairway",
  rejected: "stamp-flag",
  pending: "stamp-sand",
};

export default function WinnerRow({ winner }: { winner: Winner }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  function verify(status: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const res = await setVerificationStatus(winner.id, status);
      if (res.error) setError(res.error);
    });
  }

  function pay(status: "pending" | "paid") {
    setError(null);
    startTransition(async () => {
      const res = await setPaymentStatus(winner.id, status);
      if (res.error) setError(res.error);
    });
  }

  return (
    <tr className="score-row align-top">
      <td className="px-4 py-3">
        <div className="text-paper">{winner.profiles?.full_name || winner.profiles?.email}</div>
        <div className="text-xs text-paper/50">
          {winner.draws?.month ? new Date(winner.draws.month).toLocaleDateString(undefined, { year: "numeric", month: "short" }) : "—"}
          {" · "}
          {winner.draws?.draw_type}
        </div>
      </td>
      <td className="score-num px-4 py-3 text-paper">{winner.tier}-match</td>
      <td className="score-num px-4 py-3 text-paper">${winner.prize_amount}</td>
      <td className="px-4 py-3">
        {winner.signed_proof_url ? (
          <>
            <button onClick={() => setLightboxOpen(true)}>
              <Image
                src={winner.signed_proof_url}
                alt="Winner proof"
                width={64}
                height={48}
                unoptimized
                className="rounded-card border border-ink-line object-cover"
              />
            </button>
            {lightboxOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
                onClick={() => setLightboxOpen(false)}
              >
                <Image
                  src={winner.signed_proof_url}
                  alt="Winner proof, full size"
                  width={800}
                  height={600}
                  unoptimized
                  className="max-h-full max-w-full rounded-card object-contain"
                />
              </div>
            )}
          </>
        ) : winner.proof_url ? (
          <span className="text-xs text-paper/40">Proof uploaded (preview unavailable)</span>
        ) : (
          <span className="text-xs text-paper/40">No proof uploaded</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={VERIFY_STAMP[winner.verification_status]}>{winner.verification_status}</span>
        {winner.verification_status === "pending" && (
          <div className="mt-2 flex gap-2">
            <button onClick={() => verify("approved")} disabled={isPending} className="text-xs text-fairway-soft underline underline-offset-2">
              Approve
            </button>
            <button onClick={() => verify("rejected")} disabled={isPending} className="text-xs text-flag-soft underline underline-offset-2">
              Reject
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={winner.payment_status === "paid" ? "stamp-fairway" : "stamp-sand"}>
          {winner.payment_status}
        </span>
        {winner.payment_status === "pending" ? (
          <button
            onClick={() => pay("paid")}
            disabled={isPending || winner.verification_status !== "approved"}
            className="mt-2 block text-xs text-sand underline underline-offset-2 disabled:opacity-40"
          >
            Mark paid
          </button>
        ) : (
          <button onClick={() => pay("pending")} disabled={isPending} className="mt-2 block text-xs text-paper/50 underline underline-offset-2">
            Revert to pending
          </button>
        )}
        {error && <p className="mt-1 text-xs text-flag-soft">{error}</p>}
      </td>
    </tr>
  );
}
