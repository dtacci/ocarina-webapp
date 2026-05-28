import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { notFound } from "next/navigation";

import { getMyCapture } from "@/lib/db/queries/monitor-captures";
import { ReplaySurface } from "@/components/monitor/replay-surface";
import { CaptureNotesEditor } from "@/components/monitor/capture-notes-editor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CapturePage({ params }: PageProps) {
  const { id } = await params;
  const capture = await getMyCapture(id);
  if (!capture) notFound();

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{capture.name}</h1>
          <p className="flex flex-wrap items-baseline gap-x-2 text-muted-foreground text-sm">
            <span>Saved capture · {capture.event_count} events ·{" "}
              {Math.round(capture.duration_ms / 1000)}s</span>
            <span className="font-mono">{capture.source}</span>
            {capture.button_event_count > 0 && (
              <span className="text-violet-300/80">{capture.button_event_count} buttons</span>
            )}
            {capture.note_event_count > 0 && (
              <span className="text-emerald-300/80">{capture.note_event_count} notes</span>
            )}
            {capture.loop_event_count > 0 && (
              <span className="text-blue-300/80">{capture.loop_event_count} loop</span>
            )}
            {capture.fx_event_count > 0 && (
              <span className="text-amber-300/80">{capture.fx_event_count} fx</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href={capture.blob_url}
            download={`${capture.name}.json`}
            className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/15"
          >
            <Download className="size-3" />
            JSON
          </a>
          <Link
            href="/monitor/captures"
            className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            All captures
          </Link>
        </div>
      </div>

      <CaptureNotesEditor
        captureId={capture.id}
        initialNotes={capture.notes}
      />

      <ReplaySurface
        capture={{
          id: capture.id,
          name: capture.name,
          blobUrl: capture.blob_url,
          source: capture.source,
          startedAt: capture.started_at,
          endedAt: capture.ended_at,
          durationMs: capture.duration_ms,
          eventCount: capture.event_count,
        }}
      />
    </div>
  );
}
