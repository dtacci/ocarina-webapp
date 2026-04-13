"use client";

/**
 * Overlay animation shown during offline render on save.
 *
 * Tone.Offline doesn't expose per-frame progress, so the sweep is driven
 * by an animation timer tied to an expected render duration (typically
 * real-time-or-faster). If the render finishes early, progress is snapped
 * to 1.0; if it overruns, the sweep pauses at 0.95 until the promise resolves.
 *
 * Positioned absolutely over the WaveformCanvas container. Uses the
 * `.workbench-bake-mask` utility (defined in globals.css) which reads
 * the `--bake-progress` CSS variable (0..1) for horizontal translation.
 */

import { forwardRef, useImperativeHandle, useRef, useState, type CSSProperties } from "react";

export interface BakeOverlayHandle {
  /** Start the sweep. `estimatedMs` controls how fast it moves. */
  start: (estimatedMs: number) => void;
  /** Jump to 100% and fade out after a short hold. */
  finish: () => Promise<void>;
  /** Abort (e.g. on error) — fade out without completing. */
  cancel: () => void;
}

export const BakeOverlay = forwardRef<BakeOverlayHandle>(function BakeOverlay(_props, ref) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef<number>(0);
  const estimateRef = useRef<number>(1000);

  const stopRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useImperativeHandle(ref, () => ({
    start: (estimatedMs) => {
      estimateRef.current = Math.max(200, estimatedMs);
      startTsRef.current = performance.now();
      setProgress(0);
      setVisible(true);

      const tick = () => {
        const elapsed = performance.now() - startTsRef.current;
        // Ease toward estimate but cap at 0.95 until finish() is called.
        const raw = Math.min(0.95, elapsed / estimateRef.current);
        setProgress(raw);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    finish: async () => {
      stopRaf();
      setProgress(1);
      // Brief hold at 100% so the user sees completion.
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      setVisible(false);
      setProgress(0);
    },
    cancel: () => {
      stopRaf();
      setVisible(false);
      setProgress(0);
    },
  }));

  if (!visible) return null;

  return (
    <div
      className="workbench-bake-mask"
      style={{ "--bake-progress": progress } as CSSProperties}
      aria-hidden="true"
    />
  );
});
