"use client";

import { useState, useRef } from "react";
import { Play, Pause, Volume2, ExternalLink } from "lucide-react";
import type { RecordingRow } from "@/lib/db/queries/recordings";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function EmbedPlayer({ recording }: { recording: RecordingRow }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress((audio.currentTime / audio.duration) * 100);
    setCurrentTime(audio.currentTime);
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  }

  function handleEnded() {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }

  return (
    <div className="w-full max-w-md rounded-xl border bg-card p-4 shadow-lg space-y-3">
      <audio
        ref={audioRef}
        src={recording.blob_url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />

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

      {/* Waveform / progress bar */}
      <div
        className="relative h-10 rounded bg-muted cursor-pointer overflow-hidden"
        onClick={handleSeek}
      >
        {/* Fake waveform bars */}
        <div className="absolute inset-0 flex items-end gap-px px-0.5">
          {Array.from({ length: 60 }, (_, i) => {
            const height = 20 + Math.sin(i * 0.7) * 30 + Math.cos(i * 1.3) * 20;
            const filled = (i / 60) * 100 <= progress;
            return (
              <div
                key={i}
                className={`flex-1 rounded-t-sm transition-colors ${
                  filled ? "bg-primary" : "bg-muted-foreground/20"
                }`}
                style={{ height: `${Math.max(10, Math.min(100, height))}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 ml-0.5" />}
        </button>

        <div className="flex-1 flex items-center justify-between text-xs tabular-nums text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(recording.duration_sec)}</span>
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
