"use client";

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";

export function ForceTestRun() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMsg(null);
    try {
      const secret = process.env.NEXT_PUBLIC_CRON_SECRET ?? "";
      const res = await fetch("/api/test-run", {
        headers: { "x-test-secret": secret },
      });
      const data = await res.json();
      if (!res.ok) setMsg(`Error: ${data.error}`);
      else
        setMsg(
          `OK ${data.durationMs}ms — fetched ${data.articlesFetched}, scored ${data.articlesScored}, trades ${data.tradesExecuted}`
        );
    } catch (e) {
      setMsg(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-amber-accent/50 bg-amber-accent/10 px-4 py-2 text-sm text-amber-accent hover:bg-amber-accent/20 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Force Test Run
      </button>
      {msg && <p className="mt-1 text-xs text-slate-500">{msg}</p>}
    </div>
  );
}
