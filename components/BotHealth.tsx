"use client";

import { Activity } from "lucide-react";
import type { BotHealthStatus } from "@/lib/types";

const styles = {
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  yellow: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  red: "border-red-500/40 bg-red-500/10 text-red-400",
};

export function BotHealth({ health }: { health: BotHealthStatus }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${styles[health.status]}`}
    >
      <Activity className="h-3.5 w-3.5" />
      <span className="uppercase font-semibold">{health.status}</span>
      <span className="text-slate-400">{health.message}</span>
    </div>
  );
}
