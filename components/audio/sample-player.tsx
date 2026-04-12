"use client";

import { useState, useRef } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [muted, setMuted] = useState(false);

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
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <audio
        ref={audioRef}
        src={blobUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        muted={muted}
        preload="metadata"
      />

      {/* Waveform / progress */}
      <div
        className="relative h-16 rounded-lg bg-muted cursor-pointer overflow-hidden"
        onClick={handleSeek}
      >
        <div className="absolute inset-0 flex items-end gap-px px-1 py-1">
          {Array.from({ length: 80 }, (_, i) => {
            const height = 20 + Math.sin(i * 0.5) * 25 + Math.cos(i * 1.1) * 20 + Math.sin(i * 2.3) * 10;
            const filled = (i / 80) * 100 <= progress;
            return (
              <div
                key={i}
                className={`flex-1 rounded-t-sm transition-colors ${
                  filled ? "bg-primary" : "bg-muted-foreground/20"
                }`}
                style={{ height: `${Math.max(8, Math.min(100, height))}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
        </button>

        <div className="flex-1 flex items-center justify-between text-sm tabular-nums text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <button
          onClick={() => setMuted(!muted)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>
    </div>
  );
}
