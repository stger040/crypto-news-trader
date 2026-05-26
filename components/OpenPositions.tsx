"use client";

import type { PositionPnL } from "@/lib/types";

const strategyLabels: Record<string, string> = {
  breaking_news_momentum: "News Momentum",
  sentiment_momentum: "Sentiment Daily",
  fear_greed_contrarian: "F&G Contrarian",
};

function formatDuration(ms?: number): string {
  if (ms === undefined) return "—";
  const hrs = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}

export function OpenPositions({ positions }: { positions: PositionPnL[] }) {
  return (
    <div className="rounded border border-terminal-border bg-terminal-panel overflow-hidden">
      <div className="border-b border-terminal-border px-4 py-3">
        <h2 className="font-serif text-lg text-terminal-accent">Open Positions</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-terminal-border text-xs uppercase text-terminal-muted">
              <th className="px-4 py-2">Pair</th>
              <th className="px-4 py-2">Strategy</th>
              <th className="px-4 py-2">Entry</th>
              <th className="px-4 py-2">Current</th>
              <th className="px-4 py-2">P&L</th>
              <th className="px-4 py-2">Time Stop</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-terminal-muted">
                  No open positions
                </td>
              </tr>
            ) : (
              positions.map(({ position, currentPrice, pnlUsd, pnlPct, timeRemainingMs }) => (
                <tr
                  key={position.id}
                  className="border-b border-terminal-border/40 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-2 font-medium">{position.pair}</td>
                  <td className="px-4 py-2 text-xs text-terminal-muted">
                    {strategyLabels[position.strategy] ?? position.strategy}
                  </td>
                  <td className="px-4 py-2 tabular-nums">
                    ${position.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2 tabular-nums">
                    ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td
                    className={`px-4 py-2 tabular-nums ${
                      pnlUsd >= 0 ? "text-terminal-green" : "text-terminal-red"
                    }`}
                  >
                    ${pnlUsd.toFixed(2)} ({pnlPct.toFixed(2)}%)
                  </td>
                  <td className="px-4 py-2 text-xs text-terminal-muted">
                    {position.timeStopAt
                      ? formatDuration(timeRemainingMs)
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
