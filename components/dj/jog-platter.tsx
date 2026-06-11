"use client";

/**
 * Simplified CDJ jog platter — screen candy with two useful drags:
 *  - paused: rotating the platter scrubs the playhead (1 revolution ≈ 1.8 s)
 *  - playing: rotating nudges the tempo (angular velocity → temporary rate
 *    offset), restored on pointer up/cancel — pointer-capture loss must never
 *    leave the deck detuned.
 *
 * Rotation + center readout are rAF straight into the DOM (no setState at
 * frame rate). setRate during a nudge is throttled to the same rAF.
 */
import { useEffect, useRef } from "react";
import type { DjDeck } from "@/lib/audio/dj-engine";

const SEC_PER_REV = 1.8; // CDJ vinyl-mode feel
const DEG_PER_SEC_AT_UNITY = 200; // idle spin speed at rate 1

function fmtRemaining(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "-0:00.0";
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, "0");
  return `-${m}:${s}`;
}

export interface JogPlatterProps {
  deck: DjDeck;
  deckLabel: "A" | "B";
  size?: number;
}

export function JogPlatter({ deck, deckLabel, size = 176 }: JogPlatterProps) {
  const discRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Drag state — all refs; pointermove only records, rAF applies.
  const drag = useRef<{
    pointerId: number;
    lastAngle: number;
    baseRate: number;
    playing: boolean;
    pendingDeg: number;
  } | null>(null);
  const spinDeg = useRef(0);

  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();
    const tick = (t: number) => {
      const dt = (t - lastT) / 1000;
      lastT = t;
      const s = deck.getState();

      const d = drag.current;
      if (d) {
        // Apply accumulated drag rotation.
        const deltaDeg = d.pendingDeg;
        d.pendingDeg = 0;
        spinDeg.current += deltaDeg;
        if (d.playing) {
          // Nudge: rotation speed maps to a rate offset around the base.
          const revPerSec = dt > 0 ? deltaDeg / 360 / dt : 0;
          const offset = Math.max(-0.06, Math.min(0.06, revPerSec * 0.08));
          deck.setRate(Math.max(0.5, d.baseRate + offset));
        } else if (deltaDeg !== 0) {
          deck.seek(s.positionSec + (deltaDeg / 360) * SEC_PER_REV);
        }
      } else if (s.playing) {
        spinDeg.current = (spinDeg.current + DEG_PER_SEC_AT_UNITY * s.rate * dt) % 360;
      }

      if (discRef.current) {
        discRef.current.style.transform = `rotate(${spinDeg.current}deg)`;
      }
      if (timeRef.current) {
        timeRef.current.textContent = fmtRemaining(s.durationSec - s.positionSec);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deck]);

  const angleAt = (e: React.PointerEvent): number => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.playing) deck.setRate(d.baseRate); // always restore — no detuned exits
    try {
      wrapRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    drag.current = null;
  };

  return (
    <div
      ref={wrapRef}
      aria-label={`jog platter deck ${deckLabel}`}
      className="relative select-none rounded-full border-2 border-[color:var(--ink-600)] bg-[color:var(--ink-800)] shadow-[inset_0_0_24px_oklch(0_0_0_/_0.55)]"
      style={{ width: size, height: size, touchAction: "none", cursor: "grab" }}
      onPointerDown={(e) => {
        const s = deck.getState();
        if (!s.loaded) return;
        e.preventDefault();
        wrapRef.current?.setPointerCapture(e.pointerId);
        drag.current = {
          pointerId: e.pointerId,
          lastAngle: angleAt(e),
          baseRate: s.rate,
          playing: s.playing,
          pendingDeg: 0,
        };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.pointerId !== e.pointerId) return;
        const a = angleAt(e);
        let delta = a - d.lastAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        d.lastAngle = a;
        d.pendingDeg += delta; // applied by the rAF loop
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* rotating disc: strobe dots ring */}
      <div ref={discRef} className="absolute inset-2 rounded-full will-change-transform">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full"
            style={{
              background: i === 0 ? "var(--wb-amber)" : "var(--ink-600)",
              transform: `rotate(${i * 30}deg) translateY(-${size / 2 - 14}px)`,
            }}
          />
        ))}
      </div>
      {/* fixed center display */}
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-[color:var(--wb-line)] bg-[color:var(--ink-900)]"
        style={{ width: size * 0.52, height: size * 0.52 }}
      >
        <span className="workbench-label text-[9px]">remain</span>
        <span ref={timeRef} className="workbench-readout text-xs tabular-nums">
          -0:00.0
        </span>
      </div>
    </div>
  );
}
