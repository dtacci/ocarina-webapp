"use client";

import { Play, Pause, SkipBack, Repeat } from "lucide-react";

import type { UseReplayPlayback } from "@/hooks/use-replay-playback";

const SPEEDS = [0.5, 1, 2, 4] as const;

interface Props {
  playback: UseReplayPlayback;
  /** Original session label for the badge ("device · ISO time"). */
  label?: string;
}

export function ReplayControls({ playback, label }: Props) {
  const { position, totalMs, playing, speed, setPlaying, setSpeed, seekTo, ended } =
    playback;

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-violet-500/40 bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet-300">
            Replay
          </span>
          {label && (
            <span className="text-xs text-muted-foreground">{label}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground tabular-nums">
          <span className="text-foreground/90">{formatMs(position)}</span>
          <span>/</span>
          <span>{formatMs(totalMs)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => seekTo(0)}
          className="flex size-8 items-center justify-center rounded-md border border-border bg-card/60 text-muted-foreground hover:text-foreground"
          title="Jump to start"
        >
          <SkipBack className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (ended) {
              seekTo(0);
              setPlaying(true);
            } else {
              setPlaying(!playing);
            }
          }}
          className="flex size-9 items-center justify-center rounded-md border border-violet-500/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25"
          title={playing ? "Pause" : ended ? "Replay from start" : "Play"}
        >
          {playing ? (
            <Pause className="size-4" />
          ) : ended ? (
            <Repeat className="size-4" />
          ) : (
            <Play className="size-4 translate-x-px" />
          )}
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(1, totalMs)}
          step={50}
          value={position}
          onChange={(e) => seekTo(Number(e.target.value))}
          aria-label="Scrub position"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-violet-500/20 accent-violet-400"
        />

        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={[
                "rounded-md border px-2 py-1 font-mono text-[10px] tabular-nums",
                s === speed
                  ? "border-violet-500/60 bg-violet-500/20 text-violet-100"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}
