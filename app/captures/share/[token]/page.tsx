import Link from "next/link";
import { notFound } from "next/navigation";
import { Disc3, Waves } from "lucide-react";

import { getPublicCaptureByToken } from "@/lib/db/queries/monitor-captures";
import { listPublicCommentsByToken } from "@/lib/db/queries/capture-comments";
import { createClient } from "@/lib/supabase/server";
import { ReplaySurface } from "@/components/monitor/replay-surface";
import { CaptureComments } from "@/components/monitor/capture-comments";
import { SafeMarkdown } from "@/components/monitor/safe-markdown";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Anonymous-readable replay of a publicly-shared capture. Lookup goes through
 * the admin client + a server-side is_public check so revoking sharing
 * immediately closes access even if the token has leaked.
 */
export default async function SharedCapturePage({ params }: PageProps) {
  const { token } = await params;
  const capture = await getPublicCaptureByToken(token);
  if (!capture) notFound();

  const [comments, supabase] = await Promise.all([
    listPublicCommentsByToken(token),
    createClient(),
  ]);
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <Link
            href="/"
            className="mb-2 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <Waves className="size-3" />
            Digital Ocarina
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{capture.name}</h1>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-muted-foreground text-sm">
            <span>Shared capture · {capture.event_count} events ·{" "}
              {Math.round(capture.duration_ms / 1000)}s</span>
            <span className="font-mono">{capture.source}</span>
            {capture.button_event_count > 0 && (
              <span className="text-violet-300/80">
                {capture.button_event_count} buttons
              </span>
            )}
            {capture.note_event_count > 0 && (
              <span className="text-emerald-300/80">
                {capture.note_event_count} notes
              </span>
            )}
            {capture.loop_event_count > 0 && (
              <span className="text-blue-300/80">
                {capture.loop_event_count} loop
              </span>
            )}
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
          <Disc3 className="size-3" />
          Public replay
        </span>
      </header>

      {capture.notes && (
        <div className="rounded-xl border bg-card/60 p-3">
          <SafeMarkdown className="text-xs text-muted-foreground/90 italic">
            {capture.notes}
          </SafeMarkdown>
        </div>
      )}

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

      <CaptureComments
        captureId={capture.id}
        initialComments={comments ?? []}
        viewerId={user?.id ?? null}
        captureOwnerId={capture.user_id}
      />

      <footer className="pt-4 text-center text-[11px] text-muted-foreground/60">
        Replay only · the owner can revoke this link at any time
      </footer>
    </main>
  );
}
