"use client";

import { Circle, Pause, Volume2, VolumeX, Disc3 } from "lucide-react";

import type { LoopSnapshot, LoopTrack } from "@/lib/ocarina-api";
import { useInterpolatedLoopPosition } from "@/hooks/use-interpolated-loop-position";

interface Props {
  snapshot: LoopSnapshot | null;
  progress:
    | { positionMs: number; activeTrack: number; receivedAt: number }
    | null;
  teensyConnected: boolean | null;
}

const TRACKS_FALLBACK: LoopTrack[] = [
  { id: 1, state: "empty", length_ms: 0, muted: false },
  { id: 2, state: "empty", length_ms: 0, muted: false },
  { id: 3, state: "empty", length_ms: 0, muted: false },
  { id: 4, state: "empty", length_ms: 0, muted: false },
];

export function LoopStatePanel({ snapshot, progress, teensyConnected }: Props) {
  const masterLength = snapshot?.master_length_ms ?? 0;
  const interpolated = useInterpolatedLoopPosition(progress, masterLength);
  const tracks = snapshot?.tracks ?? TRACKS_FALLBACK;
  const activeTrack = snapshot?.active_track ?? 1;
  const bpm = snapshot?.bpm ?? null;

  const masterPct =
    masterLength > 0 && interpolated !== null
      ? (interpolated / masterLength) * 100
      : null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Disc3
              className={`size-4 ${
                snapshot && masterLength > 0
                  ? "animate-spin text-emerald-400"
                  : "text-muted-foreground"
              }`}
              style={{ animationDuration: "8s" }}
            />
            <h2 className="text-sm font-medium">Master loop</h2>
            <span className="font-mono text-[10px] text-muted-foreground">
              {snapshot === null
                ? "waiting…"
                : masterLength > 0
                  ? `${(masterLength / 1000).toFixed(2)}s`
                  : "not committed"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {bpm !== null && (
              <span className="font-mono tabular-nums text-foreground/80">
                {bpm.toFixed(1)} BPM
              </span>
            )}
            <span>active track</span>
            <span className="font-mono font-semibold text-foreground">
              #{activeTrack}
            </span>
            {teensyConnected === false && (
              <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-mono uppercase tracking-wider text-red-300">
                Teensy offline
              </span>
            )}
          </div>
        </div>

        <MasterBar pct={masterPct} hasData={masterLength > 0} />
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Tracks</h2>
        <div className="space-y-2">
          {tracks.map((t) => (
            <TrackRow
              key={t.id}
              track={t}
              isActive={t.id === activeTrack}
              masterLengthMs={masterLength}
              positionMs={interpolated}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MasterBar({ pct, hasData }: { pct: number | null; hasData: boolean }) {
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-background/70">
      {hasData ? (
        <div
          className="absolute inset-y-0 left-0 w-px bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]"
          style={{ left: `${pct ?? 0}%` }}
          aria-hidden="true"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
          waiting for a committed master loop
        </div>
      )}
    </div>
  );
}

function TrackRow({
  track,
  isActive,
  masterLengthMs,
  positionMs,
}: {
  track: LoopTrack;
  isActive: boolean;
  masterLengthMs: number;
  positionMs: number | null;
}) {
  const { tone, badge, Icon } = visualsForState(track.state, track.muted);
  const fillPct =
    masterLengthMs > 0
      ? Math.min(100, (track.length_ms / masterLengthMs) * 100)
      : 0;
  const playheadPct =
    masterLengthMs > 0 && positionMs !== null
      ? (positionMs / masterLengthMs) * 100
      : null;

  return (
    <div
      className={[
        "rounded-lg border px-3 py-2",
        tone,
        isActive ? "ring-1 ring-amber-400/60" : "",
      ].join(" ")}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-[10px] font-semibold tabular-nums">
          #{track.id}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-medium">
          <Icon className="size-3" /> {badge}
        </span>
        <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
          {track.length_ms > 0 ? `${(track.length_ms / 1000).toFixed(2)}s` : "—"}
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-background/60">
        {fillPct > 0 && (
          <div
            className="absolute inset-y-0 left-0 bg-current opacity-30"
            style={{ width: `${fillPct}%` }}
          />
        )}
        {playheadPct !== null && fillPct > 0 && (
          <div
            className="absolute inset-y-0 w-px bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.7)]"
            style={{ left: `${playheadPct}%` }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

function visualsForState(state: LoopTrack["state"], muted: boolean) {
  if (muted || state === "muted") {
    return {
      tone: "border-border bg-muted/20 text-muted-foreground",
      badge: "MUTED",
      Icon: VolumeX,
    };
  }
  switch (state) {
    case "recording":
      return {
        tone: "border-red-500 bg-red-500/15 text-red-200",
        badge: "RECORDING",
        Icon: Circle,
      };
    case "playing":
      return {
        tone: "border-emerald-500 bg-emerald-500/15 text-emerald-200",
        badge: "PLAYING",
        Icon: Volume2,
      };
    case "empty":
    default:
      return {
        tone: "border-border bg-background/40 text-muted-foreground/80",
        badge: "EMPTY",
        Icon: Pause,
      };
  }
}
