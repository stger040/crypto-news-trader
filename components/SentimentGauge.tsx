"use client";

import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { FearAndGreedData } from "@/lib/types";

export function SentimentGauge({ data }: { data: FearAndGreedData | null }) {
  if (!data) {
    return (
      <div className="rounded border border-terminal-border bg-terminal-panel p-6">
        <h2 className="font-serif text-lg text-terminal-accent">Sentiment Gauge</h2>
        <p className="mt-4 text-sm text-terminal-muted">Fear & Greed unavailable</p>
      </div>
    );
  }

  const pct = data.value;
  const ChangeIcon =
    data.change > 0 ? TrendingUp : data.change < 0 ? TrendingDown : Minus;
  const changeColor =
    data.change > 0
      ? "text-terminal-green"
      : data.change < 0
        ? "text-terminal-red"
        : "text-terminal-muted";

  let gaugeColor = "from-yellow-500 to-orange-500";
  if (pct <= 25) gaugeColor = "from-red-600 to-red-400";
  else if (pct >= 75) gaugeColor = "from-green-600 to-green-400";

  return (
    <div className="rounded border border-terminal-border bg-terminal-panel p-6">
      <h2 className="font-serif text-lg text-terminal-accent">Sentiment Gauge</h2>
      <p className="text-xs text-terminal-muted">Fear & Greed Index</p>

      <div className="mt-6 flex items-end gap-6">
        <div className="text-5xl font-bold tabular-nums">{data.value}</div>
        <div>
          <p className="text-sm uppercase tracking-wide text-terminal-muted">
            {data.classification}
          </p>
          <div className={`mt-1 flex items-center gap-1 text-sm ${changeColor}`}>
            <ChangeIcon className="h-4 w-4" />
            <span>
              {data.change > 0 ? "+" : ""}
              {data.change} vs yesterday ({data.previousValue})
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-terminal-border">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gaugeColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] uppercase text-terminal-muted">
        <span>Extreme Fear</span>
        <span>Extreme Greed</span>
      </div>
    </div>
  );
}
