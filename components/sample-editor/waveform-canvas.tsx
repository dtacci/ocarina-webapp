"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.esm.js";

interface Props {
  peaks: number[];
  durationSec: number;
  trimStart: number;
  trimEnd: number;
  onTrimChange: (start: number, end: number) => void;
  /** Click anywhere on the waveform → seek + play from that position. */
  onSeek?: (seconds: number) => void;
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
// Region body is invisible — the kept area is shown by the un-dimmed wave;
// only the handles + outside-dimming overlays carry the visual.
const REGION_COLOR = "transparent";

const TRIM_REGION_ID = "trim";

export const WaveformCanvas = forwardRef<WaveformCanvasHandle, Props>(
  function WaveformCanvas(
    { peaks, durationSec, trimStart, trimEnd, onTrimChange, onSeek, height = 180 },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WaveSurfer | null>(null);
    const regionsPluginRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
    const onTrimChangeRef = useRef(onTrimChange);
    const onSeekRef = useRef(onSeek);
    const durationRef = useRef(durationSec);

    // Live trim positions tracked during drag so the gray-out overlays move
    // smoothly with the handles (not just on mouseup). External sync below.
    const [liveTrim, setLiveTrim] = useState({ start: trimStart, end: trimEnd });

    useImperativeHandle(
      ref,
      () => ({
        setPlayhead: (sec: number) => {
          wsRef.current?.setTime(sec);
        },
      }),
      [],
    );

    // Keep callback refs fresh without re-initializing WaveSurfer on each render.
    useEffect(() => {
      onTrimChangeRef.current = onTrimChange;
    }, [onTrimChange]);
    useEffect(() => {
      onSeekRef.current = onSeek;
    }, [onSeek]);
    useEffect(() => {
      durationRef.current = durationSec;
    }, [durationSec]);

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

      // Cancellation flag local to THIS effect run. Strict Mode in dev
      // mounts → unmounts → remounts; without this flag, the deferred
      // addRegion from the first run fires after its cleanup destroyed
      // the plugin, triggering "WaveSurfer is not initialized".
      let effectCancelled = false;

      const addRegion = () => {
        if (effectCancelled) return;
        // Visible edges + grip glyphs are styled in globals.css under the
        // .workbench scope (target [part*="region-handle"]). The region body
        // is invisible — only the handles + outside-dim overlays carry the
        // visual.
        regions.addRegion({
          id: TRIM_REGION_ID,
          start: trimStart,
          end: trimEnd,
          drag: true,
          resize: true,
          color: REGION_COLOR,
          content: "",
        });
      };

      wsRef.current = ws;

      // Add the region only AFTER the wavesurfer's decoded data is ready,
      // so the regions plugin sees the correct totalDuration when clamping
      // the region's start/end. In peaks-only mode the "decode" event fires
      // shortly after create() resolves the load microtask.
      let regionAdded = false;
      const tryAddOnce = () => {
        if (regionAdded || effectCancelled) return;
        regionAdded = true;
        addRegion();
      };
      ws.on("decode", tryAddOnce);
      ws.on("ready", tryAddOnce);

      // Trim updates: continuous during drag (live overlays) + final commit
      // on mouseup (single undo-stack entry). Skip events while the
      // wavesurfer is still spinning up its duration — those would clamp
      // start/end to a partial value.
      regions.on("region-update", (region) => {
        if (region.id !== TRIM_REGION_ID || !regionAdded) return;
        setLiveTrim({ start: region.start, end: region.end });
      });
      // Releasing a trim drag fires a synthetic click (browsers emit one at
      // the common ancestor of mousedown/mouseup) — without this guard, every
      // handle drag would end with an accidental seek + play.
      let suppressClickUntil = 0;

      regions.on("region-updated", (region) => {
        if (region.id !== TRIM_REGION_ID || !regionAdded) return;
        suppressClickUntil = performance.now() + 150;
        setLiveTrim({ start: region.start, end: region.end });
        onTrimChangeRef.current(region.start, region.end);
      });

      // Click-to-seek: clicks bubble up from the wave/region children.
      const containerEl = containerRef.current;
      const handleClick = (e: MouseEvent) => {
        const onSeekFn = onSeekRef.current;
        if (!onSeekFn || !containerEl) return;
        // Drag-release click — the trim commit above just happened.
        if (performance.now() < suppressClickUntil) return;
        // Direct click on a resize handle (no drag): skip. The wavesurfer DOM
        // lives in a shadow root, so e.target is retargeted to the host and
        // closest() can never see the handle — composedPath() pierces it.
        // (Plugin uses `part="region-handle region-handle-left|right"`.)
        const onHandle = e.composedPath().some((el) =>
          (el as Element).getAttribute?.("part")?.includes("region-handle"),
        );
        if (onHandle) return;
        const rect = containerEl.getBoundingClientRect();
        if (rect.width <= 0) return;
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const t = (x / rect.width) * durationRef.current;
        onSeekFn(t);
      };
      containerEl?.addEventListener("click", handleClick);

      regionsPluginRef.current = regions;

      return () => {
        effectCancelled = true;
        containerEl?.removeEventListener("click", handleClick);
        ws.destroy();
        // Only null the refs if THIS effect's instance is still the active
        // one — the next effect run may have already overwritten them.
        if (wsRef.current === ws) wsRef.current = null;
        if (regionsPluginRef.current === regions) regionsPluginRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // init-only; trim syncing below

    // Sync external trim changes (undo/redo, keyboard shortcuts) back into the
    // region AND the live overlay state.
    useEffect(() => {
      setLiveTrim({ start: trimStart, end: trimEnd });
      const regions = regionsPluginRef.current;
      if (!regions) return;
      const list = regions.getRegions();
      const trim = list.find((r) => r.id === TRIM_REGION_ID);
      if (!trim) return;
      if (Math.abs(trim.start - trimStart) > 0.001 || Math.abs(trim.end - trimEnd) > 0.001) {
        trim.setOptions({ start: trimStart, end: trimEnd });
      }
    }, [trimStart, trimEnd]);

    const safeDuration = Math.max(0.001, durationSec);
    const leftPct = Math.max(0, Math.min(1, liveTrim.start / safeDuration)) * 100;
    const rightPct = Math.max(0, Math.min(1, (safeDuration - liveTrim.end) / safeDuration)) * 100;
    const startPct = leftPct;
    const endPct = 100 - rightPct;

    return (
      <div className="space-y-0 border border-[color:var(--wb-line)] bg-[color:var(--ink-800)]">
        <div ref={timelineRef} className="border-b border-[color:var(--wb-line-soft)]" />
        <div className="relative">
          <div ref={containerRef} className="relative" />
          {/* Gray-out overlay: dim the trimmed-off head + tail so the kept
              area visually pops. pointer-events: none so the wavesurfer
              region drag handles still receive input. */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0 left-0 transition-[width] duration-75"
            style={{
              width: `${leftPct}%`,
              background: "color-mix(in oklch, var(--ink-900) 70%, transparent)",
              backdropFilter: "saturate(0.2)",
              WebkitBackdropFilter: "saturate(0.2)",
              zIndex: 4,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0 right-0 transition-[width] duration-75"
            style={{
              width: `${rightPct}%`,
              background: "color-mix(in oklch, var(--ink-900) 70%, transparent)",
              backdropFilter: "saturate(0.2)",
              WebkitBackdropFilter: "saturate(0.2)",
              zIndex: 4,
            }}
          />
          {/* Trim time markers — down-facing amber triangles aligned with
              the trim in/out edges. Float at the top of the wave area, with
              their tip pointing down into the cut line. */}
          <TrimMarker pct={startPct} />
          <TrimMarker pct={endPct} />
        </div>
      </div>
    );
  },
);

function TrimMarker({ pct }: { pct: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute transition-[left] duration-75"
      style={{
        top: -2,
        left: `${pct}%`,
        transform: "translateX(-50%)",
        zIndex: 11,
        width: 0,
        height: 0,
        borderLeft: "5px solid transparent",
        borderRight: "5px solid transparent",
        borderTop: "8px solid var(--wb-amber)",
        filter: "drop-shadow(0 0 4px var(--wb-amber))",
      }}
    />
  );
}
