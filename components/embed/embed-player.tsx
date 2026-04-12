"use client";

import { Play, Pause, Volume2, ExternalLink, Loader2 } from "lucide-react";
import type { RecordingRow } from "@/lib/db/queries/recordings";
import { useWaveSurfer } from "@/components/audio/use-wavesurfer";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function EmbedPlayer({ recording }: { recording: RecordingRow }) {
  const {
    containerRef,
    isReady,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
  } = useWaveSurfer({
    url: recording.blob_url,
    height: 40,
    waveColor: "oklch(0.55 0.02 65)",
    progressColor: "oklch(0.75 0.15 65)",
    cursorColor: "oklch(0.75 0.15 65 / 0.5)",
    barWidth: 2,
    barGap: 1,
    barRadius: 1,
  });

  const displayDuration = duration > 0 ? duration : recording.duration_sec;

  return (
    <div className="w-full max-w-md rounded-xl border bg-card p-4 shadow-lg space-y-3">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="font-medium text-sm truncate">{recording.title}</h3>
          {recording.kit_id && (
            <span className="text-xs text-muted-foreground capitalize">
              {recording.kit_id.replace(/-/g, " ")}
            </span>
          )}
        </div>
        <a
          href={`/recordings/${recording.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      {/* Waveform */}
      <div className="relative h-10 rounded bg-muted overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-4 text-muted-foreground animate-spin" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={!isReady}
          className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 ml-0.5" />}
        </button>

        <div className="flex-1 flex items-center justify-between text-xs tabular-nums text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(displayDuration)}</span>
        </div>

        <Volume2 className="size-3.5 text-muted-foreground" />
      </div>

      {/* Branding */}
      <div className="flex items-center justify-center gap-1.5 pt-1 border-t">
        <span className="text-[10px] text-muted-foreground">
          Played on Digital Ocarina
        </span>
      </div>
    </div>
  );
}
