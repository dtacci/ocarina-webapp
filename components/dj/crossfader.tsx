"use client";

/**
 * The crossfader strip: A ←→ B slider + center detent marker.
 *
 * Two writers share this control — the on-screen slider and the hardware pot
 * (via use-dj-hardware). The pot updates arrive as prop-less imperative calls
 * from the parent (which owns the suppression window), so this component just
 * renders a controlled slider and reports drag start/end for that window.
 */
import { useRef } from "react";

export interface CrossfaderProps {
  /** 0 = full A, 1 = full B. */
  value: number;
  onChange: (v: number) => void;
  /** Pointer-drag lifecycle, used by the parent to suppress pot input. */
  onDragStart?: () => void;
  onDragEnd?: () => void;
  /** Lights when the hardware pot moved it recently. */
  hwActive?: boolean;
}

export function Crossfader({ value, onChange, onDragStart, onDragEnd, hwActive }: CrossfaderProps) {
  const dragging = useRef(false);

  return (
    <div className="flex items-center gap-4">
      <span className="workbench-label text-base text-[color:var(--wb-amber)]">A</span>
      <div className="relative flex-1">
        {/* center detent */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-[color:var(--ink-500)]" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={value}
          aria-label="crossfader"
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onPointerDown={() => {
            dragging.current = true;
            onDragStart?.();
          }}
          onPointerUp={() => {
            if (dragging.current) {
              dragging.current = false;
              onDragEnd?.();
            }
          }}
          className="dj-xfader"
        />
      </div>
      <span className="workbench-label text-base text-[color:var(--wb-amber)]">B</span>
      <span
        className="workbench-led"
        data-on={!!hwActive}
        title={hwActive ? "hardware pot active" : "hardware pot idle"}
      />
      <span className="workbench-label text-[10px] text-[color:var(--ink-500)]">hw</span>
    </div>
  );
}
