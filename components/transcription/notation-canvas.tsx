"use client";

/**
 * Renders MusicXML as engraved notation via OpenSheetMusicDisplay (doc §4.1).
 *
 * Client-only — OSMD needs the DOM. The parent loads this through next/dynamic
 * with `{ ssr: false }` so the OSMD bundle never runs server-side.
 *
 * Beyond rendering:
 *  - `zoom`: re-renders at a scale without reloading the score.
 *  - `playheadSec` + `isPlaying`: lights the currently-sounding noteheads orange.
 *    Auto-scroll is gentle and yields to the user: it only nudges when the
 *    active note is off-screen, and pauses for 4s after any manual scroll.
 *  - `onNoteClick`: clicking a note reports its onset (in playback seconds at
 *    the current tempo), pitch, and duration so the parent can seek the synth.
 *
 * Both features run off a "step map" built by sweeping OSMD's cursor once per
 * render: each step records the musical timestamp plus the live SVG elements
 * of the notes sounding there. Highlights binary-search the map by time;
 * clicks resolve against the elements' *live* bounding rects (OSMD's internal
 * layout boxes can be degenerate — see the recurring `width not > 0` warning —
 * so we never trust them for hit-testing). OSMD's autoResize can re-render
 * behind our back and replace the SVG; a cheap `isConnected` check detects
 * that and rebuilds the map on demand.
 *
 * OSMD calls are wrapped defensively so a cursor hiccup degrades to "no
 * highlight" rather than blanking the score.
 */

import { useEffect, useRef, useState } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { Skeleton } from "@/components/ui/skeleton";

export interface NoteClickInfo {
  /** Note onset in playback seconds at the tempo passed via `tempoBpm`. */
  seconds: number;
  /** MIDI pitch of the first note at this step, or null for rests. */
  midi: number | null;
  /** Sounding duration in playback seconds. */
  durationSec: number;
}

export interface NotationCanvasProps {
  musicxml: string;
  zoom?: number;
  playheadSec?: number | null;
  isPlaying?: boolean;
  tempoBpm?: number;
  onNoteClick?: (info: NoteClickInfo) => void;
  className?: string;
}

const ACTIVE_CLASS = "osmd-note-active";

