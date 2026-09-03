"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ScoreRow({
  id,
  score,
  scoreDate,
  disabled = false,
}: {
  id: string;
  score: number;
  scoreDate: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Delete this score entry?")) return;
    setDeleting(true);
    setError(null);

    const res = await fetch(`/api/scores?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't delete score");
      setDeleting(false);
      return;
    }

    router.refresh();
  }

  return (
    <li className="score-row flex items-center justify-between py-2">
      <span className="score-num text-ink">{score}</span>
      <span className="text-xs text-ink/50">
        {new Date(scoreDate + "T00:00:00").toLocaleDateString()}
      </span>
      {!disabled && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-flag underline underline-offset-2 disabled:opacity-40"
        >
          {deleting ? "Removing…" : "Delete"}
        </button>
      )}
      {error && <span className="text-xs text-flag">{error}</span>}
    </li>
  );
}
