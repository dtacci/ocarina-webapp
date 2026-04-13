"use client";

import { useRef } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import type { SampleWithVibes } from "@/lib/db/queries/samples";
import { PeaksSvg } from "./peaks-svg";
import { sampleToTrack } from "@/components/samples/sample-list-context";
import {
  useAudioPlayerStore,
  useIsPlaying,
} from "@/lib/stores/audio-player";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Props {
  sample: SampleWithVibes;
}

/**
 * Hero player on the sample detail page. Renders the sample's pre-computed
 * waveform peaks and routes playback through the global audio store, so
 * audio keeps going if the user navigates back to the library.
 */
export function SamplePlayer({ sample }: Props) {
  const isPlaying = useIsPlaying(sample.id);
  const isCurrent = useAudioPlayerStore(
    (s) => s.current?.id === sample.id,
  );
  const isLoading = useAudioPlayerStore(
    (s) => s.current?.id === sample.id && s.status === "loading",
  );
  const currentTime = useAudioPlayerStore((s) =>
    s.current?.id === sample.id ? s.currentTime : 0,
  );
  const storeDuration = useAudioPlayerStore((s) =>
    s.current?.id === sample.id ? s.duration : 0,
  );
  const playTrack = useAudioPlayerStore((s) => s.playTrack);
  const seek = useAudioPlayerStore((s) => s.seek);

  const waveRef = useRef<HTMLDivElement>(null);

  const displayDuration =
    storeDuration > 0 ? storeDuration : sample.duration_sec;
  const progress =
    displayDuration > 0 ? Math.min(1, currentTime / displayDuration) : 0;

  function handlePlayClick() {
    playTrack(sampleToTrack(sample));
  }

  function handleSeekClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isCurrent || displayDuration <= 0) return;
    const rect = waveRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    seek(pct * displayDuration);
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Waveform with click-to-seek */}
      <div
        ref={waveRef}
        onClick={handleSeekClick}
        className={
          "relative h-16 rounded-lg bg-muted overflow-hidden " +
          (isCurrent ? "cursor-pointer" : "cursor-default")
        }
        role={isCurrent ? "slider" : undefined}
        aria-label={isCurrent ? "Seek" : undefined}
        aria-valuemin={isCurrent ? 0 : undefined}
        aria-valuemax={isCurrent ? displayDuration : undefined}
        aria-valuenow={isCurrent ? currentTime : undefined}
      >
        <PeaksSvg
          peaks={sample.waveform_peaks}
          height={64}
          bars={128}
          progress={isCurrent ? progress : undefined}
          className="px-1"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={handlePlayClick}
          aria-label={isPlaying ? `Pause ${sample.id}` : `Play ${sample.id}`}
          aria-pressed={isPlaying}
          className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4 ml-0.5" />
          )}
        </button>

        <div className="flex-1 flex items-center justify-between text-sm tabular-nums text-muted-foreground">
          <span>{formatTime(isCurrent ? currentTime : 0)}</span>
          <span>{formatTime(displayDuration)}</span>
        </div>
      </div>
    </div>
  );
}