const PITCH_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const midiName = (m: number) => `${PITCH_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

/** One cursor step: a musical onset and the notes' live SVG <g> elements. */
interface NoteStep {
  /** Onset in whole notes (OSMD timestamp units; a quarter note = 0.25). */
  whole: number;
  /** Duration of the longest note at this step, in whole notes. */
  durWhole: number;
  els: Element[];
  midi: number | null;
  isRest: boolean;
}

export default function NotationCanvas({
  musicxml,
  zoom = 1,
  playheadSec = null,
  isPlaying = false,
  tempoBpm = 120,
  onNoteClick,
  className,
}: NotationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const readyRef = useRef(false);
  const stepsRef = useRef<NoteStep[]>([]);
  const highlightedRef = useRef<Element[]>([]);
  const lastScrollRef = useRef(0);
  const userScrollUntilRef = useRef(0);
  // Latest-value refs so the single delegated click listener never goes stale.
  const tempoBpmRef = useRef(tempoBpm);
  const onNoteClickRef = useRef(onNoteClick);
  tempoBpmRef.current = tempoBpm;
  onNoteClickRef.current = onNoteClick;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Whole-note timestamp of the highlighted step, so a rebuild (zoom/resize)
  // can re-apply the highlight to the replacement SVG elements.
  const lastWholeRef = useRef<number | null>(null);

  const clearHighlight = () => {
    for (const el of highlightedRef.current) el.classList.remove(ACTIVE_CLASS);
    highlightedRef.current = [];
    lastWholeRef.current = null;
  };

  const applyStepHighlight = (step: NoteStep) => {
    if (step.els === highlightedRef.current) return;
    for (const el of highlightedRef.current) el.classList.remove(ACTIVE_CLASS);
    for (const el of step.els) el.classList.add(ACTIVE_CLASS);
    highlightedRef.current = step.els;
    lastWholeRef.current = step.whole;
  };

  /** After a re-render replaced the SVG, restore the highlight if there was one. */
  const reapplyHighlight = () => {
    const lw = lastWholeRef.current;
    if (lw == null) return;
    const step = stepsRef.current.find((s) => Math.abs(s.whole - lw) < 1e-6);
    if (step) applyStepHighlight(step);
  };

  /**
   * Sweep the cursor across the whole score, recording each step's musical
   * timestamp and the live SVG elements of its notes. Called after every
   * render we initiate; `freshSteps` re-runs it if OSMD re-rendered on its
   * own (autoResize) and orphaned the recorded elements.
   */
  const buildStepMap = () => {
    const osmd = osmdRef.current;
    const steps: NoteStep[] = [];
    stepsRef.current = steps;
    highlightedRef.current = []; // old elements are gone; keep lastWholeRef for re-apply
    if (!osmd) return;
    try {
      const cursor = osmd.cursor;
      if (!cursor) return;
      cursor.reset();
      let guard = 0;
      while (!cursor.iterator?.EndReached && guard++ < 20000) {
        const whole = cursor.iterator?.currentTimeStamp?.RealValue ?? 0;
        const gnotes = cursor.GNotesUnderCursor?.() ?? [];
        const els: Element[] = [];
        let midi: number | null = null;
        let durWhole = 0;
        let sawPitch = false;
        for (const gn of gnotes) {
          try {
            const el = (gn as unknown as {
              getSVGGElement?: () => SVGGElement | null;
            }).getSVGGElement?.();
            if (el) els.push(el);
            const src = (gn as unknown as {
              sourceNote?: {
                Pitch?: { Frequency?: number };
                Length?: { RealValue?: number };
              };
            }).sourceNote;
            const freq = src?.Pitch?.Frequency;
            if (typeof freq === "number" && freq > 0) {
              sawPitch = true;
              if (midi == null) midi = Math.round(69 + 12 * Math.log2(freq / 440));
            }
            durWhole = Math.max(durWhole, src?.Length?.RealValue ?? 0);
          } catch {
            /* skip malformed graphical notes */
          }
        }
        if (els.length > 0) {
          steps.push({ whole, durWhole, els, midi, isRest: !sawPitch });
        }
        cursor.next();
      }
      // Make notes keyboard-reachable: Tab onto a note, ←/→ to move, Enter to
      // play from there (handled by the container's keydown listener).
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const primary = s.els[0];
        primary.setAttribute("tabindex", "0");
        primary.setAttribute("role", "button");
        primary.setAttribute(
          "aria-label",
          `${s.isRest || s.midi == null ? "Rest" : midiName(s.midi)}, note ${i + 1} of ${steps.length}. Press Enter to play from here.`,
        );
      }
      cursor.reset();
    } catch {
      /* map is best-effort; clicks/highlight just won't resolve */
    }
  };

  /** Step map, rebuilt if OSMD's autoResize replaced the SVG under us. */
  const freshSteps = (): NoteStep[] => {
    const steps = stepsRef.current;
    if (steps.length === 0 || !steps[0].els[0]?.isConnected) {
      buildStepMap();
      reapplyHighlight();
    }
    return stepsRef.current;
  };

  // Load + render the score whenever the MusicXML changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    if (!osmdRef.current) {
      osmdRef.current = new OpenSheetMusicDisplay(container, {
        autoResize: true,
        backend: "svg",
        drawingParameters: "compact",
        drawTitle: false,
        drawPartNames: false,
        followCursor: false,
        // Cursor drives the step map + highlight; kept invisible.
        cursorsOptions: [{ type: 0, color: "#000000", alpha: 0, follow: false }],
      });
    }
    const osmd = osmdRef.current;

    readyRef.current = false;
    stepsRef.current = [];
    setLoading(true);
    setError(null);

    osmd
      .load(musicxml)
      .then(() => {
        if (cancelled) return;
        osmd.zoom = zoom;
        osmd.render();
        readyRef.current = true;
        buildStepMap();
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to render notation");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicxml]);

  // Re-render on zoom change (no reload).
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !readyRef.current) return;
    try {
      highlightedRef.current = [];
      osmd.zoom = zoom;
      osmd.render();
      buildStepMap();
      reapplyHighlight();
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // Highlight the sounding notes from the synth playhead.
  useEffect(() => {
    if (!readyRef.current) return;
    try {
      if (playheadSec == null) {
        clearHighlight();
        return;
      }

      const steps = freshSteps();
      if (steps.length === 0) return;

      // Last step whose onset is at or before the playhead (binary search).
      const targetWhole = ((playheadSec * tempoBpm) / 60) / 4 + 1e-6;
      let lo = 0;
      let hi = steps.length - 1;
      let idx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (steps[mid].whole <= targetWhole) {
          idx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (idx < 0) {
        clearHighlight();
        return;
      }

      applyStepHighlight(steps[idx]);
      const els = steps[idx].els;

      // Gentle follow: instant-yielding scroll only when off-screen, and not
      // within 4s of a manual scroll.
      if (isPlaying && els[0]) {
        const now = performance.now();
        const rect = els[0].getBoundingClientRect();
        const offTop = rect.top < 140;
        const offBottom = rect.bottom > window.innerHeight - 80;
        const userScrolling = now < userScrollUntilRef.current;
        if ((offTop || offBottom) && now - lastScrollRef.current > 600 && !userScrolling) {
          els[0].scrollIntoView({ block: "center", behavior: "smooth" });
          lastScrollRef.current = now;
        }
      }
    } catch {
      /* highlight is best-effort */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playheadSec, isPlaying, tempoBpm]);

  // Click/keyboard note activation: delegated listeners on the container.
  // Clicks resolve the step by DOM containment first, then by proximity to
  // the notes' live rects; keyboard uses the focused element (notes carry
  // tabindex + role=button from the step-map build).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const activateStep = (step: NoteStep) => {
      // Highlight immediately — don't wait for the playhead round-trip (which
      // React may skip entirely when re-activating the same note).
      applyStepHighlight(step);
      const bpm = tempoBpmRef.current;
      const wholeToSec = (w: number) => (w * 4 * 60) / bpm;
      onNoteClickRef.current?.({
        seconds: wholeToSec(step.whole),
        midi: step.isRest ? null : step.midi,
        durationSec: wholeToSec(step.durWhole),
      });
    };

    const stepOfTarget = (target: Node | null) =>
      target
        ? freshSteps().find((s) => s.els.some((el) => el === target || el.contains(target))) ?? null
        : null;

    const onClick = (e: MouseEvent) => {
      if (!onNoteClickRef.current || !readyRef.current) return;
      const steps = freshSteps();
      if (steps.length === 0) return;

      let hit = stepOfTarget(e.target as Node | null);
      if (!hit) {
        // Near-miss tolerance: noteheads are ~12px; accept clicks within 24px
        // of a note's center so stems/whitespace right next to a head count.
        let best = Number.POSITIVE_INFINITY;
        for (const s of steps) {
          for (const el of s.els) {
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) continue;
            const dx = e.clientX - (r.left + r.width / 2);
            const dy = e.clientY - (r.top + r.height / 2);
            const d = Math.hypot(dx, dy);
            if (d < best) {
              best = d;
              hit = s;
            }
          }
        }
        if (best > 24) hit = null;
      }
      if (hit) activateStep(hit);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!readyRef.current) return;
      const steps = freshSteps();
      const current = stepOfTarget(e.target as Node | null);
      if (!current) return;

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activateStep(current);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const idx = steps.indexOf(current);
        const next = steps[idx + (e.key === "ArrowRight" ? 1 : -1)];
        const focusEl = next?.els[0] as HTMLElement | undefined;
        focusEl?.focus();
        focusEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    };

    container.addEventListener("click", onClick);
    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("click", onClick);
      container.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Let playback auto-scroll yield to manual scrolling.
  useEffect(() => {
    const onUserScroll = () => {
      userScrollUntilRef.current = performance.now() + 4000;
    };
    window.addEventListener("wheel", onUserScroll, { passive: true });
    window.addEventListener("touchmove", onUserScroll, { passive: true });
    return () => {
      window.removeEventListener("wheel", onUserScroll);
      window.removeEventListener("touchmove", onUserScroll);
    };
  }, []);

  // Dispose OSMD on unmount.
  useEffect(() => {
    return () => {
      try {
        osmdRef.current?.clear();
      } catch {
        /* noop */
      }
      osmdRef.current = null;
      readyRef.current = false;
      stepsRef.current = [];
      highlightedRef.current = [];
    };
  }, []);

  return (
    <div className={className}>
      {error ? (
        <p className="text-sm text-destructive">
          Couldn&apos;t render this notation: {error}
        </p>
      ) : null}
      {loading ? <Skeleton className="h-40 w-full rounded-md" /> : null}
      <div
        ref={containerRef}
        aria-busy={loading}
        aria-label="Sheet music notation"
        className={loading ? "sr-only" : "w-full"}
      />
    </div>
  );
}
