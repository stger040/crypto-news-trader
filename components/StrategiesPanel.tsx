"use client";

import { Zap, Clock, Shield } from "lucide-react";
import type { StrategyPanelStatus } from "@/lib/types";

const ICONS: Record<string, typeof Zap> = {
  momentum: Zap,
  sentimentMomentum: Clock,
  fearGreed: Shield,
};

export function StrategiesPanel({
  strategies,
}: {
  strategies: StrategyPanelStatus[];
}) {
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-900/80 p-4">
      <h2 className="text-lg font-semibold text-amber-accent">Strategies</h2>
      <div className="mt-4 space-y-3">
        {strategies.map((s) => {
          const Icon = ICONS[s.id] ?? Zap;
          return (
            <div
              key={s.id}
              className="rounded-lg border border-navy-700 bg-navy-950/50 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-amber-accent" />
                  <span className="text-sm font-medium">{s.name}</span>
                </div>
                <span className="text-xs uppercase text-slate-400">{s.status}</span>
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>
                  Last signal:{" "}
                  {s.lastSignalAt
                    ? new Date(s.lastSignalAt).toLocaleString()
                    : "—"}
                </span>
                <span>Today: {s.positionsToday}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
