"use client";

/**
 * Post-chain peak level meter.
 *
 * Reads the analyser via rAF while playing. Shows peak dBFS as a slim
 * vertical bar — amber below -3 dBFS, oxide red at/above -3 (approaching
 * clip). Peak-hold decays at ~8 dB/s so short transients stay visible.
 *
 * When `analyser` is null (not playing), the bar renders empty.
 *
 * Implementation notes:
 *   - We run our own rAF instead of getting ticks from the editor because
 *     this meter's update rate (~60fps) is independent of playhead syncing.
 *   - Updates the bar via direct style mutation (no React state), so the
 *     component itself never re-renders during playback — the parent only
 *     re-renders when the analyser prop reference changes.
 */

import { useEffect, useRef } from "react";
import type * as Tone from "tone";

const MIN_DB = -60;
const MAX_DB = 0;
const CLIP_THRESHOLD_DB = -3;
const PEAK_HOLD_FALL_DB_PER_SEC = 8;

interface Props {
  analyser: Tone.Analyser | null;
  width?: number;
  height?: number;
}

export function PeakMeter({ analyser, width = 12, height = 48 }: Props) {
  const fillRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<HTMLDivElement>(null);
  const peakHoldDbRef = useRef<number>(MIN_DB);
  const lastTsRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!analyser) {
      if (fillRef.current) fillRef.current.style.height = "0%";
      if (holdRef.current) holdRef.current.style.bottom = "0%";
      peakHoldDbRef.current = MIN_DB;
      return;
    }

    lastTsRef.current = performance.now();

    function tick(ts: number) {
      if (!analyser) return;
      const values = analyser.getValue();
      // analyser.getValue() for "waveform" type returns Float32Array (not array of arrays).
      const samples = Array.isArray(values) ? values[0] : values;
      if (!samples || typeof samples === "number") {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      let maxAbs = 0;
      for (let i = 0; i < samples.length; i++) {
        const v = Math.abs(samples[i]);
        if (v > maxAbs) maxAbs = v;
      }

      const peakDb = maxAbs > 0 ? 20 * Math.log10(maxAbs) : MIN_DB;
      const clampedDb = Math.max(MIN_DB, Math.min(MAX_DB, peakDb));

      // Peak-hold: instant rise, exponential fall.
      const dt = Math.max(0.001, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      peakHoldDbRef.current = Math.max(
        clampedDb,
        peakHoldDbRef.current - PEAK_HOLD_FALL_DB_PER_SEC * dt,
      );

      const fillPct = ((clampedDb - MIN_DB) / (MAX_DB - MIN_DB)) * 100;
      const holdPct = ((peakHoldDbRef.current - MIN_DB) / (MAX_DB - MIN_DB)) * 100;
      const isClipping = clampedDb >= CLIP_THRESHOLD_DB;

      if (fillRef.current) {
        fillRef.current.style.height = `${fillPct}%`;
        fillRef.current.style.backgroundColor = isClipping
          ? "var(--wb-oxide)"
          : "var(--wb-amber)";
      }
      if (holdRef.current) {
        holdRef.current.style.bottom = `${holdPct}%`;
        holdRef.current.style.backgroundColor = isClipping
          ? "var(--wb-oxide)"
          : "var(--wb-amber)";
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [analyser]);

  return (
    <div
      className="relative overflow-hidden bg-[color:var(--ink-900)] border border-[color:var(--wb-line-soft)]"
      style={{ width, height }}
      aria-label="peak meter"
    >
      <div
        ref={fillRef}
        className="absolute left-0 right-0 bottom-0 transition-none"
        style={{
          height: "0%",
          backgroundColor: "var(--wb-amber)",
        }}
      />
      <div
        ref={holdRef}
        className="absolute left-0 right-0"
        style={{
          bottom: "0%",
          height: 1,
          backgroundColor: "var(--wb-amber)",
        }}
      />
    </div>
  );
}
