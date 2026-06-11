"use client";

/**
 * Pioneer-style vertical fader (channel level, master, tempo).
 *
 * A custom pointer-drag control rather than a rotated native range input —
 * rotated inputs have broken hit targets and focus rings, and the DJM look
 * (groove track + rectangular cap with a center line) doesn't map onto the
 * native widget anyway. Interaction mirrors the workbench Knob: pointer
 * capture drag, arrow keys (Shift = 10×), Home/End, double-click reset.
 */
import { useCallback, useRef } from "react";

export interface VerticalFaderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Small-caps label under the fader. */
  label: string;
  /** Accessible name; defaults to label. */
  ariaLabel?: string;
  /** Track height in px. Default 140. */
  height?: number;
  format?: (v: number) => string;
  /** Double-click resets to this value when provided. */
  defaultValue?: number;
  /** Draw a center detent tick (tempo / crossfader-style zero mark). */
  centerDetent?: boolean;
  onChange: (v: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

const CAP_H = 22;

export function VerticalFader({
  value,
  min,
  max,
  step = 0.01,
  label,
  ariaLabel,
  height = 140,
  format,
  defaultValue,
  centerDetent = false,
  onChange,
  onDragStart,
  onDragEnd,
}: VerticalFaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<number | null>(null);

  const emit = useCallback(
    (raw: number) => {
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(snapped, min, max));
    },
    [onChange, step, min, max],
  );

  // Jump-to-pointer on down, then absolute tracking while dragging — feels
  // like grabbing the cap anywhere on the groove (faders, unlike knobs,
  // expect positional rather than relative drag).
  const valueAtY = useCallback(
    (clientY: number): number => {
      const el = trackRef.current;
      if (!el) return value;
      const rect = el.getBoundingClientRect();
      const usable = rect.height - CAP_H;
      const norm = clamp(1 - (clientY - rect.top - CAP_H / 2) / usable, 0, 1);
      return min + norm * (max - min);
    },
    [min, max, value],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      trackRef.current?.setPointerCapture(e.pointerId);
      draggingRef.current = e.pointerId;
      onDragStart?.();
      emit(valueAtY(e.clientY));
    },
    [emit, valueAtY, onDragStart],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (draggingRef.current !== e.pointerId) return;
      emit(valueAtY(e.clientY));
    },
    [emit, valueAtY],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (draggingRef.current !== e.pointerId) return;
      trackRef.current?.releasePointerCapture(e.pointerId);
      draggingRef.current = null;
      onDragEnd?.();
    },
    [onDragEnd],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let dir = 0;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") dir = 1;
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") dir = -1;
      else if (e.key === "Home") {
        emit(min);
        e.preventDefault();
        return;
      } else if (e.key === "End") {
        emit(max);
        e.preventDefault();
        return;
      }
      if (dir === 0) return;
      e.preventDefault();
      emit(value + dir * (e.shiftKey ? step * 10 : step));
    },
    [emit, value, step, min, max],
  );

  const norm = clamp((value - min) / (max - min), 0, 1);
  const capTop = (1 - norm) * (height - CAP_H);
  const readout = format
    ? format(value)
    : value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0);

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <span className="workbench-readout text-[10px] tabular-nums">{readout}</span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel ?? label}
        aria-orientation="vertical"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={readout}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        onDoubleClick={() => {
          if (defaultValue !== undefined) emit(defaultValue);
        }}
        className="relative w-7 cursor-ns-resize focus:outline-none focus-visible:outline-1 focus-visible:outline-dashed focus-visible:outline-[color:var(--wb-amber)]"
        style={{ height, touchAction: "none" }}
      >
        {/* groove */}
        <div className="absolute left-1/2 top-0 h-full w-1.5 -translate-x-1/2 rounded-[2px] border border-[color:var(--ink-600)] bg-[color:var(--ink-900)]" />
        {/* detent / scale ticks */}
        {centerDetent ? (
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[color:var(--ink-500)]" />
        ) : null}
        {/* cap */}
        <div
          className="absolute left-1/2 w-7 -translate-x-1/2 rounded-[3px] border border-[color:var(--ink-500)] shadow-[0_2px_6px_oklch(0_0_0_/_0.5)]"
          style={{
            top: capTop,
            height: CAP_H,
            background:
              "linear-gradient(180deg, transparent 44%, var(--wb-amber) 44%, var(--wb-amber) 56%, transparent 56%), linear-gradient(180deg, var(--ink-600), var(--ink-700))",
          }}
        />
      </div>
      <span className="workbench-label">{label}</span>
    </div>
  );
}
