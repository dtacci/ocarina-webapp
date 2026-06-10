"use client";

/**
 * Clip-arrangement timeline: one canvas, lanes × clips, beat-grid snapping.
 *
 * Custom canvas rather than wavesurfer: the stems' 200-point waveform_peaks
 * make clip waveform drawing trivial, and pointer-driven move/trim stays
 * fully in our control. The canvas redraws on prop changes; during drags and
 * playback an internal rAF keeps it live (playhead reads from a ref so
 * playback never re-renders React).
 *
 * Interactions: drag a clip body to move it (snaps to the beat grid), drag
 * its left/right edge to trim (left edge adjusts the source offset so audio
 * stays anchored), double-click a clip to split it at the pointer.
 */
import { useCallback, useEffect, useRef } from "react";
import {
  arrangementLengthSec,
  type Arrangement,
  type ArrangementClip,
} from "@/lib/audio/mix-types";

const LANE_H = 64;
const RULER_H = 22;
const EDGE_PX = 7;
const MIN_CLIP_SEC = 0.05;

export interface TimelineLane {
  id: string;
  label: string;
  durationSec: number;
  peaks: number[] | null;
}

export interface TimelineCanvasProps {
  lanes: TimelineLane[];
  arrangement: Arrangement;
  onChange: (arr: Arrangement, commit: boolean) => void;
  /** Live playhead in seconds (null = not playing). Read inside rAF. */
  playheadRef?: React.RefObject<number | null>;
  pxPerSec?: number;
}

interface DragState {
  laneIndex: number;
  clipIndex: number;
  mode: "move" | "trim-l" | "trim-r";
  grabOffsetSec: number;
  original: ArrangementClip;
}

