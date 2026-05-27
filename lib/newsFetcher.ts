import Parser from "rss-parser";
import {
  articleExistsByUrl,
  insertArticle,
  getLastFeedSync,
  updateFeedSync,
  getLatestSentimentSnapshot,
  saveSentimentSnapshot,
  getAvgSentimentHours,
  getDominantCategory24h,
} from "./db";

const RSS_FEEDS: { url: string; source: string }[] = [
  { url: "https://cointelegraph.com/rss", source: "cointelegraph" },
  { url: "https://coindesk.com/arc/outboundfeeds/rss/", source: "coindesk" },
  { url: "https://decrypt.co/feed", source: "decrypt" },
  { url: "https://crypto.news/feed", source: "crypto.news" },
  { url: "https://bitcoinmagazine.com/.rss/full/", source: "bitcoinmagazine" },
  {
    url: "https://www.binance.com/en/support/announcement/rss",
    source: "binance",
  },
];

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "crypto-news-trader-bot/1.0" },
});

export interface FetchResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

async function fetchSingleFeed(
  feedUrl: string,
  source: string
): Promise<{ inserted: number; skipped: number; error?: string }> {
  let inserted = 0;
  let skipped = 0;

  try {
    const feed = await parser.parseURL(feedUrl);
    const cutoff = Date.now() - SIX_HOURS_MS;
    const lastSync = await getLastFeedSync(source);

    for (const item of feed.items ?? []) {
      const url = item.link ?? item.guid;
      const title = item.title?.trim();
      if (!url || !title) {
        skipped++;
        continue;
      }

      const pubDate = item.pubDate ?? item.isoDate ?? new Date().toISOString();
      const publishedAt = new Date(pubDate);
      if (publishedAt.getTime() < cutoff) {
        skipped++;
        continue;
      }

      if (lastSync && publishedAt.getTime() <= lastSync.getTime()) {
        skipped++;
        continue;
      }

      if (await articleExistsByUrl(url)) {
        skipped++;
        continue;
      }

      const row = await insertArticle({
        source,
        title,
        url,
        published_at: publishedAt.toISOString(),
      });

      if (row) inserted++;
      else skipped++;
    }

    await updateFeedSync(source);
    return { inserted, skipped };
  } catch (e) {
    return {
      inserted,
      skipped,
      error: `${source}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export async function fetchRSSFeeds(): Promise<FetchResult> {
  const results = await Promise.all(
    RSS_FEEDS.map((f) => fetchSingleFeed(f.url, f.source))
  );

  return {
    inserted: results.reduce((s, r) => s + r.inserted, 0),
    skipped: results.reduce((s, r) => s + r.skipped, 0),
    errors: results.filter((r) => r.error).map((r) => r.error!),
  };
}

export async function fetchRedditSentiment(): Promise<FetchResult> {
  const subreddits = [
    { url: "https://www.reddit.com/r/cryptocurrency/hot.json?limit=25", source: "reddit-cryptocurrency" },
    { url: "https://www.reddit.com/r/bitcoin/hot.json?limit=10", source: "reddit-bitcoin" },
  ];

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];
  const cutoff = Date.now() - SIX_HOURS_MS;

  for (const { url, source } of subreddits) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "crypto-news-trader-bot/1.0" },
      });
      if (!res.ok) {
        errors.push(`Reddit ${source}: HTTP ${res.status}`);
        continue;
      }

      const data = (await res.json()) as {
        data?: {
          children?: Array<{
            data?: {
              title?: string;
              url?: string;
              permalink?: string;
              score?: number;
              upvote_ratio?: number;
              created_utc?: number;
            };
          }>;
        };
      };

      for (const child of data.data?.children ?? []) {
        const d = child.data;
        if (!d?.title) {
          skipped++;
          continue;
        }

        const score = d.score ?? 0;
        const ratio = d.upvote_ratio ?? 0;
        if (ratio <= 0.6 || score <= 50) {
          skipped++;
          continue;
        }

        const articleUrl = d.url?.startsWith("http")
          ? d.url
          : `https://www.reddit.com${d.permalink ?? ""}`;

        const publishedAt = new Date((d.created_utc ?? 0) * 1000);
        if (publishedAt.getTime() < cutoff) {
          skipped++;
          continue;
        }

        if (await articleExistsByUrl(articleUrl)) {
          skipped++;
          continue;
        }

        const row = await insertArticle({
          source: "reddit",
          title: d.title,
          url: articleUrl,
          published_at: publishedAt.toISOString(),
        });

        if (row) inserted++;
        else skipped++;
      }

      await updateFeedSync(source);
    } catch (e) {
      errors.push(`Reddit ${source}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { inserted, skipped, errors };
}

export interface FearGreedResult {
  value: number;
  label: string;
  cached: boolean;
}

export async function fetchFearAndGreed(): Promise<FearGreedResult> {
  const latest = await getLatestSentimentSnapshot();
  if (latest?.captured_at) {
    const age = Date.now() - new Date(latest.captured_at).getTime();
    if (age < 3600000 && latest.fear_greed_value != null) {
      return {
        value: latest.fear_greed_value,
        label: latest.fear_greed_label ?? "Unknown",
        cached: true,
      };
    }
  }

  const res = await fetch("https://api.alternative.me/fng/?limit=2");
  if (!res.ok) throw new Error(`Fear & Greed API: ${res.status}`);

  const data = (await res.json()) as {
    data?: Array<{ value: string; value_classification: string }>;
  };

  const today = parseInt(data.data?.[0]?.value ?? "50", 10);
  const label = data.data?.[0]?.value_classification ?? "Neutral";

  const [h1, h6, h24] = await Promise.all([
    getAvgSentimentHours(1),
    getAvgSentimentHours(6),
    getAvgSentimentHours(24),
  ]);

  const dominant = await getDominantCategory24h();

  await saveSentimentSnapshot({
    avg_score_1h: h1.avg,
    avg_score_6h: h6.avg,
    avg_score_24h: h24.avg,
    fear_greed_value: today,
    fear_greed_label: label,
    article_count_24h: h24.count,
    dominant_category: dominant,
  });

  return { value: today, label, cached: false };
}
