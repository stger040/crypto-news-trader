"use client";

import type { Position } from "@/lib/types";

const STRATEGY_LABELS: Record<string, string> = {
  momentum: "News Momentum",
  sentimentMomentum: "Sentiment Daily",
  fearGreed: "F&G Contrarian",
};

export function TradeHistory({ trades }: { trades: Position[] }) {
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-900/80 overflow-hidden">
      <div className="border-b border-navy-700 px-4 py-3">
        <h2 className="text-lg font-semibold text-amber-accent">Trade History</h2>
      </div>
      <div className="max-h-80 overflow-auto scrollbar-thin">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-navy-900">
            <tr className="border-b border-navy-700 text-xs uppercase text-slate-500">
              <th className="px-4 py-2">Pair</th>
              <th className="px-4 py-2">Strategy</th>
              <th className="px-4 py-2">Return</th>
              <th className="px-4 py-2">P&L</th>
              <th className="px-4 py-2">Exit</th>
              <th className="px-4 py-2">Trigger</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No closed trades
                </td>
              </tr>
            ) : (
              trades.map((t) => (
                <tr key={t.id} className="border-b border-navy-800/60">
                  <td className="px-4 py-2">{t.pair}</td>
                  <td className="px-4 py-2 text-xs">
                    {STRATEGY_LABELS[t.strategy] ?? t.strategy}
                  </td>
                  <td
                    className={`px-4 py-2 font-mono ${Number(t.pnl_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {Number(t.pnl_pct ?? 0).toFixed(2)}%
                  </td>
                  <td className="px-4 py-2 font-mono">
                    ${Number(t.pnl_usd ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400">{t.exit_reason}</td>
                  <td className="px-4 py-2 text-xs text-slate-500 max-w-[160px] truncate">
                    {(t.trigger_title ?? "—").slice(0, 40)}
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
