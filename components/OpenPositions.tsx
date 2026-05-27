"use client";

import type { PositionWithPnL } from "@/lib/types";

const STRATEGY_LABELS: Record<string, string> = {
  momentum: "News Momentum",
  sentimentMomentum: "Sentiment Daily",
  fearGreed: "F&G Contrarian",
};

function formatDuration(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function OpenPositions({ positions }: { positions: PositionWithPnL[] }) {
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-900/80 overflow-hidden">
      <div className="border-b border-navy-700 px-4 py-3">
        <h2 className="text-lg font-semibold text-amber-accent">Open Positions</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy-700 text-xs uppercase text-slate-500">
              <th className="px-4 py-2">Pair</th>
              <th className="px-4 py-2">Strategy</th>
              <th className="px-4 py-2">Entry</th>
              <th className="px-4 py-2">Current</th>
              <th className="px-4 py-2">P&L</th>
              <th className="px-4 py-2">Time Open</th>
              <th className="px-4 py-2">Exit Trigger</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No open positions
                </td>
              </tr>
            ) : (
              positions.map(({ position, currentPrice, pnlUsd, pnlPct, timeOpenMs, timeRemainingMs }) => (
                <tr key={position.id} className="border-b border-navy-800/60">
                  <td className="px-4 py-2 font-medium">{position.pair}</td>
                  <td className="px-4 py-2 text-xs text-slate-400">
                    {STRATEGY_LABELS[position.strategy] ?? position.strategy}
                  </td>
                  <td className="px-4 py-2 font-mono">
                    ${Number(position.entry_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2 font-mono">
                    ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td
                    className={`px-4 py-2 font-mono ${pnlUsd >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    ${pnlUsd.toFixed(2)} ({pnlPct.toFixed(2)}%)
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400">
                    {formatDuration(timeOpenMs)}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400">
                    {position.strategy === "momentum"
                      ? timeRemainingMs != null
                        ? `Time: ${formatDuration(timeRemainingMs)}`
                        : "SL/TP"
                      : position.strategy === "fearGreed"
                        ? "F&G ≥ 80"
                        : "24h hold"}
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
