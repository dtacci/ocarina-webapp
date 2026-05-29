"use client";

import { useEffect, useState } from "react";

import { ocarina, isOcarinaApiConfigured } from "@/lib/ocarina-api";

const POLL_MS = 60_000;

interface LooperActiveState {
  /** True when at least one track is in "recording" state. */
  isRecording: boolean;
  /** True when a master loop is committed (anything playing). */
  hasActiveLoop: boolean;
}

/**
 * Lightweight polling of GET /loop for sidebar awareness — surfaces "the Pi
 * is doing something interesting right now" without holding a dedicated WS
 * connection from every dashboard page. 60 s cadence is plenty for a nav pip.
 */
export function useLooperActive(): LooperActiveState {
  const [state, setState] = useState<LooperActiveState>({
    isRecording: false,
    hasActiveLoop: false,
  });

  useEffect(() => {
    if (!isOcarinaApiConfigured()) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const snap = await ocarina.loop();
        if (cancelled) return;
        setState({
          isRecording: snap.tracks.some((t) => t.state === "recording"),
          hasActiveLoop:
            snap.master_length_ms > 0 ||
            snap.tracks.some((t) => t.state === "playing"),
        });
      } catch {
        if (!cancelled) setState({ isRecording: false, hasActiveLoop: false });
      }
    };

    void tick();
    const iv = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  return state;
}
