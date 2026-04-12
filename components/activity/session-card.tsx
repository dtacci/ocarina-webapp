"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Music, Repeat, Clock, Play, Pause, Download } from "lucide-react";
import { useWaveSurfer } from "@/components/audio/use-wavesurfer";
import type { SessionWithRecordings, SessionRecording } from "@/lib/db/queries/sessions";

// ── helpers ──────────────────────────────────────────────────────────────────

const modeColors: Record<string, string> = {
  instrument: "bg-violet-500",
  karaoke:    "bg-pink-500",
  madlibs:    "bg-amber-500",
  looper:     "bg-emerald-500",
};

function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatWaveDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days === 0) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Recording waveform row (SoundCloud-style) ─────────────────────────────────

function RecordingWave({ recording }: { recording: SessionRecording }) {
  const {
    containerRef,
    isReady,
    isPlaying,
    currentTime,
    duration: wsDuration,
    togglePlay,
  } = useWaveSurfer({
    url: recording.blob_url,
    height: 56,
    barWidth: 2,
    barGap: 1,
    barRadius: 1,
    waveColor: "oklch(0.45 0.02 65)",
    progressColor: "oklch(0.70 0.18 65)",
    lazy: true,
  });

  const dur = wsDuration > 0 ? wsDuration : recording.duration_sec;
  const label = recording.recording_type === "master"
    ? (recording.title ?? "Session Mix")
    : recording.title ?? "Recording";

  return (
    <div className="flex items-center gap-3">
      {/* Play button */}
      <button
        onClick={togglePlay}
        disabled={!isReady}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
      >
        {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 ml-px" />}
      </button>

      {/* Waveform + title */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium truncate">{label}</span>
          <span className="text-xs tabular-nums text-muted-foreground shrink-0">
            {formatWaveDuration(currentTime || dur)}
          </span>
        </div>
        <div className="relative h-14 rounded bg-muted overflow-hidden">
          <div ref={containerRef} className="absolute inset-0" />
          {!isReady && <Skeleton className="absolute inset-0 rounded" />}
        </div>
      </div>
    </div>
  );
}

// ── SessionCard ───────────────────────────────────────────────────────────────

export function SessionCard({ session }: { session: SessionWithRecordings }) {
  const [downloading, setDownloading] = useState(false);

  const hasRecordings = session.recordings.length > 0;
  const stems = session.recordings.filter((r) => r.recording_type !== "master");

  async function handleDownload(e: React.MouseEvent) {
    e.preventDefault();
    setDownloading(true);
    try {
      const resp = await fetch(`/api/sessions/${session.id}/export`);
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ocarina-session-${session.started_at.slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/10">
        <div className={`size-2 rounded-full shrink-0 ${modeColors[session.mode] ?? "bg-gray-500"}`} />
        <span className="text-sm font-medium capitalize">{session.mode}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">{formatDate(session.started_at)}</span>

        {session.kit_id && (
          <>
            <span className="text-xs text-muted-foreground">·</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
              {session.kit_id.replace(/-/g, " ")}
            </Badge>
          </>
        )}

        <div className="flex-1" />

        {/* ZIP download — only for looper sessions with recordings */}
        {hasRecordings && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Download session as ZIP"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">ZIP</span>
          </button>
        )}

        {/* Link to filtered recordings for this session */}
        {hasRecordings && (
          <Link
            href={`/recordings?session_id=${session.id}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View recordings →
          </Link>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Waveforms for each recording (SoundCloud-inspired) */}
        {hasRecordings ? (
          <div className="space-y-4">
            {session.recordings.map((rec) => (
              <RecordingWave key={rec.id} recording={rec} />
            ))}
          </div>
        ) : null}

        {/* Session metadata footer */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {session.duration_sec && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatDuration(session.duration_sec)}
            </span>
          )}
          {session.samples_played > 0 && (
            <span className="flex items-center gap-1">
              <Music className="size-3" />
              {session.samples_played} samples
            </span>
          )}
          {session.loops_recorded > 0 && (
            <span className="flex items-center gap-1">
              <Repeat className="size-3" />
              {session.loops_recorded} loops
            </span>
          )}
          {stems.length > 0 && session.recordings.some(r => r.recording_type === "master") && (
            <span>{stems.length} stems</span>
          )}

          {session.vibes_used?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {session.vibes_used.slice(0, 4).map((v) => (
                <Badge key={v} variant="outline" className="text-[10px] px-1 py-0">{v}</Badge>
              ))}
              {session.vibes_used.length > 4 && (
                <span className="text-[10px]">+{session.vibes_used.length - 4}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
