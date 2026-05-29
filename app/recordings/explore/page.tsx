import Link from "next/link";
import { ChevronLeft, ChevronRight, Disc3, Play, Waves } from "lucide-react";

import { listPublicRecordings } from "@/lib/db/queries/recordings";

const PAGE_SIZE = 30;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Public discovery feed of every publicly-shared recording across users.
 * Mirrors /captures/explore — no owner attribution, simple list, pagination.
 * Links to /recordings/[id] which is already publicly accessible.
 */
export default async function RecordingsExplorePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const recordings = await listPublicRecordings({ limit: PAGE_SIZE + 1, offset });
  const hasMore = recordings.length > PAGE_SIZE;
  const rows = recordings.slice(0, PAGE_SIZE);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/"
            className="mb-2 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <Waves className="size-3" />
            Digital Ocarina
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Disc3 className="size-5 text-muted-foreground" />
            Explore recordings
          </h1>
          <p className="text-muted-foreground text-sm">
            Publicly-shared recordings across the Ocarina community.
          </p>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <Disc3 className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">No public recordings yet</p>
            <p className="text-xs text-muted-foreground">
              Owners can flip a recording public from any card&apos;s share menu.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/recordings/${r.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 hover:border-foreground/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {r.title || "Untitled"}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                    <span title={new Date(r.created_at).toISOString()}>
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                    <span>{formatDuration(r.duration_sec)}</span>
                    <span className="font-mono">{r.recording_type}</span>
                    {r.bpm !== null && (
                      <span className="text-amber-300/80">{r.bpm} BPM</span>
                    )}
                    {r.sample_rate > 0 && (
                      <span className="font-mono text-muted-foreground/70">
                        {(r.sample_rate / 1000).toFixed(1)}k
                      </span>
                    )}
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300">
                  <Play className="size-3" />
                  Open
                </span>
              </Link>
            ))}
          </div>

          <nav className="flex items-center justify-between gap-2 pt-3 text-xs">
            {page > 1 ? (
              <Link
                href={`/recordings/explore?page=${page - 1}`}
                className="flex items-center gap-1 rounded-md border border-border bg-card/60 px-3 py-1.5 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-3" />
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="font-mono text-muted-foreground/70">page {page}</span>
            {hasMore ? (
              <Link
                href={`/recordings/explore?page=${page + 1}`}
                className="flex items-center gap-1 rounded-md border border-border bg-card/60 px-3 py-1.5 text-muted-foreground hover:text-foreground"
              >
                Next
                <ChevronRight className="size-3" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </main>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
