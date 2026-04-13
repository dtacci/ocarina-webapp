"use client";

/**
 * Workbench LinearSlider — horizontal slim track + amber fill + square thumb.
 *
 * Wraps a native <input type="range"> (visually hidden) for accessibility:
 * keyboard arrows, screen-reader support, and touch work for free. The SVG
 * on top is purely presentational.
 */

import { useId } from "react";

export interface LinearSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  label?: string;
  /** Width of the track area in px. Default 140. */
  width?: number;
  /** Show numeric readout beside the track. */
  showReadout?: boolean;
  format?: (v: number) => string;
  onChange: (value: number) => void;
}

export function LinearSlider({
  value,
  min,
  max,
  step = 1,
  label,
  width = 140,
  showReadout = false,
  format,
  onChange,
}: LinearSliderProps) {
  const id = useId();
  const norm = Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
  const fillX = norm * width;

  return (
    <div className="flex items-center gap-3 select-none">
      {label && (
        <label htmlFor={id} className="workbench-label min-w-[60px]">
          {label}
        </label>
      )}
      <div className="relative" style={{ width, height: 20 }}>
        {/* Background track */}
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2"
          style={{
            height: 1,
            backgroundColor: "var(--wb-line)",
          }}
        />
        {/* Amber fill */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2"
          style={{
            width: fillX,
            height: 1,
            backgroundColor: "var(--wb-amber)",
          }}
        />
        {/* Thumb (square, no border-radius) */}
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            left: `${fillX - 5}px`,
            width: 10,
            height: 10,
            backgroundColor: "var(--wb-amber)",
            boxShadow: "0 0 6px var(--wb-amber-glow)",
            pointerEvents: "none",
          }}
        />
        {/* Native input — visually hidden but interactive */}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      {showReadout && (
        <span className="workbench-readout text-[10px] tabular-nums min-w-[40px] text-right">
          {format ? format(value) : value.toString()}
        </span>
      )}
    </div>
  );
}
