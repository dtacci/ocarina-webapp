"use client";

import { useCallback, useState } from "react";
import {
  Circle,
  Volume2,
  VolumeX,
  Timer,
  Square,
  AlertTriangle,
  Loader2,
} from "lucide-react";

import { ocarina } from "@/lib/ocarina-api";
import type { LoopSnapshot } from "@/lib/ocarina-api";

interface Props {
  snapshot: LoopSnapshot | null;
}

/**
 * Firmware sim-key transport. Maps clicks → `ocarina.simKey(char)` per the
 * action-key table in the integration doc:
 *   '1'-'4' = select track  ·  'l' = record  ·  'a' = mute  ·  'b' = tap-tempo
 *   ' '     = all-off (stop everything)
 *
 * Effects appear back through /events as loop_state / loop_progress changes,
 * so the dashboard's panel reacts naturally — no optimistic UI needed.
 */
export function LoopTransportControls({ snapshot }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (key: string) => {
    setBusy(true);
    setError(null);
    try {
      await ocarina.simKey(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const activeTrack = snapshot?.active_track ?? null;
  const activeTrackObj =
    snapshot?.tracks.find((t) => t.id === activeTrack) ?? null;
  const isMuted = activeTrackObj?.muted ?? false;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Transport</h2>
        <span className="font-mono text-[10px] text-muted-foreground">
          clicks drive the firmware sim-key
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              onClick={() => { void send(String(n)); }}
              className={[
                "flex size-9 items-center justify-center rounded-md border font-mono text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                activeTrack === n
                  ? "border-amber-400 bg-amber-500/15 text-amber-100"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
              ].join(" ")}
              title={`Select track ${n}`}
            >
              {n}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => { void send("l"); }}
          className="flex items-center gap-1.5 rounded-md border border-red-500/50 bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          title="Record (sends 'l')"
        >
          <Circle className="size-3 fill-red-400 text-red-400" />
          Record
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => { void send("a"); }}
          className={[
            "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60",
            isMuted
              ? "border-amber-500/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
              : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
          ].join(" ")}
          title={`${isMuted ? "Unmute" : "Mute"} active track (sends 'a')`}
        >
          {isMuted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
          {isMuted ? "Unmute" : "Mute"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => { void send("b"); }}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          title="Tap tempo (sends 'b')"
        >
          <Timer className="size-3" />
          Tap
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => { void send(" "); }}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          title="Stop everything (sends space)"
        >
          <Square className="size-3" />
          All off
        </button>

        {busy && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
      </div>

      {error && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-300">
          <AlertTriangle className="size-3" />
          {error}
        </div>
      )}
    </div>
  );
}
