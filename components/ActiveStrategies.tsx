"use client";

import { Zap, Clock, Shield } from "lucide-react";
import type { StrategyStatus } from "@/lib/types";

const icons = {
  breaking_news_momentum: Zap,
  sentiment_momentum: Clock,
  fear_greed_contrarian: Shield,
};

const statusColors = {
  active: "text-terminal-green",
  triggered: "text-terminal-accent",
  waiting: "text-yellow-400",
  idle: "text-terminal-muted",
};

export function ActiveStrategies({
  strategies,
}: {
  strategies: StrategyStatus[];
}) {
  return (
    <div className="rounded border border-terminal-border bg-terminal-panel p-4">
      <h2 className="font-serif text-lg text-terminal-accent">Active Strategies</h2>
      <ul className="mt-4 space-y-3">
        {strategies.map((s) => {
          const Icon = icons[s.id] ?? Zap;
          return (
            <li
              key={s.id}
              className="flex items-start gap-3 rounded border border-terminal-border/60 bg-black/20 p-3"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${statusColors[s.status]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{s.name}</span>
                  <span
                    className={`text-xs uppercase ${statusColors[s.status]}`}
                  >
                    {s.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-terminal-muted">{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
