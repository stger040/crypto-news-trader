"use client";

import { Activity } from "lucide-react";
import type { BotHealth as BotHealthType } from "@/lib/types";

const colors = {
  green: "bg-terminal-green/20 text-terminal-green border-terminal-green/40",
  yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  red: "bg-terminal-red/20 text-terminal-red border-terminal-red/40",
};

export function BotHealthBadge({ health }: { health: BotHealthType }) {
  return (
    <div
      className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs uppercase tracking-wider ${colors[health.status]}`}
    >
      <Activity className="h-3.5 w-3.5" />
      <span>{health.status}</span>
      <span className="normal-case text-terminal-muted">— {health.message}</span>
    </div>
  );
}
