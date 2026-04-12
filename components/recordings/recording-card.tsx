"use client";

import { useState } from "react";
import { Play, Pause, Volume2, VolumeX, Download, Loader2, Music, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useWaveSurfer } from "@/components/audio/use-wavesurfer";
import type { RecordingRow } from "@/lib/db/queries/recordings";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RecordingCard({ recording }: { recording: RecordingRow }) {
  const [muted, setMuted] = useState(false);

  const {
    containerRef,
    isReady,
    isPlaying,
    currentTime,
    duration: wsDuration,
    togglePlay,
    setMuted: wsSetMuted,
  } = useWaveSurfer({
    url: recording.blob_url,
    height: 48,
    barWidth: 2,
    barGap: 1,
    barRadius: 1,
  });

  const displayDuration = wsDuration > 0 ? wsDuration : recording.duration_sec;

  function handleMuteToggle() {
    const next = !muted;
    setMuted(next);
    wsSetMuted(next);
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 hover:border-foreground/20 transition-colors">
      {/* Waveform */}
      <div className="relative h-12 rounded bg-muted overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-4 text-muted-foreground/50 animate-spin" />
          </div>
        )}
      </div>

      {/* Title + date */}
      <div>
        <h3 className="font-medium text-sm truncate">{recording.title ?? "Untitled"}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDuration(displayDuration)}
          </span>
          {recording.bpm && (
            <span className="flex items-center gap-1">
              <Music className="size-3" />
              {recording.bpm} BPM
            </span>
          )}
          <span>{formatDate(recording.created_at)}</span>
        </div>
      </div>

      {/* Controls + badges */}
      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          disabled={!isReady}
          className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
        >
          {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 ml-px" />}
        </button>

        <span className="text-xs tabular-nums text-muted-foreground w-9 shrink-0">
          {formatDuration(currentTime)}
        </span>

        <div className="flex flex-1 flex-wrap gap-1">
          {recording.kit_id && (
            <Badge variant="secondary" className="text-xs capitalize">
              {recording.kit_id.replace(/-/g, " ")}
            </Badge>
          )}
          {recording.is_public && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">public</Badge>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleMuteToggle}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </button>
          <a
            href={recording.blob_url}
            download
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title="Download"
          >
            <Download className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
