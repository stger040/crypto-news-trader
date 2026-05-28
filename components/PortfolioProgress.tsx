"use client";

import type { AnalyticsSummary } from "@/lib/types";

function pctColor(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-slate-300";
}

function sortinoColor(value: number): string {
  if (value > 1) return "text-emerald-400";
  if (value >= 0) return "text-amber-400";
  return "text-red-400";
}

function pfColor(value: number): string {
  if (value > 1.5) return "text-emerald-400";
  if (value >= 1) return "text-amber-400";
  return "text-red-400";
}

export function PortfolioProgress({ data }: { data: AnalyticsSummary }) {
  const { benchmark, rollingMetrics, regimeAttribution } = data;

  return (
    <div className="rounded-xl border border-navy-700 bg-navy-900/80 p-5">
      <h2 className="text-lg font-semibold text-amber-accent">
        Portfolio Progress &amp; Benchmarking
      </h2>

      <section className="mt-5">
        <h3 className="text-xs uppercase text-slate-500">
          Performance vs Benchmark
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-navy-700 bg-navy-950/50 p-4 text-center">
            <p className="text-xs text-slate-500">Bot Return</p>
            <p
              className={`mt-1 text-3xl font-bold tabular-nums ${pctColor(benchmark.botReturnPct)}`}
            >
              {benchmark.botReturnPct >= 0 ? "+" : ""}
              {benchmark.botReturnPct.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg border border-navy-700 bg-navy-950/50 p-4 text-center">
            <p className="text-xs text-slate-500">BTC Return</p>
            <p
              className={`mt-1 text-3xl font-bold tabular-nums ${pctColor(benchmark.btcReturnPct)}`}
            >
              {benchmark.btcReturnPct >= 0 ? "+" : ""}
              {benchmark.btcReturnPct.toFixed(1)}%
            </p>
          </div>
        </div>
        <p className={`mt-3 text-center text-lg font-semibold ${pctColor(benchmark.excessReturnPct)}`}>
          Excess Return: {benchmark.excessReturnPct >= 0 ? "+" : ""}
          {benchmark.excessReturnPct.toFixed(1)}%
        </p>
        <p className="mt-2 text-center text-sm text-slate-400">
          High Water Mark: ${benchmark.highWaterMark.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
          | Current Drawdown: {benchmark.currentDrawdownPct.toFixed(1)}%
        </p>
      </section>

      <section className="mt-6">
        <h3 className="text-xs uppercase text-slate-500">Rolling Performance</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-700 text-left text-slate-500">
                <th className="py-2 pr-4">Period</th>
                <th className="py-2 pr-4">Sharpe</th>
                <th className="py-2 pr-4">Sortino</th>
                <th className="py-2">Trades</th>
              </tr>
            </thead>
            <tbody>
              {rollingMetrics.map((row) => (
                <tr key={row.periodDays} className="border-b border-navy-800">
                  <td className="py-2 pr-4 text-slate-300">{row.periodDays} days</td>
                  <td className="py-2 pr-4 tabular-nums text-slate-200">
                    {row.sharpe.toFixed(2)}
                  </td>
                  <td className={`py-2 pr-4 tabular-nums font-medium ${sortinoColor(row.sortino)}`}>
                    {Number.isFinite(row.sortino) ? row.sortino.toFixed(2) : "∞"}
                  </td>
                  <td className="py-2 tabular-nums text-slate-200">{row.tradeCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-xs uppercase text-slate-500">Key Metrics</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Win Rate" value={`${(data.winRate * 100).toFixed(1)}%`} />
          <Metric
            label="Profit Factor"
            value={Number.isFinite(data.profitFactor) ? data.profitFactor.toFixed(2) : "∞"}
            valueClass={pfColor(data.profitFactor)}
          />
          <Metric label="Total Fees" value={`$${data.totalFees.toFixed(2)}`} />
          <Metric label="Avg Return/Trade" value={`${data.avgReturnPct.toFixed(2)}%`} />
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-xs uppercase text-slate-500">Regime Attribution</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-700 text-left text-slate-500">
                <th className="py-2 pr-4">Regime</th>
                <th className="py-2 pr-4">Trades</th>
                <th className="py-2 pr-4">Win Rate</th>
                <th className="py-2 pr-4">Profit Factor</th>
                <th className="py-2">Total P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {regimeAttribution
                .filter((r) => r.regime !== "unknown")
                .map((row) => (
                  <tr key={row.regime} className="border-b border-navy-800">
                    <td className="py-2 pr-4 capitalize text-slate-300">{row.regime}</td>
                    <td className="py-2 pr-4 text-slate-200">
                      {!row.isReliable ? (
                        <span className="text-xs text-slate-500">
                          {row.tradeCount} — Insufficient data (&lt; 10 trades)
                        </span>
                      ) : (
                        row.tradeCount
                      )}
                    </td>
                    <td className="py-2 pr-4 tabular-nums text-slate-200">
                      {row.isReliable ? `${(row.winRate * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="py-2 pr-4 tabular-nums text-slate-200">
                      {row.isReliable
                        ? Number.isFinite(row.profitFactor)
                          ? row.profitFactor.toFixed(1)
                          : "∞"
                        : "—"}
                    </td>
                    <td
                      className={`py-2 tabular-nums ${pctColor(row.totalPnlUsd)}`}
                    >
                      ${row.totalPnlUsd.toFixed(0)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-navy-700 bg-navy-950/50 p-4">
        <h3 className="text-xs uppercase text-slate-500">Bot Health Interpretation</h3>
        <p className="mt-2 text-sm text-slate-300">{data.healthInterpretation}</p>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  valueClass = "text-amber-accent",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-navy-700 bg-navy-950/50 p-3">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}
