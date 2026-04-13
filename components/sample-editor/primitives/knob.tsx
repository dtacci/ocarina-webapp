"use client";

/**
 * Workbench Knob — SVG rotary control.
 *
 * Interaction:
 *   - vertical drag (up increases, down decreases), full range ≈ 200 px by default
 *   - scroll wheel: ±step per tick; Shift+wheel = 10× step
 *   - keyboard: arrow up/down = ±step; Shift+arrow = 10× step
 *   - double-click: reset to defaultValue
 *
 * Accessibility: role="slider" with aria-valuenow/min/max/text.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface KnobProps {
  value: number;
  min: number;
  max: number;
  defaultValue?: number;
  step?: number;
  /** Unit shown in the readout (e.g. "Hz", "dB", "st"). */
  unit?: string;
  /** Small-caps label shown above the knob. */
  label: string;
  /** Decimal places in the readout. Default 0. */
  decimals?: number;
  /** Log-scale mapping — useful for frequency (20 Hz–20 kHz). */
  log?: boolean;
  /** Overall knob diameter in px. Default 52. */
  size?: number;
  /** Show a sign (+/−) prefix in the readout. */
  showSign?: boolean;
  /** Custom formatter for the readout (overrides decimals+unit+showSign). */
  format?: (v: number) => string;
  onChange: (value: number) => void;
}

const SWEEP_DEG = 270;
const START_DEG = -135;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function Knob({
  value,
  min,
  max,
  defaultValue,
  step = 1,
  unit = "",
  label,
  decimals = 0,
  log = false,
  size = 52,
  showSign = false,
  format,
  onChange,
}: KnobProps) {
  const trackRef = useRef<SVGSVGElement>(null);
  const dragStateRef = useRef<{ startY: number; startValue: number; pointerId: number } | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Map a value to [0..1] (log or linear).
  const toNorm = useCallback(
    (v: number): number => {
      const c = clamp(v, min, max);
      if (log) {
        const lmin = Math.log(Math.max(min, 1e-6));
        const lmax = Math.log(Math.max(max, 1e-6));
        return (Math.log(Math.max(c, 1e-6)) - lmin) / (lmax - lmin);
      }
      return (c - min) / (max - min);
    },
    [min, max, log],
  );

  // Reverse normalized [0..1] → raw value.
  const fromNorm = useCallback(
    (n: number): number => {
      const nn = clamp(n, 0, 1);
      if (log) {
        const lmin = Math.log(Math.max(min, 1e-6));
        const lmax = Math.log(Math.max(max, 1e-6));
        return Math.exp(lmin + nn * (lmax - lmin));
      }
      return min + nn * (max - min);
    },
    [min, max, log],
  );

  const normalized = toNorm(value);
  const angle = START_DEG + SWEEP_DEG * normalized;

  const circumference = 2 * Math.PI * 18; // radius 18 for a 52px knob
  const trackDash = (SWEEP_DEG / 360) * circumference;
  const fillDash = normalized * trackDash;

  const emitChange = useCallback(
    (raw: number) => {
      const snapped = Math.round(raw / step) * step;
      const bounded = clamp(snapped, min, max);
      onChange(bounded);
    },
    [onChange, step, min, max],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      e.preventDefault();
      trackRef.current?.setPointerCapture(e.pointerId);
      dragStateRef.current = { startY: e.clientY, startValue: value, pointerId: e.pointerId };
    },
    [value],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const deltaY = drag.startY - e.clientY; // up = positive
      const sensitivity = e.shiftKey ? 400 : 200;
      const normDelta = deltaY / sensitivity;
      const startNorm = toNorm(drag.startValue);
      const newNorm = clamp(startNorm + normDelta, 0, 1);
      emitChange(fromNorm(newNorm));
    },
    [toNorm, fromNorm, emitChange],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragStateRef.current;
      if (drag && drag.pointerId === e.pointerId) {
        trackRef.current?.releasePointerCapture(e.pointerId);
        dragStateRef.current = null;
      }
    },
    [],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      if (!isFocused && !dragStateRef.current) return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      const magnitude = e.shiftKey ? step * 10 : step;
      emitChange(value + dir * magnitude);
    },
    [isFocused, value, step, emitChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      let dir = 0;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") dir = 1;
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") dir = -1;
      else if (e.key === "Home") {
        emitChange(min);
        e.preventDefault();
        return;
      } else if (e.key === "End") {
        emitChange(max);
        e.preventDefault();
        return;
      }
      if (dir === 0) return;
      e.preventDefault();
      const magnitude = e.shiftKey ? step * 10 : step;
      emitChange(value + dir * magnitude);
    },
    [value, step, min, max, emitChange],
  );

  const handleDoubleClick = useCallback(() => {
    if (defaultValue !== undefined) emitChange(defaultValue);
  }, [defaultValue, emitChange]);

  // Attach non-passive wheel listener so e.preventDefault() works.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const listener = (e: WheelEvent) => {
      if (!isFocused && !dragStateRef.current) return;
      e.preventDefault();
    };
    el.addEventListener("wheel", listener, { passive: false });
    return () => el.removeEventListener("wheel", listener);
  }, [isFocused]);

  const readoutStr = useMemo(() => {
    if (format) return format(value);
    const rounded = value.toFixed(decimals);
    const signed = showSign && value > 0 ? `+${rounded}` : rounded;
    return unit ? `${signed} ${unit}` : signed;
  }, [value, decimals, unit, showSign, format]);

  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) - 8;

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <span className="workbench-label">{label}</span>
      <svg
        ref={trackRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={readoutStr}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onDoubleClick={handleDoubleClick}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="cursor-ns-resize focus:outline-none"
        style={{ touchAction: "none" }}
      >
        {/* Background track (full sweep) */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--wb-line)"
          strokeWidth={2}
          strokeDasharray={`${trackDash} ${circumference}`}
          strokeLinecap="butt"
          transform={`rotate(${START_DEG} ${cx} ${cy})`}
        />
        {/* Amber fill showing current value */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--wb-amber)"
          strokeWidth={2}
          strokeDasharray={`${fillDash} ${circumference}`}
          strokeLinecap="butt"
          transform={`rotate(${START_DEG} ${cx} ${cy})`}
        />
        {/* Indicator tick */}
        <line
          x1={cx}
          y1={cy - r + 4}
          x2={cx}
          y2={cy - r + 10}
          stroke="var(--wb-amber)"
          strokeWidth={2}
          strokeLinecap="round"
          transform={`rotate(${angle} ${cx} ${cy})`}
        />
        {/* Focus ring */}
        {isFocused && (
          <circle
            cx={cx}
            cy={cy}
            r={r + 3}
            fill="none"
            stroke="var(--wb-amber)"
            strokeWidth={1}
            strokeDasharray="2 2"
            opacity={0.6}
          />
        )}
      </svg>
      <span className="workbench-readout text-[10px] tabular-nums">{readoutStr}</span>
    </div>
  );
}
