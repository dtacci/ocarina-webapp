"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TrackState = "empty" | "recording" | "playing" | "muted";

export interface LoopTrack {
  id: number;        // 1–6
  state: TrackState;
  length_ms: number;
  muted: boolean;
}

export interface LoopStateData {
  tracks: LoopTrack[];
  bpm: number | null;
  master_length_ms: number;
  active_track: number;
}

const EMPTY_STATE: LoopStateData = {
  tracks: Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    state: "empty" as TrackState,
    length_ms: 0,
    muted: false,
  })),
  bpm: null,
  master_length_ms: 0,
  active_track: 1,
};

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useLoopState(deviceId: string | null) {
  const [loopState, setLoopState] = useState<LoopStateData>(EMPTY_STATE);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setStatus("disconnected");
      return;
    }

    const supabase = createClient();

    // Subscribe to Postgres Changes on the devices table (loop_state column).
    // Pi writes to devices.loop_state via POST /api/sync/loop-state.
    const channel = supabase
      .channel(`device_loop_${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "devices",
          filter: `id=eq.${deviceId}`,
        },
        (payload) => {
          const raw = (payload.new as Record<string, unknown>).loop_state;
          if (!raw || typeof raw !== "object") return;

          const candidate = raw as Record<string, unknown>;
          if (!Array.isArray(candidate.tracks)) return;

          const normalizedTracks = candidate.tracks
            .map((t: unknown): LoopTrack | null => {
              if (!t || typeof t !== "object") return null;
              const track = t as Record<string, unknown>;
              return {
                id: Number(track.id ?? 0),
                state: normalizeTrackState(track.state),
                length_ms: Number(track.length_ms ?? 0),
                muted: Boolean(track.muted),
              };
            })
            .filter((t): t is LoopTrack => t !== null);

          setLoopState({
            tracks: normalizedTracks,
            bpm: typeof candidate.bpm === "number" ? candidate.bpm : null,
            master_length_ms: Number(candidate.master_length_ms ?? 0),
            active_track: Number(candidate.active_track ?? 1),
          });
          setLastUpdated(new Date());
        }
      )
      .subscribe((s) => {
        setStatus(s === "SUBSCRIBED" ? "connected" : "connecting");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId]);

  // Mark as disconnected if no update for 10 seconds
  useEffect(() => {
    if (!lastUpdated) return;
    const timer = setTimeout(() => setStatus("disconnected"), 10_000);
    return () => clearTimeout(timer);
  }, [lastUpdated]);

  return { loopState, status, lastUpdated };
}

function normalizeTrackState(raw: unknown): TrackState {
  const s = String(raw).toLowerCase();
  if (s === "recording" || s === "rec") return "recording";
  if (s === "playing" || s === "play") return "playing";
  if (s === "muted") return "muted";
  return "empty";
}
