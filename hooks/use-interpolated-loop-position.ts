"use client";

import { useEffect, useRef, useState } from "react";

interface Progress {
  positionMs: number;
  activeTrack: number;
  receivedAt: number; // Date.now() when the sample arrived
}

/**
 * Smooths the Pi's ~1 Hz `loop_progress` samples into a 30 Hz interpolated
 * playhead. Between samples we advance position by wall-clock elapsed; when a
 * new sample arrives we snap to it (corrects accumulated drift). Returns the
 * current position in ms, or null while we have no master length yet.
 */
export function useInterpolatedLoopPosition(
  progress: Progress | null,
  masterLengthMs: number
): number | null {
  const [position, setPosition] = useState<number | null>(null);
  const progressRef = useRef(progress);
  const lengthRef = useRef(masterLengthMs);

  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { lengthRef.current = masterLengthMs; }, [masterLengthMs]);

  useEffect(() => {
    if (!progress || masterLengthMs <= 0) {
      setPosition(null);
      return;
    }

    let raf = 0;
    let lastTick = performance.now();

    const tick = (now: number) => {
      const p = progressRef.current;
      const len = lengthRef.current;
      if (!p || len <= 0) {
        setPosition(null);
        return;
      }
      // Throttle re-renders to ~30 Hz — playhead bar doesn't need 60.
      if (now - lastTick < 33) {
        raf = window.requestAnimationFrame(tick);
        return;
      }
      lastTick = now;
      const elapsedMs = Date.now() - p.receivedAt;
      const interpolated = (p.positionMs + elapsedMs) % len;
      setPosition(interpolated);
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
    // We deliberately re-run only when the progress object identity changes
    // (a new sample). Internal updates flow through refs.
  }, [progress, masterLengthMs]);

  return position;
}
