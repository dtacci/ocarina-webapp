"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, FolderArchive, Loader2 } from "lucide-react";

import type { MonitorCaptureRow } from "@/lib/db/queries/monitor-captures";

interface Props {
  /** Bump this from the parent after a successful save to refetch. */
  refreshNonce: number;
}

const RECENT_LIMIT = 5;

export function RecentCapturesPanel({ refreshNonce }: Props) {
  const [captures, setCaptures] = useState<MonitorCaptureRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/monitor/captures", { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const body = (await res.json()) as { captures: MonitorCaptureRow[] };
        if (!cancelled) setCaptures(body.captures);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed");
      }
    })();
    return () => { cancelled = true; };
  }, [refreshNonce]);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-medium">
            <FolderArchive className="size-3.5 text-muted-foreground" />
            Recent captures
          </h2>
          <p className="text-xs text-muted-foreground">
            The last {RECENT_LIMIT} session captures saved to your library.
          </p>
        </div>
        <Link
          href="/monitor/captures"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          View all <ArrowRight className="size-3" />
        </Link>
      </div>

      {captures === null && !error && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> loading…
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {captures !== null && captures.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No captures yet — click Start above to record one.
        </p>
      )}

      {captures !== null && captures.length > 0 && (
        <div className="space-y-1.5">
          {captures.slice(0, RECENT_LIMIT).map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-md border bg-card/60 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
                  <span>{relative(c.created_at)}</span>
                  <span>{c.event_count} events</span>
                  <span>{Math.round(c.duration_ms / 1000)}s</span>
                  <span className="font-mono">{c.source}</span>
                </div>
              </div>
              <a
                href={c.blob_url}
                download={`${c.name}.json`}
                className="flex items-center gap-1 rounded-md border border-border bg-card/40 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                <Download className="size-3" />
                JSON
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
