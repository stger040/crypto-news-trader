import { getJson, setJson } from "./redis";
import type {
  CryptoPanicPost,
  ExchangeListing,
  FearAndGreedData,
  RedditPost,
  TradingPair,
} from "./types";

const CACHE = {
  cryptopanic: 60,
  fearGreed: 3600,
  reddit: 300,
  listings: 120,
} as const;

function cacheKey(name: string, id: string): string {
  return `cache:${name}:${id}`;
}

export async function fetchCryptoPanicNews(
  pairs: TradingPair[]
): Promise<CryptoPanicPost[]> {
  const currencies = pairs.join(",");
  const ck = cacheKey("cryptopanic", currencies);
  const cached = await getJson<CryptoPanicPost[]>(ck);
  if (cached) return cached;

  const token = process.env.CRYPTOPANIC_API_KEY;
  if (!token) {
    console.warn("CRYPTOPANIC_API_KEY not set");
    return [];
  }

  const params = new URLSearchParams({
    auth_token: token,
    currencies,
    filter: "important",
    public: "true",
  });

  const res = await fetch(
    `https://cryptopanic.com/api/v1/posts/?${params.toString()}`,
    { next: { revalidate: 0 } }
  );

  if (!res.ok) {
    throw new Error(`CryptoPanic API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    results?: Array<{
      id: number | string;
      title: string;
      url: string;
      source?: { title?: string };
      published_at: string;
      votes?: {
        positive?: number;
        negative?: number;
        important?: number;
      };
    }>;
  };

  const posts: CryptoPanicPost[] = (data.results ?? []).map((r) => ({
    id: String(r.id),
    title: r.title,
    url: r.url,
    source: r.source?.title ?? "Unknown",
    published_at: r.published_at,
    votes: {
      positive: r.votes?.positive ?? 0,
      negative: r.votes?.negative ?? 0,
      important: r.votes?.important ?? 0,
    },
  }));

  await setJson(ck, posts, CACHE.cryptopanic);
  return posts;
}

export async function fetchFearAndGreed(): Promise<FearAndGreedData> {
  const ck = cacheKey("fng", "latest");
  const cached = await getJson<FearAndGreedData>(ck);
  if (cached) return cached;

  const res = await fetch("https://api.alternative.me/fng/?limit=2", {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Fear & Greed API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    data?: Array<{ value: string; value_classification: string }>;
  };

  const items = data.data ?? [];
  const today = parseInt(items[0]?.value ?? "50", 10);
  const yesterday = parseInt(items[1]?.value ?? String(today), 10);

  const result: FearAndGreedData = {
    value: today,
    classification: items[0]?.value_classification ?? "Neutral",
    previousValue: yesterday,
    change: today - yesterday,
  };

  await setJson(ck, result, CACHE.fearGreed);
  return result;
}

export async function fetchRedditSentiment(
  subreddit: string
): Promise<RedditPost[]> {
  const ck = cacheKey("reddit", subreddit);
  const cached = await getJson<RedditPost[]>(ck);
  if (cached) return cached;

  const res = await fetch(
    `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
    {
      headers: { "User-Agent": "news-crypto-bot/1.0" },
      next: { revalidate: 0 },
    }
  );

  if (!res.ok) {
    throw new Error(`Reddit API error for r/${subreddit}: ${res.status}`);
  }

  const data = (await res.json()) as {
    data?: {
      children?: Array<{
        data?: {
          title?: string;
          score?: number;
          upvote_ratio?: number;
          num_comments?: number;
          created_utc?: number;
        };
      }>;
    };
  };

  const posts: RedditPost[] = (data.data?.children ?? [])
    .map((c) => c.data)
    .filter(Boolean)
    .map((d) => ({
      title: d!.title ?? "",
      score: d!.score ?? 0,
      upvote_ratio: d!.upvote_ratio ?? 0,
      num_comments: d!.num_comments ?? 0,
      created_utc: d!.created_utc ?? 0,
    }));

  await setJson(ck, posts, CACHE.reddit);
  return posts;
}

async function fetchRssItems(
  url: string,
  exchange: string
): Promise<ExchangeListing[]> {
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return [];

  const xml = await res.text();
  const items: ExchangeListing[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < 15) {
    const block = match[1];
    const title =
      block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i)?.[1] ??
      block.match(/<title>(.*?)<\/title>/i)?.[1] ??
      "";
    const link =
      block.match(/<link>(.*?)<\/link>/i)?.[1] ??
      block.match(/<guid[^>]*>(.*?)<\/guid>/i)?.[1] ??
      "";
    const pubDate =
      block.match(/<pubDate>(.*?)<\/pubDate>/i)?.[1] ??
      new Date().toISOString();

    if (title) {
      items.push({
        exchange,
        title: title.trim(),
        url: link.trim(),
        published_at: new Date(pubDate).toISOString(),
      });
    }
  }

  return items;
}

export async function fetchExchangeListings(): Promise<ExchangeListing[]> {
  const ck = cacheKey("listings", "all");
  const cached = await getJson<ExchangeListing[]>(ck);
  if (cached) return cached;

  const [binance, coinbase] = await Promise.all([
    fetchRssItems(
      "https://www.binance.com/en/support/announcement/rss",
      "Binance"
    ),
    fetchRssItems("https://www.coinbase.com/blog/rss.xml", "Coinbase"),
  ]);

  const combined = [...binance, ...coinbase].sort(
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );

  await setJson(ck, combined, CACHE.listings);
  return combined;
}

export async function fetchAllDataSources(pairs: TradingPair[]) {
  const redditResults = await Promise.all(
    ["CryptoCurrency", "Bitcoin", "ethereum"].map((s) =>
      fetchRedditSentiment(s).catch(() => [] as RedditPost[])
    )
  );

  const [news, fearGreed, listings] = await Promise.all([
    fetchCryptoPanicNews(pairs),
    fetchFearAndGreed(),
    fetchExchangeListings(),
  ]);

  return {
    news,
    fearGreed,
    reddit: redditResults.flat(),
    listings,
  };
}
