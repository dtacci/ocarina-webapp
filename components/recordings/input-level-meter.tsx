"use client";

import { useEffect, useRef } from "react";

const MIN_DB = -60;
const MAX_DB = 0;
const CLIP_THRESHOLD_DB = -3;
const PEAK_HOLD_FALL_DB_PER_SEC = 8;

interface Props {
  analyser: AnalyserNode | null;
  width?: number;
  height?: number;
  orientation?: "vertical" | "horizontal";
}

export function InputLevelMeter({
  analyser,
  width = 12,
  height = 48,
  orientation = "vertical",
}: Props) {
  const fillRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<HTMLDivElement>(null);
  const peakHoldDbRef = useRef<number>(MIN_DB);
  const lastTsRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!analyser) {
      if (fillRef.current) {
        fillRef.current.style.height = "0%";
        fillRef.current.style.width = "0%";
      }
      if (holdRef.current) {
        holdRef.current.style.bottom = "0%";
        holdRef.current.style.left = "0%";
      }
      peakHoldDbRef.current = MIN_DB;
      return;
    }

    const buffer = new Float32Array(analyser.fftSize);
    lastTsRef.current = performance.now();

    function tick(ts: number) {
      if (!analyser) return;
      analyser.getFloatTimeDomainData(buffer);

      let maxAbs = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = Math.abs(buffer[i]);
        if (v > maxAbs) maxAbs = v;
      }

      const peakDb = maxAbs > 0 ? 20 * Math.log10(maxAbs) : MIN_DB;
      const clampedDb = Math.max(MIN_DB, Math.min(MAX_DB, peakDb));

      const dt = Math.max(0.001, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      peakHoldDbRef.current = Math.max(
        clampedDb,
        peakHoldDbRef.current - PEAK_HOLD_FALL_DB_PER_SEC * dt,
      );

      const fillPct = ((clampedDb - MIN_DB) / (MAX_DB - MIN_DB)) * 100;
      const holdPct = ((peakHoldDbRef.current - MIN_DB) / (MAX_DB - MIN_DB)) * 100;
      const isClipping = clampedDb >= CLIP_THRESHOLD_DB;
      const color = isClipping ? "var(--wb-oxide)" : "var(--wb-amber)";

      if (fillRef.current) {
        if (orientation === "vertical") {
          fillRef.current.style.height = `${fillPct}%`;
        } else {
          fillRef.current.style.width = `${fillPct}%`;
        }
        fillRef.current.style.backgroundColor = color;
      }
      if (holdRef.current) {
        if (orientation === "vertical") {
          holdRef.current.style.bottom = `${holdPct}%`;
        } else {
          holdRef.current.style.left = `${holdPct}%`;
        }
        holdRef.current.style.backgroundColor = color;
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
  }, [analyser, orientation]);

  const vertical = orientation === "vertical";

  return (
    <div
      className="relative overflow-hidden bg-[color:var(--ink-900,theme(colors.muted.DEFAULT))] border border-border/60 rounded-sm"
      style={{ width, height }}
      aria-label="input level meter"
    >
      <div
        ref={fillRef}
        className="absolute transition-none"
        style={
          vertical
            ? { left: 0, right: 0, bottom: 0, height: "0%", backgroundColor: "var(--wb-amber)" }
            : { top: 0, bottom: 0, left: 0, width: "0%", backgroundColor: "var(--wb-amber)" }
        }
      />
      <div
        ref={holdRef}
        className="absolute"
        style={
          vertical
            ? { left: 0, right: 0, bottom: "0%", height: 1, backgroundColor: "var(--wb-amber)" }
            : { top: 0, bottom: 0, left: "0%", width: 1, backgroundColor: "var(--wb-amber)" }
        }
      />
    </div>
  );
}
