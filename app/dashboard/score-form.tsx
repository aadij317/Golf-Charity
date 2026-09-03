"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ScoreForm({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [score, setScore] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const maxDate = new Date().toISOString().slice(0, 10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
    setLoading(false);
    router.refresh();
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
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving…" : "Add / Edit"}
      </button>
      </div>
      {error && <p className="mt-3 text-xs text-flag">{error}</p>}
    </form>
  );
}
