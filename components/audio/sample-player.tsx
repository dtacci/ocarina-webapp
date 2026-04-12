"use client";

import { useState } from "react";
import { Play, Pause, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useWaveSurfer } from "./use-wavesurfer";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Props {
  blobUrl: string;
  duration: number;
}

export function SamplePlayer({ blobUrl, duration }: Props) {
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
    url: blobUrl,
    height: 64,
    waveColor: "oklch(0.55 0.02 65)",
    progressColor: "oklch(0.75 0.15 65)",
    cursorColor: "oklch(0.75 0.15 65 / 0.5)",
    barWidth: 3,
    barGap: 1,
    barRadius: 2,
  });

  function handleMuteToggle() {
    const next = !muted;
    setMuted(next);
    wsSetMuted(next);
  }

  const displayDuration = wsDuration > 0 ? wsDuration : duration;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Waveform */}
      <div className="relative h-16 rounded-lg bg-muted overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-5 text-muted-foreground animate-spin" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={!isReady}
          className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
        </button>

        <div className="flex-1 flex items-center justify-between text-sm tabular-nums text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(displayDuration)}</span>
        </div>

        <button
          onClick={handleMuteToggle}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>
    </div>
  );
}
