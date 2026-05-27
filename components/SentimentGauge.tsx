"use client";

import type { SentimentSnapshot } from "@/lib/types";

export function SentimentGauge({
  snapshot,
}: {
  snapshot: SentimentSnapshot | null;
}) {
  const fng = snapshot?.fear_greed_value ?? 50;
  const label = snapshot?.fear_greed_label ?? "Neutral";
  const avg1h = Number(snapshot?.avg_score_1h ?? 0);
  const avg24h = Number(snapshot?.avg_score_24h ?? 0);

  const fngColor =
    fng <= 25 ? "text-red-400" : fng >= 75 ? "text-emerald-400" : "text-amber-accent";

  return (
    <div className="rounded-xl border border-navy-700 bg-navy-900/80 p-5">
      <h2 className="text-lg font-semibold text-amber-accent">Sentiment Gauge</h2>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs uppercase text-slate-500">Avg 1h</p>
          <Meter value={avg1h} />
          <p className="mt-1 font-mono text-sm">{avg1h.toFixed(3)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Avg 24h</p>
          <Meter value={avg24h} />
          <p className="mt-1 font-mono text-sm">{avg24h.toFixed(3)}</p>
        </div>
      </div>

      <div className="mt-6 border-t border-navy-700 pt-4">
        <p className="text-xs uppercase text-slate-500">Fear & Greed</p>
        <div className="mt-2 flex items-baseline gap-3">
          <span className={`text-4xl font-bold tabular-nums ${fngColor}`}>{fng}</span>
          <span className="text-sm text-slate-400">{label}</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-navy-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
            style={{ width: `${fng}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Meter({ value }: { value: number }) {
  const pct = ((value + 1) / 2) * 100;
  return (
    <div className="mt-1 h-2 rounded-full bg-navy-800">
      <div
        className="h-full rounded-full bg-gradient-to-r from-red-500 via-slate-500 to-emerald-500"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}
