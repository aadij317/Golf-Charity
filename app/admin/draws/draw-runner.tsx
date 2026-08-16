"use client";

import { useState, useTransition } from "react";
import { runDraw, type DrawRunResult } from "./actions";

function thisMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function DrawRunner() {
  const [month, setMonth] = useState(thisMonthISO());
  const [drawType, setDrawType] = useState<"random" | "algorithmic">("random");
  const [weighting, setWeighting] = useState<"favor_rare" | "favor_common">("favor_rare");
  const [fee, setFee] = useState("");

  const [preview, setPreview] = useState<DrawRunResult | null>(null);
  const [publishResult, setPublishResult] = useState<DrawRunResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function buildParams(mode: "simulate" | "publish") {
    return {
      mode,
      month,
      draw_type: drawType,
      ...(drawType === "algorithmic" ? { algorithm_weighting: weighting } : {}),
      ...(fee ? { subscription_fee: Number(fee) } : {}),
    };
  }

  function handleSimulate() {
    setPublishResult(null);
    startTransition(async () => {
      const res = await runDraw(buildParams("simulate"));
      setPreview(res);
    });
  }

  function handlePublish() {
    startTransition(async () => {
      const res = await runDraw(buildParams("publish"));
      setPublishResult(res);
      if (res.ok) setPreview(null);
    });
  }

  return (
    <div className="panel space-y-5 p-5">
      <h2 className="font-display text-lg italic text-paper">Configure &amp; run</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-paper/60">Draw month</label>
          <input
            type="date"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input w-full"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-paper/60">Draw type</label>
          <select
            value={drawType}
            onChange={(e) => setDrawType(e.target.value as any)}
            className="input w-full"
          >
            <option value="random">Random</option>
            <option value="algorithmic">Algorithmic</option>
          </select>
        </div>

        {drawType === "algorithmic" && (
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-paper/60">
              Weighting
              <span className="ml-1 text-paper/40">
                — see README §3.2: default favors rare scores to protect the pool from being gamed
              </span>
            </label>
            <select
              value={weighting}
              onChange={(e) => setWeighting(e.target.value as any)}
              className="input w-full"
            >
              <option value="favor_rare">Favor rare scores (default — protects jackpot)</option>
              <option value="favor_common">Favor common scores (more 3/4-tier winners)</option>
            </select>
          </div>
        )}

        <div className="col-span-2">
          <label className="mb-1 block text-xs text-paper/60">
            Subscription fee override <span className="text-paper/40">(optional — defaults to $25 placeholder)</span>
          </label>
          <input
            type="number"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="25"
            className="input w-full"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={handleSimulate} disabled={isPending} className="btn-ghost">
          {isPending ? "Working…" : "Simulate"}
        </button>
        <button
          onClick={handlePublish}
          disabled={isPending || !preview?.ok}
          className="btn-primary"
          title={!preview?.ok ? "Run a successful simulation first" : undefined}
        >
          Publish results
        </button>
      </div>

      {preview && (
        <div className={`rounded-card border p-4 text-sm ${preview.ok ? "border-fairway/40" : "border-flag/40"}`}>
          <p className="mb-2 font-mono text-xs uppercase tracking-wide text-paper/50">
            {preview.ok ? "Simulation preview (not saved)" : `Simulation failed (${preview.status})`}
          </p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-paper/80">
            {JSON.stringify(preview.body, null, 2)}
          </pre>
        </div>
      )}

      {publishResult && (
        <div className={`rounded-card border p-4 text-sm ${publishResult.ok ? "border-fairway/40" : "border-flag/40"}`}>
          <p className="font-mono text-xs uppercase tracking-wide text-paper/50">
            {publishResult.ok
              ? "Published."
              : publishResult.status === 409
              ? "Already published for this month/type."
              : `Publish failed (${publishResult.status})`}
          </p>
        </div>
      )}
    </div>
  );
}
