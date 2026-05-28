"use client";

import { useCallback, useEffect, useState } from "react";
import { Newspaper, RefreshCw } from "lucide-react";
import { NewsFeed } from "./NewsFeed";
import { SentimentGauge } from "./SentimentGauge";
import { StrategiesPanel } from "./StrategiesPanel";
import { OpenPositions } from "./OpenPositions";
import { TradeHistory } from "./TradeHistory";
import { Analytics } from "./Analytics";
import { BotHealth } from "./BotHealth";
import { ForceTestRun } from "./ForceTestRun";
import { SignalQuality } from "./SignalQuality";
import { RegimeIndicator } from "./RegimeIndicator";
import { PortfolioProgress } from "./PortfolioProgress";
import type {
  AnalyticsSummary,
  BotHealthStatus,
  CategoryStats,
  NewsArticle,
  NewsArticleMeta,
  Position,
  PositionWithPnL,
  SentimentSnapshot,
  SignalQualityStats,
  StrategyPanelStatus,
  RegimeStatus,
} from "@/lib/types";

interface DashboardData {
  news: NewsArticle[];
  articleMeta: Record<number, NewsArticleMeta>;
  sentiment: SentimentSnapshot | null;
  strategies: StrategyPanelStatus[];
  positions: PositionWithPnL[];
  trades: Position[];
  analytics: AnalyticsSummary;
  portfolio: {
    total_value_usd: number;
    cash_usd: number;
    positions_value_usd: number;
  };
  signalQuality: SignalQualityStats;
  categoryStats: CategoryStats[];
  health: BotHealthStatus;
  regimeStatus: RegimeStatus | null;
  liveTrading: boolean;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const health = data?.health ?? {
    status: "yellow" as const,
    message: "Loading…",
    lastCronAt: null,
  };

  return (
    <div className="min-h-screen bg-navy-950">
      <header className="border-b border-navy-800 bg-navy-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Newspaper className="h-7 w-7 text-amber-accent" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Crypto News Trader
              </h1>
              <p className="text-xs text-slate-500">
                Neon PostgreSQL · Kraken · Paper mode
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {data && (
              <div className="text-right">
                <p className="text-xs text-slate-500">Portfolio</p>
                <p className="text-lg font-bold tabular-nums text-white">
                  ${data.portfolio.total_value_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            )}
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                data?.liveTrading
                  ? "bg-red-500/20 text-red-400"
                  : "bg-emerald-500/20 text-emerald-400"
              }`}
            >
              {data?.liveTrading ? "Live" : "Paper"}
            </span>
            <BotHealth health={health} />
            <button
              onClick={load}
              className="rounded-lg border border-navy-700 p-2 hover:bg-navy-800"
            >
              <RefreshCw className="h-4 w-4 text-slate-400" />
            </button>
            <ForceTestRun />
          </div>
        </div>
      </header>

      {error && (
        <p className="mx-auto max-w-7xl px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      <main className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-12">
        <div className="lg:col-span-12">
          <RegimeIndicator status={data?.regimeStatus ?? null} />
        </div>
        <div className="lg:col-span-5">
          <NewsFeed
            articles={data?.news ?? []}
            meta={data?.articleMeta ?? {}}
          />
        </div>
        <div className="space-y-4 lg:col-span-4">
          <SentimentGauge snapshot={data?.sentiment ?? null} />
          <StrategiesPanel strategies={data?.strategies ?? []} />
        </div>
        <div className="lg:col-span-3">
          <Analytics
            data={
              data?.analytics ?? {
                winRate: 0,
                avgReturnPct: 0,
                monthlyPnl: [],
                sharpeRatio: 0,
                totalTrades: 0,
                totalFees: 0,
                monthlyTargetPct: 9,
                onTrack: false,
                sortinoRatio: 0,
                profitFactor: 0,
                benchmark: {
                  botReturnPct: 0,
                  btcReturnPct: 0,
                  excessReturnPct: 0,
                  highWaterMark: 10000,
                  currentDrawdownPct: 0,
                },
                rollingMetrics: [],
                regimeAttribution: [],
                healthInterpretation: "Loading…",
              }
            }
          />
        </div>
        <div className="lg:col-span-12">
          <PortfolioProgress
            data={
              data?.analytics ?? {
                winRate: 0,
                avgReturnPct: 0,
                monthlyPnl: [],
                sharpeRatio: 0,
                sortinoRatio: 0,
                profitFactor: 0,
                totalTrades: 0,
                totalFees: 0,
                monthlyTargetPct: 9,
                onTrack: false,
                benchmark: {
                  botReturnPct: 0,
                  btcReturnPct: 0,
                  excessReturnPct: 0,
                  highWaterMark: 10000,
                  currentDrawdownPct: 0,
                },
                rollingMetrics: [],
                regimeAttribution: [],
                healthInterpretation: "Loading…",
              }
            }
          />
        </div>
        <div className="lg:col-span-12">
          <SignalQuality
            stats={
              data?.signalQuality ?? {
                confirmationRate: 0,
                fundingSkipRate: 0,
                avgVelocityThisWeek: 0,
                maxVelocityThisWeek: 0,
              }
            }
            categories={data?.categoryStats ?? []}
          />
        </div>
        <div className="lg:col-span-12">
          <OpenPositions positions={data?.positions ?? []} />
        </div>
        <div className="lg:col-span-12">
          <TradeHistory trades={data?.trades ?? []} />
        </div>
      </main>

      <footer className="border-t border-navy-800 py-3 text-center text-xs text-slate-600">
        Cron every 5 min · Target 9% net monthly · Not financial advice
      </footer>
    </div>
  );
}
