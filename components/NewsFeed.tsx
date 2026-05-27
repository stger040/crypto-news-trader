"use client";

import type { NewsArticle, NewsArticleMeta } from "@/lib/types";

const SOURCE_COLORS: Record<string, string> = {
  cointelegraph: "bg-orange-500/20 text-orange-300",
  coindesk: "bg-blue-500/20 text-blue-300",
  decrypt: "bg-purple-500/20 text-purple-300",
  "crypto.news": "bg-teal-500/20 text-teal-300",
  bitcoinmagazine: "bg-yellow-500/20 text-yellow-300",
  binance: "bg-amber-500/20 text-amber-300",
  reddit: "bg-red-500/20 text-red-300",
};

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function scoreColor(score: number | null) {
  if (score == null) return "bg-slate-700 text-slate-400";
  if (score >= 0.3) return "bg-emerald-500/20 text-emerald-400";
  if (score <= -0.3) return "bg-red-500/20 text-red-400";
  return "bg-slate-600/40 text-slate-300";
}

export function NewsFeed({
  articles,
  meta,
}: {
  articles: NewsArticle[];
  meta: Record<number, NewsArticleMeta>;
}) {
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-900/80 overflow-hidden">
      <div className="border-b border-navy-700 px-4 py-3">
        <h2 className="text-lg font-semibold text-amber-accent">News Feed</h2>
        <p className="text-xs text-slate-500">Latest 20 articles · RSS + Reddit</p>
      </div>
      <div className="max-h-[480px] overflow-y-auto scrollbar-thin divide-y divide-navy-800">
        {articles.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No articles yet — run cron</p>
        ) : (
          articles.map((a) => {
            const m = meta[a.id];
            return (
              <article key={a.id} className="px-4 py-3 hover:bg-navy-800/40">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] uppercase font-medium ${SOURCE_COLORS[a.source] ?? "bg-slate-700 text-slate-300"}`}
                  >
                    {a.source}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-mono ${scoreColor(a.sentiment_score != null ? Number(a.sentiment_score) : null)}`}
                  >
                    {a.sentiment_score != null
                      ? Number(a.sentiment_score).toFixed(2)
                      : "—"}
                  </span>
                  <span className="text-[10px] text-slate-500">{timeAgo(a.published_at)}</span>
                  <span className="flex gap-1 text-sm" title="Signal metadata">
                    {a.is_syndicated && <span title="Syndicated">🔗</span>}
                    {m?.corroborated && <span title="Corroborated">✅</span>}
                    {m?.velocityHigh && <span title="High velocity">⚡</span>}
                    {m?.triggeredPositionId != null && (
                      <span title={`Trade #${m.triggeredPositionId}`}>💰</span>
                    )}
                  </span>
                </div>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm leading-snug text-slate-200 hover:text-amber-accent"
                >
                  {a.title}
                </a>
                {a.affected_pairs && a.affected_pairs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {a.affected_pairs.map((p) => (
                      <span
                        key={p}
                        className="rounded bg-navy-800 px-1.5 py-0.5 text-[10px] text-slate-400"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
