"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { HardwareEvent } from "@/hooks/use-hardware-input";
import type { TelemetryEvent } from "@/hooks/use-device-telemetry";
import type { LogEntry } from "@/components/diagnostics/live-event-log";
import { parseLogEntry } from "@/lib/replay/log-entry-parser";

export interface UseReplayPlaybackOptions {
  /** Captured log entries, sorted ascending by ts. */
  events: LogEntry[];
  /** Wall-clock ms of the first event — used as origin for `position`. */
  startMs: number;
  /** Wall-clock ms of the last event — used to compute total duration. */
  endMs: number;
  onHardware?: (e: HardwareEvent) => void;
  onTelemetry?: (e: TelemetryEvent) => void;
  /** Also fires for unparseable entries (they go straight to the log). */
  onLog?: (entry: LogEntry) => void;
}

export interface UseReplayPlayback {
  /** Current playback position in ms from start. */
  position: number;
  /** Total duration in ms. */
  totalMs: number;
  playing: boolean;
  speed: number;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  seekTo: (positionMs: number) => void;
  /** True after position has crossed totalMs and we paused. */
  ended: boolean;
}

/**
 * Schedules saved capture events through the same downstream pipeline a live
 * session uses. Driven by requestAnimationFrame so playback stays smooth at
 * arbitrary speeds and pauses cleanly under the tab-visibility throttle.
 *
 * Limitation: seeking backwards doesn't replay state-establishing events
 * before the new position — physical buttons that were "held" past the seek
 * line won't appear pressed. Adequate for debug replay; not a video editor.
 */
export function useReplayPlayback(
  options: UseReplayPlaybackOptions
): UseReplayPlayback {
  const { events, startMs, endMs, onHardware, onTelemetry, onLog } = options;

  const totalMs = Math.max(0, endMs - startMs);

  const onHwRef = useRef(onHardware);
  const onTelRef = useRef(onTelemetry);
  const onLogRef = useRef(onLog);
  useEffect(() => { onHwRef.current = onHardware; }, [onHardware]);
  useEffect(() => { onTelRef.current = onTelemetry; }, [onTelemetry]);
  useEffect(() => { onLogRef.current = onLog; }, [onLog]);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [position, setPosition] = useState(0);
  const [ended, setEnded] = useState(false);

  // Refs used inside the rAF loop so it always reads latest values without
  // re-binding the loop on every state change.
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const positionRef = useRef(0);
  const nextIdxRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // Sorted events + cached relative times so the loop just compares numbers.
  const sorted = useMemo(() => {
    const arr = events
      .map((e) => ({ entry: e, rel: e.ts - startMs }))
      .sort((a, b) => a.rel - b.rel);
    return arr;
  }, [events, startMs]);

  const emit = useCallback((entry: LogEntry) => {
    onLogRef.current?.(entry);
    const parsed = parseLogEntry(entry);
    if (!parsed) return;
    if (parsed.kind === "hw") onHwRef.current?.(parsed.event);
    else onTelRef.current?.(parsed.event);
  }, []);

  const drainUpTo = useCallback(
    (pos: number) => {
      let i = nextIdxRef.current;
      while (i < sorted.length && sorted[i].rel <= pos) {
        emit(sorted[i].entry);
        i++;
      }
      nextIdxRef.current = i;
    },
    [sorted, emit]
  );

  const seekTo = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(totalMs, target));
      positionRef.current = clamped;
      setPosition(clamped);
      // Find the first event past the new position. We don't re-emit past
      // events on backwards seek (see hook-level doc comment).
      let i = 0;
      while (i < sorted.length && sorted[i].rel <= clamped) i++;
      nextIdxRef.current = i;
      setEnded(clamped >= totalMs && totalMs > 0);
    },
    [sorted, totalMs]
  );

  // rAF loop
  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTickRef.current = null;
      return;
    }

    setEnded(false);

    const tick = (now: number) => {
      if (!playingRef.current) return;
      const last = lastTickRef.current ?? now;
      const dtReal = now - last;
      lastTickRef.current = now;
      const dt = dtReal * speedRef.current;
      let next = positionRef.current + dt;
      if (next >= totalMs) {
        next = totalMs;
        positionRef.current = next;
        setPosition(next);
        drainUpTo(next);
        setPlaying(false);
        setEnded(true);
        return;
      }
      positionRef.current = next;
      setPosition(next);
      drainUpTo(next);
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTickRef.current = null;
    };
  }, [playing, totalMs, drainUpTo]);

  return {
    position,
    totalMs,
    playing,
    speed,
    setPlaying,
    setSpeed,
    seekTo,
    ended,
  };
}
