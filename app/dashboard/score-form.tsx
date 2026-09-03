"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Score = {
  id: string;
  score: number;
  score_date: string;
};

export default function ScoreForm({
  disabled = false,
  editingScore = null,
  onCancelEdit,
  onSaved,
}: {
  disabled?: boolean;
  editingScore?: Score | null;
  onCancelEdit?: () => void;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const [score, setScore] = useState("");
  const [date, setDate] = useState(todayIso);
  const maxDate = todayIso();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = editingScore != null;

  // Populate the form when the user clicks Edit on a row, and reset it
  // back to a blank "add" state when editing is cancelled/finished.
  useEffect(() => {
    if (editingScore) {
      setScore(String(editingScore.score));
      setDate(editingScore.score_date);
      setError(null);
    } else {
      setScore("");
      setDate(todayIso());
    }
  }, [editingScore]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // The API upserts on (user_id, score_date), so submitting the same
    // date the user is editing updates that row instead of creating a
    // new one — this one call covers both add and edit.
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: Number(score), score_date: date }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    setScore("");
    setDate(todayIso());
    setLoading(false);
    onSaved?.();
    router.refresh();
  }

  function handleCancel() {
    setScore("");
    setDate(todayIso());
    setError(null);
    onCancelEdit?.();
  }

  if (disabled) {
    return (
      <p className="mt-3 text-xs text-ink/50">
        Score entry is only available with an active subscription.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-line bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
      <div className="flex-1">
        <label className="mb-1 block text-xs text-ink/60">Score (1–45)</label>
        <input
          type="number"
          min={1}
          max={45}
          required
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="input w-full"
        />
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-xs text-ink/60">Date</label>
        <input
          type="date"
          required
          max={maxDate}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input w-full"
        />
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving…" : isEditing ? "Save changes" : "Add / Edit"}
        </button>
        {isEditing && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="btn-ghost"
          >
            Cancel
          </button>
        )}
      </div>
      </div>
      {isEditing && (
        <p className="mt-3 text-xs text-ink/50">
          Editing the score for {new Date(`${date}T00:00:00`).toLocaleDateString()}.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-flag">{error}</p>}
    </form>
  );
}
