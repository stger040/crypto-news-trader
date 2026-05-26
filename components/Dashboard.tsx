"use client";

import { useCallback, useEffect, useState } from "react";
import { Newspaper, RefreshCw } from "lucide-react";
import { BotHealthBadge } from "./BotHealth";
import { ForceTestRun } from "./ForceTestRun";
import { NewsFeed } from "./NewsFeed";
import { SentimentGauge } from "./SentimentGauge";
import { ActiveStrategies } from "./ActiveStrategies";
import { OpenPositions } from "./OpenPositions";
import { TradeHistory } from "./TradeHistory";
import { AnalyticsPanel } from "./AnalyticsPanel";
import type {
  PositionPnL,
  Analytics,
  BotHealth,
  ClosedTrade,
  FearAndGreedData,
  ScoredNewsItem,
  StrategyStatus,
} from "@/lib/types";

interface DashboardData {
  news: ScoredNewsItem[];
  fearGreed: FearAndGreedData | null;
  strategies: StrategyStatus[];
  positions: PositionPnL[];
  trades: ClosedTrade[];
  analytics: Analytics;
  portfolio: { totalUsd: number; cashUsd: number };
  health: BotHealth;
  liveTrading: boolean;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-terminal-muted">
        Loading dashboard…
      </div>
    );
  }

  const health = data?.health ?? {
    status: "yellow" as const,
    message: "Connecting…",
  };

  return (
    <div className="min-h-screen bg-terminal-bg">
      <header className="border-b border-terminal-border bg-terminal-panel/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Newspaper className="h-8 w-8 text-terminal-accent" />
            <div>
              <h1 className="font-serif text-2xl tracking-tight text-white">
                News Sentiment Bot
              </h1>
              <p className="text-xs text-terminal-muted">
                Kraken · Paper mode · Redis prefix{" "}
                <code className="text-terminal-accent">news:</code>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {data && (
              <div className="text-right text-sm tabular-nums">
                <span className="text-terminal-muted">Portfolio </span>
                <span className="text-lg font-semibold text-white">
                  ${data.portfolio.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="ml-2 text-xs text-terminal-muted">
                  Cash ${data.portfolio.cashUsd.toFixed(0)}
                </span>
              </div>
            )}
            <span
              className={`rounded px-2 py-0.5 text-xs uppercase ${
                data?.liveTrading
                  ? "bg-terminal-red/20 text-terminal-red"
                  : "bg-terminal-green/20 text-terminal-green"
              }`}
            >
              {data?.liveTrading ? "LIVE" : "PAPER"}
            </span>
            <BotHealthBadge health={health} />
            <button
              onClick={load}
              className="rounded border border-terminal-border p-2 hover:bg-white/5"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <ForceTestRun />
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto max-w-[1600px] px-4 py-2 text-sm text-terminal-red">
          {error}
        </div>
      )}

      <main className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <NewsFeed items={data?.news ?? []} />
        </div>
        <div className="space-y-4 lg:col-span-4">
          <SentimentGauge data={data?.fearGreed ?? null} />
          <ActiveStrategies strategies={data?.strategies ?? []} />
        </div>
        <div className="lg:col-span-3">
          <AnalyticsPanel
            analytics={
              data?.analytics ?? {
                winRate: 0,
                avgReturnPct: 0,
                monthlyPnl: [],
                sharpeRatio: 0,
                totalTrades: 0,
                updatedAt: new Date().toISOString(),
              }
            }
          />
        </div>
        <div className="lg:col-span-12">
          <OpenPositions positions={data?.positions ?? []} />
        </div>
        <div className="lg:col-span-12">
          <TradeHistory trades={data?.trades ?? []} />
        </div>
      </main>

      <footer className="border-t border-terminal-border py-4 text-center text-xs text-terminal-muted">
        Cron every 5 min · Target 9% net monthly · Not financial advice
      </footer>
    </div>
  );
}
