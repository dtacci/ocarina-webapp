"use client";

/**
 * Renders MusicXML as engraved notation via OpenSheetMusicDisplay (doc §4.1).
 *
 * Client-only — OSMD needs the DOM. The parent loads this through next/dynamic
 * with `{ ssr: false }` so the OSMD bundle never runs server-side.
 *
 * Beyond rendering:
 *  - `zoom`: re-renders at a scale without reloading the score.
 *  - `playheadSec` + `isPlaying`: lights the currently-sounding noteheads orange
 *    by recoloring their live SVG elements (no re-render), advancing via OSMD's
 *    own musical timestamp so it's robust to ties/rests. Auto-scroll is gentle:
 *    an *instant* scroll only when the active note leaves the viewport (the old
 *    per-tick smooth-scroll fought OSMD's followCursor and jittered).
 *
 * All OSMD calls are wrapped defensively so a cursor hiccup degrades to "no
 * highlight" rather than blanking the score.
 */

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { Skeleton } from "@/components/ui/skeleton";

export interface NotationCanvasProps {
  musicxml: string;
  zoom?: number;
  playheadSec?: number | null;
  isPlaying?: boolean;
  tempoBpm?: number;
  className?: string;
}

const ACTIVE_CLASS = "osmd-note-active";
const CLICK_CLASS = "osmd-note-clicked";

interface MiniSynth {
  triggerAttackRelease: (note: number | string, dur: string) => void;
  dispose: () => void;
}

/**
 * Walk the (hidden) cursor across the whole score once, mapping each note's SVG
 * <g> element to its frequency in Hz (from OSMD's own pitch model — no MIDI/
 * octave conversion). Used for click-to-hear. Best-effort + guarded.
 */
function buildNoteFreqMap(osmd: OpenSheetMusicDisplay): Map<Element, number> {
  const map = new Map<Element, number>();
  try {
    const cursor = osmd.cursor;
    if (!cursor) return map;
    cursor.reset();
    let guard = 0;
    while (!cursor.iterator?.EndReached && guard++ < 20000) {
      const gnotes = cursor.GNotesUnderCursor?.() ?? [];
      for (const gn of gnotes) {
        const el = (gn as unknown as {
          getSVGGElement?: () => SVGGElement | null;
        }).getSVGGElement?.();
        const freq = gn.sourceNote?.Pitch?.Frequency;
        if (el && typeof freq === "number" && freq > 0) map.set(el, freq);
      }
      cursor.next();
    }
    cursor.reset();
  } catch {
    /* best-effort */
  }
  return map;
}

