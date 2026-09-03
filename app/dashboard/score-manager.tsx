"use client";

import { useState } from "react";
import ScoreForm from "./score-form";
import ScoreRow from "./score-row";

type Score = {
  id: string;
  score: number;
  score_date: string;
};

export default function ScoreManager({
  scores,
  disabled = false,
}: {
  scores: Score[];
  disabled?: boolean;
}) {
  const [editingScore, setEditingScore] = useState<Score | null>(null);

  function handleEdit(score: Score) {
    setEditingScore(score);
  }

  function handleCancelEdit() {
    setEditingScore(null);
  }

  return (
    <div>
      {scores.length > 0 ? (
        <ul className="rounded-xl border border-line bg-paper/45 px-4">
          {scores.map((score) => (
            <ScoreRow
              key={score.id}
              id={score.id}
              score={score.score}
              scoreDate={score.score_date}
              disabled={disabled}
              onEdit={() => handleEdit(score)}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-paper/40 p-8 text-center">
          <p className="font-display text-xl">No scores yet.</p>
          <p className="mt-2 text-xs text-ink/50">
            Your next score will start your rolling record.
          </p>
        </div>
      )}

      <ScoreForm
        disabled={disabled}
        editingScore={editingScore}
        onCancelEdit={handleCancelEdit}
        onSaved={handleCancelEdit}
      />
    </div>
  );
}