export function TimelineCanvas({
  lanes,
  arrangement,
  onChange,
  playheadRef,
  pxPerSec = 60,
}: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const arrRef = useRef(arrangement);
  useEffect(() => {
    arrRef.current = arrangement;
  }, [arrangement]);

  const widthSec = Math.max(16, arrangementLengthSec(arrangement) + 4);
  const width = Math.ceil(widthSec * pxPerSec);
  const height = RULER_H + lanes.length * LANE_H;

  const snapSec = useCallback(() => {
    const a = arrRef.current;
    if (!a.bpm || a.gridBeats <= 0) return 0;
    return (a.gridBeats * 60) / a.bpm;
  }, []);

  const snap = useCallback(
    (sec: number) => {
      const s = snapSec();
      return s > 0 ? Math.round(sec / s) * s : sec;
    },
    [snapSec],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const css = getComputedStyle(canvas);
    const ink900 = css.getPropertyValue("--ink-900") || "#161412";
    const ink800 = css.getPropertyValue("--ink-800") || "#1d1a17";
    const line = css.getPropertyValue("--wb-line") || "#3a352f";
    const ink500 = css.getPropertyValue("--ink-500") || "#8a8378";
    const amber = css.getPropertyValue("--wb-amber") || "#f0a93b";

    ctx.fillStyle = ink900;
    ctx.fillRect(0, 0, width, height);

    const a = arrRef.current;

    // Ruler + grid lines
    ctx.fillStyle = ink800;
    ctx.fillRect(0, 0, width, RULER_H);
    const grid = snapSec();
    const minor = grid > 0 ? grid : 1;
    ctx.font = "9px monospace";
    for (let s = 0; s <= widthSec; s += minor) {
      const x = Math.round(s * pxPerSec) + 0.5;
      ctx.strokeStyle = line;
      ctx.beginPath();
      ctx.moveTo(x, RULER_H);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.fillStyle = ink500;
      ctx.fillText(grid > 0 && a.bpm ? `${Math.round(s / (60 / a.bpm))}` : `${s.toFixed(0)}s`, x + 3, 13);
    }

    // Lanes + clips
    lanes.forEach((lane, li) => {
      const y = RULER_H + li * LANE_H;
      ctx.strokeStyle = line;
      ctx.beginPath();
      ctx.moveTo(0, y + LANE_H - 0.5);
      ctx.lineTo(width, y + LANE_H - 0.5);
      ctx.stroke();
      ctx.fillStyle = ink500;
      ctx.font = "10px monospace";
      ctx.fillText(lane.label.toLowerCase(), 6, y + 14);

      const laneArr = a.lanes.find((l) => l.recordingId === lane.id);
      for (const clip of laneArr?.clips ?? []) {
        const x = clip.startSec * pxPerSec;
        const w = Math.max(2, clip.durationSec * pxPerSec);
        const cy = y + 18;
        const ch = LANE_H - 24;
        ctx.fillStyle = ink800;
        ctx.fillRect(x, cy, w, ch);
        // Waveform slice for the clip's [offset, offset+duration) window.
        if (lane.peaks && lane.peaks.length > 0 && lane.durationSec > 0) {
          const peaks = lane.peaks;
          ctx.fillStyle = amber;
          ctx.globalAlpha = 0.75;
          const bars = Math.max(1, Math.floor(w / 3));
          for (let b = 0; b < bars; b++) {
            const tSec = clip.offsetSec + (b / bars) * clip.durationSec;
            const pi = Math.min(peaks.length - 1, Math.floor((tSec / lane.durationSec) * peaks.length));
            const amp = Math.max(0.04, peaks[pi] ?? 0);
            const bh = amp * (ch - 6);
            ctx.fillRect(x + b * 3 + 1, cy + (ch - bh) / 2, 2, bh);
          }
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = amber;
        ctx.strokeRect(x + 0.5, cy + 0.5, w - 1, ch - 1);
        // Edge grips
        ctx.fillStyle = amber;
        ctx.fillRect(x, cy, 2, ch);
        ctx.fillRect(x + w - 2, cy, 2, ch);
      }
    });

    // Playhead
    const ph = playheadRef?.current;
    if (ph != null) {
      const x = ph * pxPerSec;
      ctx.strokeStyle = amber;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }, [lanes, width, height, widthSec, pxPerSec, snapSec, playheadRef]);

  // Redraw on prop changes; rAF while dragging or playing.
  useEffect(() => {
    draw();
    let raf = 0;
    const tick = () => {
      if (dragRef.current || playheadRef?.current != null) draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [draw, arrangement, playheadRef]);

  const hitTest = useCallback(
    (px: number, py: number): DragState | null => {
      const a = arrRef.current;
      const li = Math.floor((py - RULER_H) / LANE_H);
      if (li < 0 || li >= lanes.length) return null;
      const laneArr = a.lanes.find((l) => l.recordingId === lanes[li].id);
      if (!laneArr) return null;
      const sec = px / pxPerSec;
      for (let ci = laneArr.clips.length - 1; ci >= 0; ci--) {
        const c = laneArr.clips[ci];
        const x0 = c.startSec * pxPerSec;
        const x1 = (c.startSec + c.durationSec) * pxPerSec;
        if (px < x0 - EDGE_PX || px > x1 + EDGE_PX) continue;
        const laneIndex = a.lanes.indexOf(laneArr);
        const mode: DragState["mode"] =
          px <= x0 + EDGE_PX ? "trim-l" : px >= x1 - EDGE_PX ? "trim-r" : "move";
        return {
          laneIndex,
          clipIndex: ci,
          mode,
          grabOffsetSec: sec - c.startSec,
          original: { ...c },
        };
      }
      return null;
    },
    [lanes, pxPerSec],
  );

  const applyDrag = useCallback(
    (px: number, commit: boolean) => {
      const d = dragRef.current;
      if (!d) return;
      const a = arrRef.current;
      const lane = a.lanes[d.laneIndex];
      const stem = lanes.find((l) => l.id === lane.recordingId);
      const stemDur = stem?.durationSec ?? d.original.durationSec;
      const sec = px / pxPerSec;
      const c = { ...d.original };

      if (d.mode === "move") {
        c.startSec = Math.max(0, snap(sec - d.grabOffsetSec));
      } else if (d.mode === "trim-r") {
        const end = Math.max(d.original.startSec + MIN_CLIP_SEC, snap(sec));
        c.durationSec = Math.min(end - c.startSec, stemDur - c.offsetSec);
      } else {
        // trim-l: move the left edge, keeping the audio anchored in time.
        const newStart = Math.min(
          snap(sec),
          d.original.startSec + d.original.durationSec - MIN_CLIP_SEC,
        );
        const delta = newStart - d.original.startSec;
        const newOffset = d.original.offsetSec + delta;
        if (newOffset < 0 || newStart < 0) return;
        c.startSec = newStart;
        c.offsetSec = newOffset;
        c.durationSec = d.original.durationSec - delta;
      }

      const lanesNext = a.lanes.map((l, i) =>
        i === d.laneIndex
          ? { ...l, clips: l.clips.map((cc, j) => (j === d.clipIndex ? c : cc)) }
          : l,
      );
      onChange({ ...a, lanes: lanesNext }, commit);
    },
    [lanes, pxPerSec, snap, onChange],
  );

  const splitAt = useCallback(
    (px: number, py: number) => {
      const hit = hitTest(px, py);
      if (!hit || hit.mode !== "move") return;
      const a = arrRef.current;
      const sec = snap(px / pxPerSec);
      const c = a.lanes[hit.laneIndex].clips[hit.clipIndex];
      if (sec <= c.startSec + MIN_CLIP_SEC || sec >= c.startSec + c.durationSec - MIN_CLIP_SEC) return;
      const head: ArrangementClip = { ...c, durationSec: sec - c.startSec };
      const tail: ArrangementClip = {
        ...c,
        startSec: sec,
        offsetSec: c.offsetSec + (sec - c.startSec),
        durationSec: c.durationSec - (sec - c.startSec),
      };
      const lanesNext = a.lanes.map((l, i) =>
        i === hit.laneIndex
          ? { ...l, clips: [...l.clips.slice(0, hit.clipIndex), head, tail, ...l.clips.slice(hit.clipIndex + 1)] }
          : l,
      );
      onChange({ ...a, lanes: lanesNext }, true);
    },
    [hitTest, snap, pxPerSec, onChange],
  );

  return (
    <div className="overflow-x-auto border border-[color:var(--wb-line)] bg-[color:var(--ink-900)]">
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="clip arrangement timeline"
        style={{ width, height, display: "block", touchAction: "none" }}
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
          if (hit) {
            dragRef.current = hit;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - rect.left;
          if (dragRef.current) {
            applyDrag(px, false);
            return;
          }
          const hit = hitTest(px, e.clientY - rect.top);
          e.currentTarget.style.cursor =
            hit?.mode === "move" ? "grab" : hit ? "ew-resize" : "default";
        }}
        onPointerUp={(e) => {
          if (!dragRef.current) return;
          const rect = e.currentTarget.getBoundingClientRect();
          applyDrag(e.clientX - rect.left, true);
          dragRef.current = null;
        }}
        onDoubleClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          splitAt(e.clientX - rect.left, e.clientY - rect.top);
        }}
      />
    </div>
  );
}
