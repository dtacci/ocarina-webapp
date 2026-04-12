"use client";

import { cn } from "@/lib/utils";
import type { LoopTrack } from "@/hooks/use-loop-state";

const STATE_LABEL: Record<string, string> = {
  empty: "EMPTY",
  recording: "REC",
  playing: "PLAY",
  muted: "MUTED",
};

const STATE_COLOR: Record<string, string> = {
  empty: "bg-muted text-muted-foreground",
  recording: "bg-red-500/20 text-red-400 animate-pulse",
  playing: "bg-emerald-500/20 text-emerald-400",
  muted: "bg-muted/50 text-muted-foreground/50",
};

const BAR_COLOR: Record<string, string> = {
  empty: "bg-muted",
  recording: "bg-red-500/50",
  playing: "bg-emerald-500/60",
  muted: "bg-muted-foreground/20",
};

function formatMs(ms: number): string {
  if (ms === 0) return "—";
  const sec = (ms / 1000).toFixed(1);
  return `${sec}s`;
}

interface Props {
  track: LoopTrack;
  masterLengthMs: number;
  isActive: boolean;
  onMuteToggle: (trackId: number) => void;
  onRecord: (trackId: number) => void;
}

export function TrackBlock({ track, masterLengthMs, isActive, onMuteToggle, onRecord }: Props) {
  const fillPct = masterLengthMs > 0 && track.length_ms > 0
    ? Math.min(100, (track.length_ms / masterLengthMs) * 100)
    : 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
        isActive && track.state !== "empty"
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card"
      )}
    >
      {/* Track number */}
      <span className="w-5 text-xs font-medium tabular-nums text-muted-foreground shrink-0">
        T{track.id}
      </span>

      {/* State badge */}
      <span
        className={cn(
          "w-14 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold tracking-wide",
          STATE_COLOR[track.state] ?? STATE_COLOR.empty
        )}
      >
        {STATE_LABEL[track.state] ?? "EMPTY"}
      </span>

      {/* Length bar */}
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            BAR_COLOR[track.state] ?? BAR_COLOR.empty
          )}
          style={{ width: `${fillPct}%` }}
        />
      </div>

      {/* Length label */}
      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground shrink-0">
        {formatMs(track.length_ms)}
      </span>

      {/* Mute button */}
      <button
        onClick={() => onMuteToggle(track.id)}
        disabled={track.state === "empty"}
        title={track.muted ? "Unmute" : "Mute"}
        className={cn(
          "w-6 h-6 shrink-0 rounded text-[10px] font-bold transition-colors disabled:opacity-30",
          track.muted
            ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
            : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
        )}
      >
        M
      </button>

      {/* Record button */}
      <button
        onClick={() => onRecord(track.id)}
        disabled={track.state === "recording"}
        title="Record on this track"
        className={cn(
          "w-6 h-6 shrink-0 rounded-full border-2 transition-colors disabled:opacity-30",
          track.state === "recording"
            ? "border-red-500 bg-red-500/30"
            : "border-muted-foreground/30 hover:border-red-500/50"
        )}
      />
    </div>
  );
}
