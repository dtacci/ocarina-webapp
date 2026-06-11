"use client";

/**
 * CDJ-style full-track overview: peaks bar + playhead + cue/hot-cue markers.
 *
 * Two stacked canvases so playback costs nothing per frame beyond the overlay:
 *  - base: the peaks, redrawn only when peaks or size change
 *  - overlay: playhead + elapsed shading + markers, rAF-driven from
 *    deck.getState() (no React state during playback — workbench contract)
 *
 * Pointer down/drag seeks (fraction of width → seconds), with capture.
 */
import { useCallback, useEffect, useRef } from "react";
import type { DjDeck } from "@/lib/audio/dj-engine";

const PAD_VARS = ["--dj-pad-1", "--dj-pad-2", "--dj-pad-3", "--dj-pad-4"];

export interface WaveformOverviewProps {
  peaks: number[] | null;
  deck: DjDeck;
  deckLabel: "A" | "B";
  height?: number;
}

export function WaveformOverview({
  peaks,
  deck,
  deckLabel,
  height = 56,
}: WaveformOverviewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef<number | null>(null);

  const cssVar = useCallback((name: string, fallback: string): string => {
    const el = wrapRef.current;
    if (!el) return fallback;
    return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
  }, []);

  // ── base layer: peaks ─────────────────────────────────────────────────────
  const drawBase = useCallback(() => {
    const canvas = baseRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    canvas.width = w * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, height);
    if (!peaks || peaks.length === 0) {
      ctx.strokeStyle = cssVar("--wb-line", "#444");
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(w, height / 2);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = cssVar("--wb-amber-dim", "#8a6420");
    const mid = height / 2;
    const barW = w / peaks.length;
    for (let i = 0; i < peaks.length; i++) {
      const h = Math.max(1, peaks[i] * (height - 6));
      ctx.fillRect(i * barW, mid - h / 2, Math.max(barW - 0.5, 0.5), h);
    }
  }, [peaks, height, cssVar]);

  useEffect(() => {
    drawBase();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(drawBase);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [drawBase]);

  // ── overlay layer: playhead + markers, rAF ────────────────────────────────
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const canvas = overlayRef.current;
      const wrap = wrapRef.current;
      if (canvas && wrap) {
        const dpr = window.devicePixelRatio || 1;
        const w = wrap.clientWidth;
        if (canvas.width !== w * dpr || canvas.height !== height * dpr) {
          canvas.width = w * dpr;
          canvas.height = height * dpr;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, w, height);
          const s = deck.getState();
          if (s.durationSec > 0) {
            const x = (s.positionSec / s.durationSec) * w;
            // elapsed shading
            ctx.fillStyle = "oklch(0.96 0.008 80 / 0.08)";
            ctx.fillRect(0, 0, x, height);
            // main cue marker
            const cueX = (s.cueSec / s.durationSec) * w;
            ctx.fillStyle = cssVar("--dj-cue", "#d08030");
            ctx.fillRect(cueX - 0.5, 0, 1, height);
            ctx.beginPath();
            ctx.moveTo(cueX - 4, 0);
            ctx.lineTo(cueX + 4, 0);
            ctx.lineTo(cueX, 5);
            ctx.closePath();
            ctx.fill();
            // hot cues
            s.hotCues.forEach((sec, i) => {
              if (sec === null) return;
              const hx = (sec / s.durationSec) * w;
              ctx.fillStyle = cssVar(PAD_VARS[i], "#888");
              ctx.fillRect(hx - 0.5, 0, 1, height);
              ctx.fillRect(hx - 3, 0, 6, 4);
            });
            // playhead
            ctx.fillStyle = cssVar("--ink-100", "#eee");
            ctx.fillRect(x - 1, 0, 2, height);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deck, height, cssVar]);

  // ── seek on pointer ───────────────────────────────────────────────────────
  const seekAt = useCallback(
    (clientX: number) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const s = deck.getState();
      if (!s.loaded || s.durationSec === 0) return;
      const rect = wrap.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      deck.seek(frac * s.durationSec);
    },
    [deck],
  );

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={`waveform deck ${deckLabel}`}
      className="relative w-full cursor-ew-resize border border-[color:var(--wb-line-soft)] bg-[color:var(--ink-900)]"
      style={{ height, touchAction: "none" }}
      onPointerDown={(e) => {
        e.preventDefault();
        wrapRef.current?.setPointerCapture(e.pointerId);
        draggingRef.current = e.pointerId;
        seekAt(e.clientX);
      }}
      onPointerMove={(e) => {
        if (draggingRef.current !== e.pointerId) return;
        seekAt(e.clientX);
      }}
      onPointerUp={(e) => {
        if (draggingRef.current !== e.pointerId) return;
        wrapRef.current?.releasePointerCapture(e.pointerId);
        draggingRef.current = null;
      }}
      onPointerCancel={(e) => {
        if (draggingRef.current !== e.pointerId) return;
        draggingRef.current = null;
      }}
    >
      <canvas ref={baseRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={overlayRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
