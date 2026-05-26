"use client";

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";

export function ForceTestRun() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleTestRun() {
    setLoading(true);
    setResult(null);
    try {
      const secret = process.env.NEXT_PUBLIC_CRON_SECRET ?? "";
      const res = await fetch(`/api/test-run?secret=${encodeURIComponent(secret)}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error ?? res.statusText}`);
      } else {
        setResult(
          data.ok
            ? `OK (${data.durationMs}ms) — refresh dashboard`
            : `Failed: ${JSON.stringify(data.steps?.error)}`
        );
      }
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleTestRun}
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded border border-terminal-accent/50 bg-terminal-accent/10 px-4 py-2 text-sm text-terminal-accent transition hover:bg-terminal-accent/20 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        Force Test Run
      </button>
      {result && (
        <p className="text-xs text-terminal-muted">{result}</p>
      )}
    </div>
  );
}
