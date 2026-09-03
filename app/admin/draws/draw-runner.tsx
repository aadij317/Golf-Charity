"use client";

import { useState, useTransition } from "react";
import { runDraw, type DrawRunResult } from "./actions";

function thisMonthISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function toMonthInput(value: string) {
  return value.slice(0, 7);
}

function currentMonthInput() {
  return toMonthInput(thisMonthISO());
}

export default function DrawRunner() {
  const [month, setMonth] = useState(thisMonthISO());
  const [drawType, setDrawType] = useState<"random" | "algorithmic">("random");
  const [weighting, setWeighting] = useState<"favor_rare" | "favor_common">("favor_rare");
  const [preview, setPreview] = useState<DrawRunResult | null>(null);
  const [publishResult, setPublishResult] = useState<DrawRunResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function buildParams(mode: "simulate" | "publish") {
    return {
      mode,
      month,
      draw_type: drawType,
      ...(drawType === "algorithmic" ? { algorithm_weighting: weighting } : {}),
    };
  }

  function invalidatePreview() {
    setPreview(null);
    setPublishResult(null);
  }

  function handleSimulate() {
    setPublishResult(null);
    startTransition(async () => setPreview(await runDraw(buildParams("simulate"))));
  }

  function handlePublish() {
    const simulationId = preview?.body?.simulation_id;
    if (!simulationId) return;
    const monthLabel = new Date(`${month}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long" });
    if (!window.confirm(`Publish the ${monthLabel} draw exactly as shown in this preview? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = await runDraw({ ...buildParams("publish"), simulation_id: simulationId });
      setPublishResult(result);
      if (result.ok) setPreview(null);
    });
  }

  const previewExpiresAt = preview?.body?.simulation_expires_at
    ? new Date(preview.body.simulation_expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="panel space-y-5 p-5">
      <div>
        <h2 className="font-display text-lg italic text-ink">Configure &amp; run</h2>
        <p className="mt-1 text-xs leading-5 text-ink/50">Simulate first, review the exact snapshot, then publish that same snapshot.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-ink/60">Draw month</label>
          <input type="month" value={toMonthInput(month)} max={currentMonthInput()} onChange={(event) => { setMonth(event.target.value ? `${event.target.value}-01` : ""); invalidatePreview(); }} className="input w-full" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink/60">Draw type</label>
          <select value={drawType} onChange={(event) => { setDrawType(event.target.value as "random" | "algorithmic"); invalidatePreview(); }} className="input w-full">
            <option value="random">Random</option>
            <option value="algorithmic">Algorithmic</option>
          </select>
        </div>
        {drawType === "algorithmic" && (
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-ink/60">Weighting</label>
            <select value={weighting} onChange={(event) => { setWeighting(event.target.value as "favor_rare" | "favor_common"); invalidatePreview(); }} className="input w-full">
              <option value="favor_rare">Favor rare scores (default)</option>
              <option value="favor_common">Favor common scores</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={handleSimulate} disabled={isPending || !month} className="btn-ghost">{isPending ? "Working…" : "Simulate"}</button>
        <button onClick={handlePublish} disabled={isPending || !preview?.ok || !preview?.body?.simulation_id} className="btn-primary" title={!preview?.ok ? "Run a successful simulation first" : "Publish the exact reviewed simulation"}>Publish results</button>
      </div>

      {preview && (
        <div className={`rounded-card border p-4 text-sm ${preview.ok ? "border-fairway/40" : "border-flag/40"}`}>
          <p className="mb-2 font-mono text-xs uppercase tracking-wide text-ink/50">{preview.ok ? "Simulation preview — server snapshot" : `Simulation failed (${preview.status})`}</p>
          {preview.ok && previewExpiresAt && <p className="mb-3 text-xs text-ink/50">Publish is available until {previewExpiresAt}. Changing the configuration invalidates this preview.</p>}
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-ink/80">{JSON.stringify(preview.body, null, 2)}</pre>
        </div>
      )}

      {publishResult && (
        <div className={`rounded-card border p-4 text-sm ${publishResult.ok ? "border-fairway/40" : "border-flag/40"}`}>
          <p className="font-mono text-xs uppercase tracking-wide text-ink/50">{publishResult.ok ? "Published successfully." : publishResult.status === 409 ? "This draw can no longer be published." : `Publish failed (${publishResult.status})`}</p>
          {!publishResult.ok && publishResult.body?.error && <p className="mt-2 text-xs text-flag">{publishResult.body.error}</p>}
        </div>
      )}
    </div>
  );
}
