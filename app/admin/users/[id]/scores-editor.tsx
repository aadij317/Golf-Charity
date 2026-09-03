"use client";

import { useState, useTransition } from "react";
import { upsertScore, deleteScore } from "./actions";

type Score = { id: string; score: number; score_date: string };

export default function ScoresEditor({
  userId,
  scores,
}: {
  userId: string;
  scores: Score[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Reflects the same rolling-5 rule the DB trigger enforces, so an admin
  // isn't surprised when a 6th score silently displaces the oldest one —
  // this note is purely informational; the actual limit is enforced by
  // enforce_score_limit() in the backend workstream's migration, not here.
  const atLimit = scores.length >= 5;

  function handleAddOrEdit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await upsertScore(userId, formData);
      if (res.error) setError(res.error);
      else setEditingId(null);
    });
  }

  function handleDelete(scoreId: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteScore(userId, scoreId);
      if (res.error) setError(res.error);
    });
  }

  const sorted = [...scores].sort((a, b) => (a.score_date < b.score_date ? 1 : -1));

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg italic text-ink">Scores</h2>
        <span className="score-num text-ink/50">{scores.length} / 5 kept</span>
      </div>

      <ul>
        {sorted.map((s) => (
          <li key={s.id} className="score-row flex items-center justify-between py-2">
            {editingId === s.id ? (
              <form action={handleAddOrEdit} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="score_id" value={s.id} />
                <input
                  name="score"
                  type="number"
                  min={1}
                  max={45}
                  defaultValue={s.score}
                  className="input w-20"
                />
                <input
                  name="score_date"
                  type="date"
                  defaultValue={s.score_date}
                  className="input w-40"
                />
                <button type="submit" disabled={isPending} className="btn-primary px-3 py-1.5 text-xs">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="btn-ghost px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <span className="score-num w-10 text-ink">{s.score}</span>
                  <span className="text-sm text-ink/60">
                    {new Date(s.score_date + "T00:00:00").toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingId(s.id)}
                    className="text-xs text-sand underline underline-offset-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={isPending}
                    className="text-xs text-flag underline underline-offset-2"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}

        {sorted.length === 0 && (
          <li className="py-4 text-center text-sm text-ink/40">No scores entered yet.</li>
        )}
      </ul>

      {error && <p className="text-sm text-flag">{error}</p>}

      <details className="pt-2">
        <summary className="cursor-pointer text-xs text-sand">
          + Add a score{atLimit ? " (will replace the oldest — 5 already kept)" : ""}
        </summary>
        <form action={handleAddOrEdit} className="mt-3 flex items-center gap-2">
          <input name="score" type="number" min={1} max={45} placeholder="1–45" className="input w-20" required />
          <input name="score_date" type="date" className="input w-40" required />
          <button type="submit" disabled={isPending} className="btn-primary px-3 py-1.5 text-xs">
            Add
          </button>
        </form>
      </details>
    </div>
  );
}
