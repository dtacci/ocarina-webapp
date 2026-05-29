import Link from "next/link";
import { ArrowLeft, Download, FolderArchive, Play, Share2 } from "lucide-react";

import { listMyCaptures } from "@/lib/db/queries/monitor-captures";
import { DeleteCaptureButton } from "@/components/monitor/delete-capture-button";

export const dynamic = "force-dynamic";

export default async function CapturesPage() {
  const captures = await listMyCaptures();

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Captures</h1>
          <p className="text-muted-foreground text-sm">
            Saved Monitor sessions. Captures persist as JSON in your library;
            delete what you don&apos;t need.
          </p>
        </div>
        <Link
          href="/monitor"
          className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back to Monitor
        </Link>
      </div>

      {captures.length === 0 ? (
        <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-card">
            <FolderArchive className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-medium">No captures yet</h2>
            <p className="text-sm text-muted-foreground">
              Open Monitor, click Start, do the thing, click Stop. The capture
              shows up here.
            </p>
          </div>
          <Link
            href="/monitor"
            className="inline-flex items-center rounded-md border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open Monitor →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {captures.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3"
            >
              <Link href={`/monitor/captures/${c.id}`} className="min-w-0 flex-1 hover:underline">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{c.name}</span>
                  {c.is_public && (
                    <span
                      className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0 font-mono text-[9px] uppercase tracking-wider text-emerald-300"
                      title="Publicly shared"
                    >
                      <Share2 className="size-2.5" />
                      public
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
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
                  {c.fx_event_count > 0 && (
                    <span className="text-amber-300/80">
                      {c.fx_event_count} fx
                    </span>
                  )}
                  {c.loop_event_count > 0 && (
                    <span className="text-blue-300/80">
                      {c.loop_event_count} loop
                    </span>
                  )}
                  {c.misc_event_count > 0 && (
                    <span className="text-muted-foreground/80">
                      {c.misc_event_count} misc
                    </span>
                  )}
                </div>
                {c.notes && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/90 whitespace-pre-wrap">
                    {c.notes}
                  </p>
                )}
              </Link>
              <Link
                href={`/monitor/captures/${c.id}`}
                className="flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-500/15"
              >
                <Play className="size-3" />
                Replay
              </Link>
              <a
                href={c.blob_url}
                download={`${c.name}.json`}
                className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/15"
              >
                <Download className="size-3" />
                JSON
              </a>
              <DeleteCaptureButton id={c.id} name={c.name} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