export default function NotationCanvas({
  musicxml,
  zoom = 1,
  playheadSec = null,
  isPlaying = false,
  tempoBpm = 120,
  className,
}: NotationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const readyRef = useRef(false);
  const highlightedRef = useRef<Element[]>([]);
  const lastScrollRef = useRef(0);
  const userScrollUntilRef = useRef(0);
  const noteFreqRef = useRef<Map<Element, number>>(new Map());
  const clickSynthRef = useRef<MiniSynth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Click a notehead to hear its pitch (lazy-loads Tone on first use).
  async function playFrequency(freq: number, el: Element) {
    try {
      const Tone = await import("tone");
      await Tone.start();
      if (!clickSynthRef.current) {
        clickSynthRef.current = new Tone.Synth({
          oscillator: { type: "triangle" },
          envelope: { attack: 0.005, decay: 0.1, sustain: 0.2, release: 0.4 },
        }).toDestination() as unknown as MiniSynth;
      }
      clickSynthRef.current.triggerAttackRelease(freq, "8n");
      // Brief visual confirmation.
      el.classList.add(CLICK_CLASS);
      setTimeout(() => el.classList.remove(CLICK_CLASS), 240);
    } catch {
      /* audio is best-effort */
    }
  }

  function handleClick(e: ReactMouseEvent) {
    // Rebuild the map on demand if it came up empty (e.g. built just before
    // OSMD finished settling after render).
    if (noteFreqRef.current.size === 0 && osmdRef.current && readyRef.current) {
      noteFreqRef.current = buildNoteFreqMap(osmdRef.current);
    }
    const map = noteFreqRef.current;
    if (map.size === 0) return;
    const x = e.clientX;
    const y = e.clientY;
    // Hit-test by bounding box (robust to OSMD's SVG grouping): the smallest
    // note box containing the click, else the nearest note center within ~24px.
    let best: Element | null = null;
    let bestArea = Infinity;
    let nearest: Element | null = null;
    let nearestDist = 24 * 24;
    for (const el of map.keys()) {
      const r = (el as Element).getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const area = r.width * r.height;
        if (area < bestArea) {
          bestArea = area;
          best = el;
        }
      } else {
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < nearestDist) {
          nearestDist = d;
          nearest = el;
        }
      }
    }
    const hit = best ?? nearest;
    if (hit) void playFrequency(map.get(hit)!, hit);
  }

  const clearHighlight = () => {
    for (const el of highlightedRef.current) el.classList.remove(ACTIVE_CLASS);
    highlightedRef.current = [];
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
        // Cursor exists only to drive GNotesUnderCursor(); kept invisible.
        cursorsOptions: [{ type: 0, color: "#000000", alpha: 0, follow: false }],
      });
    }
    const osmd = osmdRef.current;

    readyRef.current = false;
    highlightedRef.current = [];
    setLoading(true);
    setError(null);
    const started = performance.now();

    osmd
      .load(musicxml)
      .then(() => {
        if (cancelled) return;
        osmd.zoom = zoom;
        osmd.render();
        readyRef.current = true;
        noteFreqRef.current = buildNoteFreqMap(osmd);
        if (process.env.NODE_ENV !== "production") {
          console.debug(
            `[OSMD] layout ${(performance.now() - started).toFixed(0)}ms, ` +
              `${noteFreqRef.current.size} clickable notes`,
          );
        }
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

  // Re-render on zoom change (no reload). SVG is rebuilt, so drop stale refs.
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !readyRef.current) return;
    try {
      highlightedRef.current = [];
      osmd.zoom = zoom;
      osmd.render();
      noteFreqRef.current = buildNoteFreqMap(osmd);
    } catch {
      /* ignore */
    }
  }, [zoom]);

  // Highlight the sounding notes from the synth playhead.
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !readyRef.current) return;
    try {
      const cursor = osmd.cursor;
      if (!cursor) return;

      if (playheadSec == null) {
        clearHighlight();
        cursor.reset();
        return;
      }

      // Advance the (invisible) cursor to the playhead, in whole notes.
      const targetWhole = ((playheadSec * tempoBpm) / 60) / 4;
      const current = () => cursor.iterator?.currentTimeStamp?.RealValue ?? 0;
      if (current() > targetWhole + 1e-6) cursor.reset();
      let guard = 0;
      while (!cursor.iterator?.EndReached && current() < targetWhole && guard++ < 10000) {
        cursor.next();
      }

      // Recolor the notes under the cursor; revert the previous set.
      const gnotes = cursor.GNotesUnderCursor?.() ?? [];
      const els: Element[] = [];
      for (const gn of gnotes) {
        // getSVGGElement lives on the concrete VexFlow subclass, not the base type.
        const el = (gn as unknown as {
          getSVGGElement?: () => SVGGElement | null;
        }).getSVGGElement?.();
        if (el) els.push(el);
      }
      clearHighlight();
      for (const el of els) el.classList.add(ACTIVE_CLASS);
      highlightedRef.current = els;

      // Gentle follow: instant scroll only when the active note is off-screen.
      if (isPlaying && els[0]) {
        const now = performance.now();
        const rect = els[0].getBoundingClientRect();
        const offTop = rect.top < 140;
        const offBottom = rect.bottom > window.innerHeight - 80;
        // Don't fight the user: pause auto-scroll for 4s after a manual scroll.
        const userScrolling = now < userScrollUntilRef.current;
        if ((offTop || offBottom) && now - lastScrollRef.current > 600 && !userScrolling) {
          els[0].scrollIntoView({ block: "center", behavior: "smooth" });
          lastScrollRef.current = now;
        }
      }
    } catch {
      /* highlight is best-effort */
    }
  }, [playheadSec, isPlaying, tempoBpm]);

  // Track manual scrolling so playback auto-scroll can yield to the user.
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
      highlightedRef.current = [];
      noteFreqRef.current = new Map();
      try {
        clickSynthRef.current?.dispose();
      } catch {
        /* noop */
      }
      clickSynthRef.current = null;
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
        onClick={handleClick}
        aria-busy={loading}
        aria-label="Sheet music notation — click a note to hear it"
        className={loading ? "sr-only" : "w-full cursor-pointer"}
      />
    </div>
  );
}
