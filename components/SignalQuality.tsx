"use client";

import type { SignalQualityStats, CategoryStats } from "@/lib/types";

export function SignalQuality({
  stats,
  categories,
}: {
  stats: SignalQualityStats;
  categories: CategoryStats[];
}) {
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-900/80 p-5">
      <h2 className="text-lg font-semibold text-amber-accent">Signal Quality</h2>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat
          label="Confirmation rate"
          value={`${(stats.confirmationRate * 100).toFixed(0)}%`}
        />
        <MiniStat
          label="Funding filter hits"
          value={`${(stats.fundingSkipRate * 100).toFixed(0)}%`}
        />
        <MiniStat
          label="Avg velocity (7d)"
          value={stats.avgVelocityThisWeek.toFixed(2)}
        />
        <MiniStat
          label="Max velocity (7d)"
          value={stats.maxVelocityThisWeek.toFixed(2)}
        />
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs uppercase text-slate-500">Category win rates</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-500 uppercase">
                <th className="py-1 pr-2">Category</th>
                <th className="py-1 pr-2">Trades</th>
                <th className="py-1 pr-2">Win %</th>
                <th className="py-1 pr-2">Avg P&L</th>
                <th className="py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-slate-500">
                    No closed trades yet
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.category} className="border-t border-navy-800/60">
                    <td className="py-1.5 pr-2">{c.category}</td>
                    <td className="py-1.5 pr-2">{c.totalTrades}</td>
                    <td
                      className={`py-1.5 pr-2 ${
                        c.isReliable && c.winRate < 0.4
                          ? "text-red-400"
                          : "text-slate-300"
                      }`}
                    >
                      {(c.winRate * 100).toFixed(1)}%
                    </td>
                    <td className="py-1.5 pr-2 font-mono">
                      ${c.avgPnlUsd.toFixed(2)}
                    </td>
                    <td className="py-1.5 text-slate-500">
                      {!c.isReliable
                        ? "insufficient data"
                        : c.winRate < 0.4
                          ? "underperforming"
                          : "ok"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-navy-700 bg-navy-950/50 p-2">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-amber-accent">{value}</p>
    </div>
  );
}
