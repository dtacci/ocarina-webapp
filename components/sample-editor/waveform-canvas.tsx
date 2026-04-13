"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.esm.js";

interface Props {
  peaks: number[];
  durationSec: number;
  trimStart: number;
  trimEnd: number;
  onTrimChange: (start: number, end: number) => void;
  height?: number;
}

/**
 * Imperative handle exposed to the editor so the rAF playback loop can
 * update the cursor without going through React state (which would
 * re-render the whole editor 60× per second during playback).
 */
export interface WaveformCanvasHandle {
  setPlayhead: (sec: number) => void;
}

const WAVE_COLOR = "oklch(0.50 0.012 75)"; // --ink-500
const PROGRESS_COLOR = "oklch(0.78 0.18 68)"; // --wb-amber
const CURSOR_COLOR = "oklch(0.78 0.18 68)";
const REGION_COLOR = "oklch(0.78 0.18 68 / 0.12)";
const REGION_HANDLE_COLOR = "oklch(0.78 0.18 68)";

const TRIM_REGION_ID = "trim";

export const WaveformCanvas = forwardRef<WaveformCanvasHandle, Props>(
  function WaveformCanvas(
    { peaks, durationSec, trimStart, trimEnd, onTrimChange, height = 180 },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WaveSurfer | null>(null);
    const regionsPluginRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
    const onTrimChangeRef = useRef(onTrimChange);

    useImperativeHandle(
      ref,
      () => ({
        setPlayhead: (sec: number) => {
          wsRef.current?.setTime(sec);
        },
      }),
      [],
    );

    // Keep callback ref fresh without re-initializing WaveSurfer on each render.
    useEffect(() => {
      onTrimChangeRef.current = onTrimChange;
    }, [onTrimChange]);

    // Initialize WaveSurfer once (peaks + duration only — no audio source).
    useEffect(() => {
      if (!containerRef.current || !timelineRef.current || wsRef.current) return;

      const peaksData: number[][] =
        peaks && peaks.length > 0 ? [peaks] : [new Array(200).fill(0)];

      const timeline = TimelinePlugin.create({
        height: 18,
        container: timelineRef.current,
        insertPosition: "beforebegin",
        timeInterval: 0.1,
        primaryLabelInterval: 1,
        style: {
          fontSize: "10px",
          fontFamily: "var(--font-mono), monospace",
          color: "oklch(0.50 0.012 75)",
          letterSpacing: "0.05em",
        },
      });

      const regions = RegionsPlugin.create();

      const ws = WaveSurfer.create({
        container: containerRef.current,
        height,
        waveColor: WAVE_COLOR,
        progressColor: PROGRESS_COLOR,
        cursorColor: CURSOR_COLOR,
        cursorWidth: 1,
        barWidth: 3,
        barGap: 1,
        barRadius: 2,
        peaks: peaksData,
        duration: durationSec,
        interact: false,
        plugins: [timeline, regions],
      });

      const addRegion = () => {
        const region = regions.addRegion({
          id: TRIM_REGION_ID,
          start: trimStart,
          end: trimEnd,
          drag: true,
          resize: true,
          color: REGION_COLOR,
          content: "",
        });
        const regionEl = (region as unknown as { element: HTMLElement }).element;
        if (regionEl) {
          regionEl.style.setProperty("--region-handle", REGION_HANDLE_COLOR);
          regionEl.style.borderLeft = `2px solid ${REGION_HANDLE_COLOR}`;
          regionEl.style.borderRight = `2px solid ${REGION_HANDLE_COLOR}`;
        }
      };

      // In peaks-only mode, wavesurfer fires "ready" synchronously after create().
      // Guard against both timings.
      let readyFired = false;
      ws.on("ready", () => {
        if (readyFired) return;
        readyFired = true;
        addRegion();
      });
      queueMicrotask(() => {
        if (!readyFired) {
          readyFired = true;
          addRegion();
        }
      });

      regions.on("region-updated", (region) => {
        if (region.id !== TRIM_REGION_ID) return;
        onTrimChangeRef.current(region.start, region.end);
      });

      wsRef.current = ws;
      regionsPluginRef.current = regions;

      return () => {
        ws.destroy();
        wsRef.current = null;
        regionsPluginRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // init-only; trim syncing below

    // Sync external trim changes (undo/redo, keyboard shortcuts) back into the region.
    useEffect(() => {
      const regions = regionsPluginRef.current;
      if (!regions) return;
      const list = regions.getRegions();
      const trim = list.find((r) => r.id === TRIM_REGION_ID);
      if (!trim) return;
      if (Math.abs(trim.start - trimStart) > 0.001 || Math.abs(trim.end - trimEnd) > 0.001) {
        trim.setOptions({ start: trimStart, end: trimEnd });
      }
    }, [trimStart, trimEnd]);

    return (
      <div className="space-y-0 border border-[color:var(--wb-line)] bg-[color:var(--ink-800)]">
        <div ref={timelineRef} className="border-b border-[color:var(--wb-line-soft)]" />
        <div ref={containerRef} className="relative" />
      </div>
    );
  },
);
