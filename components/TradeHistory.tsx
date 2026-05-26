"use client";

import type { ClosedTrade } from "@/lib/types";

const strategyLabels: Record<string, string> = {
  breaking_news_momentum: "News Momentum",
  sentiment_momentum: "Sentiment Daily",
  fear_greed_contrarian: "F&G Contrarian",
};

export function TradeHistory({ trades }: { trades: ClosedTrade[] }) {
  return (
    <div className="rounded border border-terminal-border bg-terminal-panel overflow-hidden">
      <div className="border-b border-terminal-border px-4 py-3">
        <h2 className="font-serif text-lg text-terminal-accent">Trade History</h2>
      </div>
      <div className="max-h-[320px] overflow-x-auto overflow-y-auto scrollbar-thin">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-terminal-panel">
            <tr className="border-b border-terminal-border text-xs uppercase text-terminal-muted">
              <th className="px-4 py-2">Closed</th>
              <th className="px-4 py-2">Pair</th>
              <th className="px-4 py-2">Strategy</th>
              <th className="px-4 py-2">P&L</th>
              <th className="px-4 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-terminal-muted">
                  No closed trades yet
                </td>
              </tr>
            ) : (
              trades.map((t) => (
                <tr
                  key={`${t.id}-${t.closedAt}`}
                  className="border-b border-terminal-border/40"
                >
                  <td className="px-4 py-2 text-xs text-terminal-muted whitespace-nowrap">
                    {new Date(t.closedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{t.pair}</td>
                  <td className="px-4 py-2 text-xs">
                    {strategyLabels[t.strategy] ?? t.strategy}
                  </td>
                  <td
                    className={`px-4 py-2 tabular-nums ${
                      t.pnlUsd >= 0 ? "text-terminal-green" : "text-terminal-red"
                    }`}
                  >
                    ${t.pnlUsd.toFixed(2)} ({t.pnlPct.toFixed(2)}%)
                  </td>
                  <td className="px-4 py-2 text-xs text-terminal-muted max-w-[200px] truncate">
                    {t.closeReason}
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
