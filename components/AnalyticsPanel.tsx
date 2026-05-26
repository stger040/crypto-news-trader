"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { Analytics } from "@/lib/types";

export function AnalyticsPanel({ analytics }: { analytics: Analytics }) {
  const chartData = analytics.monthlyPnl.length
    ? analytics.monthlyPnl
    : [{ month: "—", pnl: 0 }];

  return (
    <div className="rounded border border-terminal-border bg-terminal-panel p-4">
      <h2 className="font-serif text-lg text-terminal-accent">Analytics</h2>
      <p className="text-xs text-terminal-muted">
        Updated {new Date(analytics.updatedAt).toLocaleString()}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Win Rate" value={`${(analytics.winRate * 100).toFixed(1)}%`} />
        <Stat
          label="Avg Return"
          value={`${analytics.avgReturnPct.toFixed(2)}%`}
        />
        <Stat label="Sharpe" value={analytics.sharpeRatio.toFixed(2)} />
        <Stat label="Trades" value={String(analytics.totalTrades)} />
      </div>

      <div className="mt-6 h-48">
        <p className="mb-2 text-xs uppercase text-terminal-muted">Monthly P&L</p>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis
              dataKey="month"
              tick={{ fill: "#6b7d8f", fontSize: 10 }}
              axisLine={{ stroke: "#1e2a3a" }}
            />
            <YAxis
              tick={{ fill: "#6b7d8f", fontSize: 10 }}
              axisLine={{ stroke: "#1e2a3a" }}
            />
            <Tooltip
              contentStyle={{
                background: "#111820",
                border: "1px solid #1e2a3a",
                fontSize: 12,
              }}
            />
            <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={entry.pnl >= 0 ? "#3dd68c" : "#f07178"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-terminal-border/60 bg-black/20 p-3">
      <p className="text-xs uppercase text-terminal-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-terminal-accent">
        {value}
      </p>
    </div>
  );
}
