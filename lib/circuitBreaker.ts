import {
  getCircuitBreakerState,
  getPortfolioSnapshot24hAgo,
  getPortfolioSnapshot7dAgo,
  getRecentRegimeSnapshots,
  updateCircuitBreakerState,
} from "./db";
import { computePortfolioSnapshot } from "./portfolio";
import { getCurrentRegime } from "./regime";
import { notify } from "./notify";
import type { CircuitBreakerStatus } from "./types";

export async function checkCircuitBreaker(): Promise<CircuitBreakerStatus> {
  const state = await getCircuitBreakerState();
  const portfolio = await computePortfolioSnapshot();
  const currentValue = portfolio.total_value_usd;

  let dailyHaltUntil = state?.daily_halt_until
    ? new Date(state.daily_halt_until)
    : null;
  let weeklyHaltUntil = state?.weekly_halt_until
    ? new Date(state.weekly_halt_until)
    : null;
  let macroHaltActive = state?.macro_halt_active ?? false;
  const hwm = Number(state?.portfolio_high_water_mark ?? 10000);

  const now = new Date();

  if (dailyHaltUntil && dailyHaltUntil <= now) dailyHaltUntil = null;
  if (weeklyHaltUntil && weeklyHaltUntil <= now) weeklyHaltUntil = null;

  const regime = await getCurrentRegime();
  if (regime === "bull") macroHaltActive = false;

  const newHwm = Math.max(hwm, currentValue);

  const snapshot24h = await getPortfolioSnapshot24hAgo();
  if (snapshot24h?.total_value_usd) {
    const prior = Number(snapshot24h.total_value_usd);
    const dailyChangePct = ((currentValue - prior) / prior) * 100;
    if (dailyChangePct < -5 && (!dailyHaltUntil || dailyHaltUntil <= now)) {
      dailyHaltUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await notify(
        "Circuit Breaker",
        `⛔ Daily circuit breaker triggered — ${dailyChangePct.toFixed(1)}% today. No new entries for 24h.`
      );
    }
  }

  const snapshot7d = await getPortfolioSnapshot7dAgo();
  if (snapshot7d?.total_value_usd) {
    const prior = Number(snapshot7d.total_value_usd);
    const weeklyChangePct = ((currentValue - prior) / prior) * 100;
    if (weeklyChangePct < -15 && (!weeklyHaltUntil || weeklyHaltUntil <= now)) {
      weeklyHaltUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await notify(
        "Circuit Breaker",
        `⛔ Weekly circuit breaker — ${weeklyChangePct.toFixed(1)}% this week. No new entries for 7 days.`
      );
    }
  }

  const recentRegimes = await getRecentRegimeSnapshots(2);
  const macroCondition =
    regime === "bear" &&
    recentRegimes.length >= 2 &&
    recentRegimes.every(
      (r) =>
        r.btc_vs_200d_sma != null && Number(r.btc_vs_200d_sma) < -0.2
    );

  if (macroCondition && !macroHaltActive) {
    macroHaltActive = true;
    await notify(
      "Macro Halt",
      "🐻 Macro halt active — BTC -20% below 200d SMA. Only F&G DCA running."
    );
  }

  await updateCircuitBreakerState({
    daily_halt_until: dailyHaltUntil,
    weekly_halt_until: weeklyHaltUntil,
    macro_halt_active: macroHaltActive,
    portfolio_high_water_mark: newHwm,
  });

  if (dailyHaltUntil && dailyHaltUntil > now) {
    return {
      halted: true,
      reason: "Daily portfolio drop exceeded 5%",
      haltType: "daily",
      haltUntil: dailyHaltUntil,
    };
  }

  if (weeklyHaltUntil && weeklyHaltUntil > now) {
    return {
      halted: true,
      reason: "Weekly portfolio drop exceeded 15%",
      haltType: "weekly",
      haltUntil: weeklyHaltUntil,
    };
  }

  if (macroHaltActive) {
    return {
      halted: false,
      reason: "Macro bear halt — DCA only",
      haltType: "macro",
      haltUntil: null,
    };
  }

  return {
    halted: false,
    reason: null,
    haltType: null,
    haltUntil: null,
  };
}

export async function isHalted(): Promise<boolean> {
  const state = await getCircuitBreakerState();
  const now = new Date();
  const daily = state?.daily_halt_until
    ? new Date(state.daily_halt_until) > now
    : false;
  const weekly = state?.weekly_halt_until
    ? new Date(state.weekly_halt_until) > now
    : false;
  return daily || weekly;
}

export async function getCircuitBreakerDashboardStatus(): Promise<{
  active: boolean;
  type: string | null;
  macroHaltActive: boolean;
}> {
  const state = await getCircuitBreakerState();
  const now = new Date();
  if (state?.daily_halt_until && new Date(state.daily_halt_until) > now) {
    return { active: true, type: "daily", macroHaltActive: false };
  }
  if (state?.weekly_halt_until && new Date(state.weekly_halt_until) > now) {
    return { active: true, type: "weekly", macroHaltActive: false };
  }
  if (state?.macro_halt_active) {
    return { active: false, type: "macro", macroHaltActive: true };
  }
  return { active: false, type: null, macroHaltActive: false };
}
