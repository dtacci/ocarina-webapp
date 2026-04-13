"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Music, Repeat, Clock, Play, Pause, Download, Loader2 } from "lucide-react";
import { PeaksSvg } from "@/components/audio/peaks-svg";
import {
  RecordingListProvider,
  recordingToTrack,
  useRecordingList,
} from "@/components/recordings/recording-list-context";
import {
  useAudioPlayerStore,
  useIsPlaying,
} from "@/lib/stores/audio-player";
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
  const list = useRecordingList();
  const isPlaying = useIsPlaying(recording.id);
  const isCurrent = useAudioPlayerStore(
    (s) => s.current?.id === recording.id,
  );
  const isLoading = useAudioPlayerStore(
    (s) => s.current?.id === recording.id && s.status === "loading",
  );
  const currentTime = useAudioPlayerStore((s) =>
    s.current?.id === recording.id ? s.currentTime : 0,
  );
  const storeDuration = useAudioPlayerStore((s) =>
    s.current?.id === recording.id ? s.duration : 0,
  );
  const playList = useAudioPlayerStore((s) => s.playList);
  const playTrack = useAudioPlayerStore((s) => s.playTrack);

  function handlePlay() {
    if (list) {
      const tracks = list.recordings.map((r) => list.toTrack(r));
      const idx = list.recordings.findIndex((r) => r.id === recording.id);
      playList(tracks, idx >= 0 ? idx : 0);
      return;
    }
    playTrack(recordingToTrack(recording));
  }

  const dur = storeDuration > 0 ? storeDuration : recording.duration_sec;
  const label =
    recording.recording_type === "master"
      ? (recording.title ?? "Session Mix")
      : (recording.title ?? "Recording");
  const progress = dur > 0 ? Math.min(1, currentTime / dur) : 0;

  return (
    <div
      className="flex items-center gap-3"
      data-playing={isCurrent ? "true" : undefined}
    >
      {/* Play button */}
      <button
        onClick={handlePlay}
        aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
        aria-pressed={isPlaying}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="size-3.5" />
        ) : (
          <Play className="size-3.5 ml-px" />
        )}
      </button>

      {/* Waveform + title */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium truncate">{label}</span>
          <span className="text-xs tabular-nums text-muted-foreground shrink-0">
            {formatWaveDuration(isCurrent ? currentTime : dur)}
          </span>
        </div>
        <div className="relative h-14 rounded bg-muted/40 overflow-hidden">
          <PeaksSvg
            peaks={recording.waveform_peaks}
            height={56}
            bars={120}
            progress={isCurrent ? progress : undefined}
            className="px-1"
          />
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
          <RecordingListProvider recordings={session.recordings}>
            <div className="space-y-4">
              {session.recordings.map((rec) => (
                <RecordingWave key={rec.id} recording={rec} />
              ))}
            </div>
          </RecordingListProvider>
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
