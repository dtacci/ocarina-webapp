"use client";

import { useEffect, useRef } from "react";
import type { NoteSample } from "@/components/diagnostics/note-readout";

interface Props {
  current: NoteSample | null;
  history: NoteSample[];
}

const STRIP_WINDOW_MS = 8_000;
const TICK_MS = 80;

/**
 * Phase 1 mic-activity strip. Renders the last ~8s of NOTE telemetry as a
 * left-scrolling waterfall: each sample plotted by (age, confidence).
 * Pitch confidence stands in for level until the Pi adds a dedicated MIC_LEVEL
 * telemetry frame; the caption flags that limitation.
 */
export function MicActivityStrip({ current, history }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<NoteSample[]>([]);
  historyRef.current = history;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const render = () => {
      const now = Date.now();
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
        canvas.width = cssWidth * dpr;
        canvas.height = cssHeight * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, cssWidth, cssHeight);

      // Mid line for visual grounding.
      ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, cssHeight / 2);
      ctx.lineTo(cssWidth, cssHeight / 2);
      ctx.stroke();

      const samples = historyRef.current;
      for (const s of samples) {
        const age = now - s.ts;
        if (age > STRIP_WINDOW_MS) continue;
        const x = cssWidth - (age / STRIP_WINDOW_MS) * cssWidth;
        const conf = Math.max(0, Math.min(1, s.confidence ?? 0.5));
        const half = (conf * (cssHeight - 10)) / 2;
        const alpha = 0.25 + 0.75 * (1 - age / STRIP_WINDOW_MS);
        ctx.fillStyle = `rgba(16, 185, 129, ${alpha.toFixed(2)})`;
        ctx.fillRect(x - 1, cssHeight / 2 - half, 2, half * 2);
      }

      raf = window.requestAnimationFrame(() => {
        // Throttle to ~12fps via setTimeout chained into rAF.
        window.setTimeout(render, TICK_MS);
      });
    };

    render();
    return () => window.cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Mic activity</h2>
        <span className="font-mono text-[10px] text-muted-foreground">
          pitch confidence · last 8s
        </span>
      </div>
      <canvas ref={canvasRef} className="h-20 w-full rounded-md bg-background/60" />
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          {current ? `${current.name} · ${current.hz.toFixed(1)} Hz` : "—"}
        </span>
        <span className="text-muted-foreground/70">
          raw mic level needs a Pi firmware update
        </span>
      </div>
    </div>
  );
}
