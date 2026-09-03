"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ScoreRow({
  id,
  score,
  scoreDate,
  disabled = false,
  onEdit,
}: {
  id: string;
  score: number;
  scoreDate: string;
  disabled?: boolean;
  onEdit?: () => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Delete this score entry?")) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/scores?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error ?? "Couldn't delete score");
        setDeleting(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Couldn't delete score");
      setDeleting(false);
    }
  }

  return (
    <li className="score-row flex flex-wrap items-center justify-between gap-3 py-2">
      <span className="score-num text-ink">{score}</span>

      <span className="text-xs text-ink/50">
        {new Date(`${scoreDate}T00:00:00`).toLocaleDateString()}
      </span>

      {!disabled && (
        <div className="flex items-center gap-3">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              disabled={deleting}
              className="text-xs text-fairway underline underline-offset-2 disabled:opacity-40"
            >
              Edit
            </button>
          )}

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-flag underline underline-offset-2 disabled:opacity-40"
          >
            {deleting ? "Removing…" : "Delete"}
          </button>
        </div>
      )}

      {error && (
        <p className="basis-full text-xs text-flag">
          {error}
        </p>
      )}
    </li>
  );
}
