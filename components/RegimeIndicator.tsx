"use client";

import type { RegimeStatus } from "@/lib/types";

const REGIME_STYLES = {
  bull: { label: "BULL", emoji: "🟢", className: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
  bear: { label: "BEAR", emoji: "🔴", className: "text-red-400 border-red-500/40 bg-red-500/10" },
  neutral: { label: "NEUTRAL", emoji: "🟡", className: "text-amber-400 border-amber-500/40 bg-amber-500/10" },
};

export function RegimeIndicator({ status }: { status: RegimeStatus | null }) {
  if (!status) {
    return (
      <div className="rounded-xl border border-navy-700 bg-navy-900/80 p-4">
        <p className="text-sm text-slate-500">Loading regime…</p>
      </div>
    );
  }

  const style = REGIME_STYLES[status.regime];
  const dominantSignal =
    status.signalsBear >= status.signalsBull
      ? `${status.signalsBear}/6 bear`
      : `${status.signalsBull}/6 bull`;

  const cbLabel = status.circuitBreakerActive
    ? "ACTIVE ⛔"
    : status.macroHaltActive
      ? "MACRO HALT 🐻"
      : "CLEAR ✅";

  const lockedLabel = status.lockedUntil
    ? new Date(status.lockedUntil).toLocaleDateString()
    : "unlocked";

  return (
    <div className="rounded-xl border border-navy-700 bg-navy-900/80 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Market Regime
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div
          className={`rounded-lg border px-4 py-2 text-lg font-bold ${style.className}`}
        >
          {style.label} {style.emoji}
        </div>
        <div className="text-sm text-slate-300">
          <p>
            Regime Age:{" "}
            <span className="font-semibold text-white">
              {status.regimeAgeDays} days
            </span>
          </p>
          <p>
            Signals:{" "}
            <span className="font-semibold text-white">{dominantSignal}</span>
          </p>
          <p>
            Locked until:{" "}
            <span className="font-semibold text-white">{lockedLabel}</span>
          </p>
          <p>
            Circuit Breaker:{" "}
            <span
              className={`font-semibold ${
                status.circuitBreakerActive || status.macroHaltActive
                  ? "text-red-400"
                  : "text-emerald-400"
              }`}
            >
              {cbLabel}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
