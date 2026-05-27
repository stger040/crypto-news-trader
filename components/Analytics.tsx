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
import type { AnalyticsSummary } from "@/lib/types";

export function Analytics({ data }: { data: AnalyticsSummary }) {
  const chartData = data.monthlyPnl.length
    ? data.monthlyPnl
    : [{ month: "—", pnl: 0 }];

  return (
    <div className="rounded-xl border border-navy-700 bg-navy-900/80 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-amber-accent">Analytics</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            data.onTrack
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          9% target: {data.onTrack ? "ON TRACK" : "BEHIND"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Win Rate" value={`${(data.winRate * 100).toFixed(1)}%`} />
        <Stat label="Avg Return" value={`${data.avgReturnPct.toFixed(2)}%`} />
        <Stat label="Sharpe" value={data.sharpeRatio.toFixed(2)} />
        <Stat label="Trades" value={String(data.totalTrades)} />
        <Stat label="Total Fees" value={`$${data.totalFees.toFixed(2)}`} />
      </div>

      <div className="mt-5 h-44">
        <p className="mb-2 text-xs uppercase text-slate-500">Monthly P&L</p>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} />
            <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid #334155",
                fontSize: 12,
              }}
            />
            <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
              {chartData.map((e, i) => (
                <Cell key={i} fill={e.pnl >= 0 ? "#34d399" : "#f87171"} />
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
    <div className="rounded-lg border border-navy-700 bg-navy-950/50 p-3">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-amber-accent">
        {value}
      </p>
    </div>
  );
}
