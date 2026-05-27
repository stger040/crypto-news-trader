import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import {
  getRecentArticles,
  getOpenPositions,
  getLatestSentimentSnapshot,
  getRecentSignals,
  getLatestPortfolioSnapshot,
} from "@/lib/db";
import { computePortfolioSnapshot } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [articles, positions, snapshot, signals, portfolio] =
    await Promise.all([
      getRecentArticles(10),
      getOpenPositions(),
      getLatestSentimentSnapshot(),
      getRecentSignals(5),
      computePortfolioSnapshot(),
    ]);

  return NextResponse.json({
    articles,
    openPositions: positions,
    sentimentSnapshot: snapshot,
    recentSignals: signals,
    portfolio,
  });
}
