"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface PeaksSvgProps {
  peaks: number[] | null | undefined;
  height?: number;
  bars?: number;
  className?: string;
  /** 0..1 — renders a progress overlay in the foreground color. */
  progress?: number;
  ariaHidden?: boolean;
}

/**
 * Static waveform peaks rendered as an inline SVG. Works with the
 * pre-computed `waveform_peaks` JSONB stored on samples/recordings.
 *
 * Two stacked layers: a muted backdrop and a foreground clipped to the
 * current progress. This lets the parent animate progress cheaply via a
 * CSS custom property without re-laying out the bars.
 */
export function PeaksSvg({
  peaks,
  height = 32,
  bars = 64,
  className,
  progress,
  ariaHidden = true,
}: PeaksSvgProps) {
  const values = useMemo(() => resample(peaks ?? [], bars), [peaks, bars]);
  const barWidth = 100 / (bars * 1.5);
  const gap = barWidth * 0.5;

  const renderBars = (opacity: number) =>
    values.map((v, i) => {
      const h = Math.max(2, v * height);
      const x = i * (barWidth + gap);
      const y = (height - h) / 2;
      return (
        <rect
          key={i}
          x={`${x}%`}
          y={y}
          width={`${barWidth}%`}
          height={h}
          rx={1}
          opacity={opacity}
        />
      );
    });

  const clipWidth =
    progress === undefined
      ? "100%"
      : `${Math.min(100, Math.max(0, progress * 100))}%`;

  return (
    <div
      className={cn("relative block w-full", className)}
      style={{ height }}
      aria-hidden={ariaHidden}
    >
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full fill-foreground/25"
      >
        {renderBars(1)}
      </svg>
      {progress !== undefined && (
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full fill-primary"
          style={{
            clipPath: `inset(0 calc(100% - ${clipWidth}) 0 0)`,
            WebkitClipPath: `inset(0 calc(100% - ${clipWidth}) 0 0)`,
          }}
        >
          {renderBars(1)}
        </svg>
      )}
    </div>
  );
}

/** Downsample/upsample a peak array to N bars. Clamps to [0,1]. */
function resample(src: number[], n: number): number[] {
  if (n <= 0) return [];
  if (src.length === 0) {
    // Gentle sine wave fallback so cards don't look broken when peaks are missing.
    return Array.from({ length: n }, (_, i) =>
      Math.max(0.12, Math.sin((i / n) * Math.PI) * 0.6 + 0.25),
    );
  }
  const out = new Array<number>(n);
  const stride = src.length / n;
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * stride);
    const end = Math.max(start + 1, Math.floor((i + 1) * stride));
    let max = 0;
    for (let j = start; j < end && j < src.length; j++) {
      const v = Math.abs(src[j]);
      if (v > max) max = v;
    }
    out[i] = Math.min(1, max);
  }
  return out;
}
