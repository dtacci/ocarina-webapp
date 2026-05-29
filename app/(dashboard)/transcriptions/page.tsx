import Link from "next/link";
import { redirect } from "next/navigation";
import { Music4, FileMusic } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listTranscriptionSessions } from "@/lib/db/queries/transcription";

export const metadata = {
  title: "Transcriptions — Digital Ocarina",
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function TranscriptionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sessions = await listTranscriptionSessions({ limit: 60 });

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-primary">
          <Music4 className="size-5" />
          <h1 className="text-xl font-semibold tracking-tight">Transcriptions</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Sessions you&apos;ve sung, rendered as sheet music. Open one to tweak the
          tempo, key, and timing.
        </p>
      </header>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center">
          <FileMusic className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">No transcriptions yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sing into your Ocarina and sync — your performances will appear here as
            engraved notation.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/transcriptions/${s.id}`}
                className="group block rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium leading-tight group-hover:text-primary">
                    {s.title ?? "Untitled transcription"}
                  </h2>
                  {s.transcription_status && s.transcription_status !== "rendered" ? (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {s.transcription_status}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                  {new Date(s.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {" · "}
                  {formatDuration(s.duration_sec)}
                  {s.event_count != null ? ` · ${s.event_count} events` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
