import Link from "next/link";
import { FolderArchive, Play, Waves, ChevronLeft, ChevronRight } from "lucide-react";

import { listPublicCaptures } from "@/lib/db/queries/monitor-captures";
import { SafeMarkdown } from "@/components/monitor/safe-markdown";
import { CaptureThumbnail } from "@/components/monitor/capture-thumbnail";

const PAGE_SIZE = 30;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Public discovery feed of every publicly-shared capture across users. No
 * owner attribution — keeps the feed simple and respects the original
 * sharing intent (a single share link, not a username profile). Links to
 * the per-capture share route.
 */
export default async function CapturesExplorePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const captures = await listPublicCaptures({ limit: PAGE_SIZE + 1, offset });
  const hasMore = captures.length > PAGE_SIZE;
  const rows = captures.slice(0, PAGE_SIZE);

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
            <FolderArchive className="size-5 text-muted-foreground" />
            Explore captures
          </h1>
          <p className="text-muted-foreground text-sm">
            Publicly-shared debug sessions across the Ocarina community.
          </p>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <FolderArchive className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">No public captures yet</p>
            <p className="text-xs text-muted-foreground">
              Owners can opt in from the share toggle on any capture.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((c) => (
              <Link
                key={c.id}
                href={`/captures/share/${c.share_token}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 hover:border-foreground/40"
              >
                <CaptureThumbnail url={c.thumbnail_url} alt={`Activity heatmap for ${c.name}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                    <span title={new Date(c.created_at).toISOString()}>
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                    <span>{c.event_count} events</span>
                    <span>{Math.round(c.duration_ms / 1000)}s</span>
                    <span className="font-mono">{c.source}</span>
                    {c.button_event_count > 0 && (
                      <span className="text-violet-300/80">
                        {c.button_event_count} buttons
                      </span>
                    )}
                    {c.note_event_count > 0 && (
                      <span className="text-emerald-300/80">
                        {c.note_event_count} notes
                      </span>
                    )}
                    {c.loop_event_count > 0 && (
                      <span className="text-blue-300/80">
                        {c.loop_event_count} loop
                      </span>
                    )}
                  </div>
                  {c.notes && (
                    <SafeMarkdown className="mt-1 line-clamp-2 text-xs text-muted-foreground/90 italic block">
                      {c.notes}
                    </SafeMarkdown>
                  )}
                </div>
                <span className="flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300">
                  <Play className="size-3" />
                  Replay
                </span>
              </Link>
            ))}
          </div>

          <nav className="flex items-center justify-between gap-2 pt-3 text-xs">
            {page > 1 ? (
              <Link
                href={`/captures/explore?page=${page - 1}`}
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
                href={`/captures/explore?page=${page + 1}`}
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
