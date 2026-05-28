import { fetchRSSFeeds, fetchRedditSentiment, fetchFearAndGreed } from "./newsFetcher";
import { scoreUnprocessedArticles } from "./sentiment";
import { runMomentumStrategy } from "./strategies/momentum";
import {
  runSentimentMomentumStrategy,
  shouldRunSentimentMomentumDaily,
} from "./strategies/sentimentMomentum";
import { runFearGreedStrategy } from "./strategies/fearGreed";
import { runCapitulationBounceStrategy } from "./strategies/capitulationBounce";
import { manageOpenPositions } from "./positionManager";
import { computePortfolioSnapshot } from "./portfolio";
import { savePortfolioSnapshot, recordCronRun, getLatestRegimeSnapshot } from "./db";
import { detectRegime } from "./regime";
import { checkCircuitBreaker } from "./circuitBreaker";
import type { CronOptions, CronResult, MarketRegime } from "./types";

export async function runCronCycle(
  options: CronOptions = {}
): Promise<CronResult> {
  const start = Date.now();
  const skipReasons: string[] = [];
  const errors: string[] = [];
  let tradesAttempted = 0;
  let tradesExecuted = 0;

  const strategyDecisions: Record<string, unknown> = {};

  try {
    const rss = await fetchRSSFeeds();
    const reddit = await fetchRedditSentiment();
    const articlesFetched = rss.inserted + reddit.inserted;
    errors.push(...rss.errors, ...reddit.errors);

    const articlesScored = await scoreUnprocessedArticles();

    const fng = await fetchFearAndGreed();

    const priorRegimeSnap = await getLatestRegimeSnapshot();
    const priorRegime: MarketRegime = priorRegimeSnap?.regime ?? "neutral";

    const regimeResult = await detectRegime();
    options.regime = regimeResult.regime;
    options.previousRegime = priorRegime;

    strategyDecisions.regime = regimeResult;

    const cbStatus = await checkCircuitBreaker();
    strategyDecisions.circuitBreaker = cbStatus;

    const manageResult = await manageOpenPositions();
    strategyDecisions.positionManagement = manageResult;

    if (cbStatus.halted) {
      skipReasons.push(`circuit_breaker: ${cbStatus.reason}`);
      strategyDecisions.strategiesSkipped = "daily/weekly circuit breaker";

      const capitulation = await runCapitulationBounceStrategy(options);
      strategyDecisions.capitulationBounce = capitulation;
      if (capitulation.action === "open") tradesExecuted++;

      const portfolio = await computePortfolioSnapshot();
      await savePortfolioSnapshot(portfolio);

      const durationMs = Date.now() - start;
      await recordCronRun(true, durationMs);

      return {
        ok: true,
        articlesFetched,
        articlesScored,
        strategyDecisions,
        tradesAttempted,
        tradesExecuted,
        skipReasons,
        errors,
        durationMs,
      };
    }

    if (cbStatus.haltType === "macro") {
      options.macroHalt = true;
    }

    if (!options.macroHalt) {
      const momentum = await runMomentumStrategy(options);
      strategyDecisions.momentum = momentum;
      tradesAttempted += momentum.opened + momentum.skipped.length;
      tradesExecuted += momentum.opened;
      skipReasons.push(...momentum.skipped);
    } else {
      strategyDecisions.momentum = { skipped: "macro_halt" };
      skipReasons.push("macro_halt: momentum blocked");
    }

    if (!options.macroHalt) {
      if (shouldRunSentimentMomentumDaily(new Date(), options.testRun)) {
        const sm = await runSentimentMomentumStrategy(options);
        strategyDecisions.sentimentMomentum = sm;
        if (sm.action === "long" || sm.action === "test_long") tradesExecuted++;
      } else {
        strategyDecisions.sentimentMomentum = { skipped: "Not 00:05 UTC window" };
      }
    } else {
      strategyDecisions.sentimentMomentum = { skipped: "macro_halt" };
      skipReasons.push("macro_halt: sentiment momentum blocked");
    }

    const fg = await runFearGreedStrategy(fng.value, options);
    strategyDecisions.fearGreed = fg;
    if (fg.action === "open") tradesExecuted++;

    const capitulation = await runCapitulationBounceStrategy(options);
    strategyDecisions.capitulationBounce = capitulation;
    if (capitulation.action === "open") tradesExecuted++;

    const portfolio = await computePortfolioSnapshot();
    await savePortfolioSnapshot(portfolio);

    const durationMs = Date.now() - start;
    await recordCronRun(true, durationMs);

    return {
      ok: true,
      articlesFetched,
      articlesScored,
      strategyDecisions,
      tradesAttempted,
      tradesExecuted,
      skipReasons,
      errors,
      durationMs,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    errors.push(err);
    const durationMs = Date.now() - start;
    await recordCronRun(false, durationMs, err);

    return {
      ok: false,
      articlesFetched: 0,
      articlesScored: 0,
      strategyDecisions,
      tradesAttempted,
      tradesExecuted,
      skipReasons,
      errors,
      durationMs,
    };
  }
}
