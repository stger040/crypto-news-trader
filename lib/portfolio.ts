import { getJson, setJson } from "./redis";
import { INITIAL_PORTFOLIO_USD } from "./constants";
import type { PortfolioSnapshot } from "./types";

const PORTFOLIO_KEY = "portfolio:current";
const SNAPSHOTS_KEY = "portfolio:snapshots";

export interface PortfolioState {
  totalUsd: number;
  cashUsd: number;
  initializedAt: string;
}

export async function getPortfolio(): Promise<PortfolioState> {
  const existing = await getJson<PortfolioState>(PORTFOLIO_KEY);
  if (existing) return existing;

  const initial: PortfolioState = {
    totalUsd: INITIAL_PORTFOLIO_USD,
    cashUsd: INITIAL_PORTFOLIO_USD,
    initializedAt: new Date().toISOString(),
  };
  await setJson(PORTFOLIO_KEY, initial);
  return initial;
}

export async function updatePortfolioCash(deltaUsd: number): Promise<PortfolioState> {
  const p = await getPortfolio();
  p.cashUsd = Math.max(0, p.cashUsd + deltaUsd);
  p.totalUsd = p.cashUsd;
  await setJson(PORTFOLIO_KEY, p);
  return p;
}

export async function setPortfolioTotal(
  cashUsd: number,
  positionsValueUsd: number
): Promise<PortfolioState> {
  const p = await getPortfolio();
  p.cashUsd = cashUsd;
  p.totalUsd = cashUsd + positionsValueUsd;
  await setJson(PORTFOLIO_KEY, p);
  return p;
}

export async function savePortfolioSnapshot(
  positionsValueUsd: number,
  dailyPnlUsd: number,
  monthlyPnlUsd: number
): Promise<PortfolioSnapshot> {
  const p = await getPortfolio();
  const snapshot: PortfolioSnapshot = {
    timestamp: new Date().toISOString(),
    totalUsd: p.cashUsd + positionsValueUsd,
    cashUsd: p.cashUsd,
    positionsValueUsd,
    dailyPnlUsd,
    monthlyPnlUsd,
  };

  const history = (await getJson<PortfolioSnapshot[]>(SNAPSHOTS_KEY)) ?? [];
  history.push(snapshot);
  const trimmed = history.slice(-500);
  await setJson(SNAPSHOTS_KEY, trimmed);
  await setJson("portfolio:last_snapshot", snapshot);
  return snapshot;
}
