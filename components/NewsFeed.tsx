"use client";

import { ExternalLink } from "lucide-react";
import type { ScoredNewsItem } from "@/lib/types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SentimentBadge({
  score,
  category,
}: {
  score?: number;
  category?: string;
}) {
  if (score === undefined) {
    return (
      <span className="rounded bg-terminal-border px-2 py-0.5 text-xs text-terminal-muted">
        unscored
      </span>
    );
  }

  let label = "neutral";
  let cls = "bg-terminal-border text-terminal-muted";
  if (score >= 0.3) {
    label = "bullish";
    cls = "bg-terminal-green/20 text-terminal-green";
  } else if (score <= -0.3) {
    label = "bearish";
    cls = "bg-terminal-red/20 text-terminal-red";
  }

  return (
    <span className={`rounded px-2 py-0.5 text-xs uppercase ${cls}`}>
      {label}
      {category ? ` · ${category}` : ""}
    </span>
  );
}

export function NewsFeed({ items }: { items: ScoredNewsItem[] }) {
  return (
    <div className="flex h-[420px] flex-col rounded border border-terminal-border bg-terminal-panel">
      <div className="border-b border-terminal-border px-4 py-3">
        <h2 className="font-serif text-lg text-terminal-accent">Live News Feed</h2>
        <p className="text-xs text-terminal-muted">CryptoPanic · important filter</p>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-terminal-muted">No news loaded — run cron cycle</p>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className="border-b border-terminal-border/50 px-4 py-3 hover:bg-white/[0.02]"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <SentimentBadge
                  score={item.sentiment?.score}
                  category={item.sentiment?.category}
                />
                <span className="text-xs text-terminal-muted">
                  {item.source} · {timeAgo(item.published_at)}
                </span>
                <span className="text-xs text-terminal-accent">
                  ▲ {item.votes.important} important
                </span>
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-1 text-sm leading-snug text-gray-200 hover:text-terminal-accent"
              >
                {item.title}
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60" />
              </a>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
