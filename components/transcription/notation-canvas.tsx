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
  /** Reports how many noteheads became clickable (for an on-screen hint). */
  onClickableCount?: (count: number) => void;
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
/** Collect note frequencies (Hz) in score order from OSMD's pitch model. */
function collectFrequencies(osmd: OpenSheetMusicDisplay): number[] {
  const freqs: number[] = [];
  const add = (gn: unknown) => {
    const f = (gn as { sourceNote?: { Pitch?: { Frequency?: number } } })
      ?.sourceNote?.Pitch?.Frequency;
    if (typeof f === "number" && f > 0) freqs.push(f);
  };
  try {
    const cursor = osmd.cursor;
    if (cursor) {
      cursor.reset();
      let guard = 0;
      while (!cursor.iterator?.EndReached && guard++ < 20000) {
        for (const gn of cursor.GNotesUnderCursor?.() ?? []) add(gn);
        cursor.next();
      }
      cursor.reset();
    }
  } catch {
    /* best-effort */
  }
  if (freqs.length === 0) {
    // Fallback: traverse the graphical sheet directly.
    try {
      const rows =
        (osmd as unknown as { GraphicSheet?: { MeasureList?: unknown[][] } })
          .GraphicSheet?.MeasureList ?? [];
      for (const row of rows) {
        for (const measure of row ?? []) {
          for (const se of (measure as { staffEntries?: unknown[] })?.staffEntries ?? []) {
            for (const gve of (se as { graphicalVoiceEntries?: unknown[] })?.graphicalVoiceEntries ?? []) {
              for (const gn of (gve as { notes?: unknown[] })?.notes ?? []) add(gn);
            }
          }
        }
      }
    } catch {
      /* best-effort */
    }
  }
  return freqs;
}

/**
 * Map each *visible* notehead SVG element to its frequency. We grab VexFlow's
 * actual notehead elements from the DOM (`.vf-notehead`) and pair them, in score
 * order, with the pitches from the model — because OSMD's getSVGGElement() was
 * not reliably returning the clicked element. Falls back to getSVGGElement.
 * Returns the map plus diagnostic counts.
 */
function buildNoteFreqMap(
  osmd: OpenSheetMusicDisplay,
  container: HTMLElement | null,
): { map: Map<Element, number>; modelNotes: number; domHeads: number } {
  const map = new Map<Element, number>();
  const freqs = collectFrequencies(osmd);

  // VexFlow renders each notehead with class "vf-notehead" — the real clickable
  // element. Try a few selectors for robustness across versions.
  let heads: Element[] = [];
  if (container) {
    for (const sel of [".vf-notehead", "g.vf-notehead", ".vf-stavenote .vf-notehead"]) {
      heads = Array.from(container.querySelectorAll(sel));
      if (heads.length) break;
    }
  }

  if (heads.length > 0 && heads.length === freqs.length) {
    heads.forEach((el, i) => map.set(el, freqs[i]));
  } else {
    // Fallback: getSVGGElement (works if OSMD returns the right element).
    const addG = (gn: unknown) => {
      try {
        const g = gn as {
          getSVGGElement?: () => SVGGElement | null;
          sourceNote?: { Pitch?: { Frequency?: number } };
        };
        const el = g.getSVGGElement?.();
        const f = g.sourceNote?.Pitch?.Frequency;
        if (el && typeof f === "number" && f > 0) map.set(el, f);
      } catch {
        /* skip */
      }
    };
    try {
      const cursor = osmd.cursor;
      if (cursor) {
        cursor.reset();
        let guard = 0;
        while (!cursor.iterator?.EndReached && guard++ < 20000) {
          for (const gn of cursor.GNotesUnderCursor?.() ?? []) addG(gn);
          cursor.next();
        }
        cursor.reset();
      }
    } catch {
      /* best-effort */
    }
  }

  return { map, modelNotes: freqs.length, domHeads: heads.length };
}

export default function NotationCanvas({
  musicxml,
  zoom = 1,
  playheadSec = null,
  isPlaying = false,
  tempoBpm = 120,
  className,
  onClickableCount,
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
  // Flash first (visual confirmation that we found the note) — audio is separate
  // and best-effort, so a found note still lights up even if audio fails.
  function playFrequency(freq: number, el: Element) {
    el.classList.add(CLICK_CLASS);
    setTimeout(() => el.classList.remove(CLICK_CLASS), 240);
    void (async () => {
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
      } catch {
        /* audio is best-effort */
      }
    })();
  }

  /**
   * Attach a click listener directly to each note's SVG element (the most
   * reliable path — fires on the real DOM click regardless of layout-box
   * geometry). Guarded so an element is only wired once. Returns the count.
   */
  function wireClicks(map: Map<Element, number>): number {
    for (const [el, freq] of map) {
      const e = el as SVGElement;
      if (e.getAttribute("data-osmd-wired")) continue;
      e.setAttribute("data-osmd-wired", "1");
      e.style.cursor = "pointer";
      e.addEventListener("click", (ev) => {
        ev.stopPropagation();
        playFrequency(freq, el);
      });
    }
    return map.size;
  }

  function handleClick(e: ReactMouseEvent) {
    // Rebuild the map on demand if it came up empty (e.g. built just before
    // OSMD finished settling after render).
    if (noteFreqRef.current.size === 0 && osmdRef.current && readyRef.current) {
      const built = buildNoteFreqMap(osmdRef.current, containerRef.current);
      noteFreqRef.current = built.map;
      onClickableCount?.(wireClicks(built.map));
    }
    const map = noteFreqRef.current;
    if (map.size === 0) return;
    const x = e.clientX;
    const y = e.clientY;
    // Find the note whose box contains the click; else the nearest note center.
    // We do NOT skip zero-size boxes — OSMD can report degenerate widths, so we
    // fall back to nearest-center with a generous radius.
    let best: Element | null = null;
    let bestArea = Infinity;
    let nearest: Element | null = null;
    let nearestDist = 40 * 40;
    for (const el of map.keys()) {
      const r = (el as Element).getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const area = Math.max(1, r.width * r.height);
        if (area < bestArea) {
          bestArea = area;
          best = el;
        }
      }
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < nearestDist) {
        nearestDist = d;
        nearest = el;
      }
    }
    const hit = best ?? nearest;
    if (hit) {
      playFrequency(map.get(hit)!, hit);
    } else {
      console.warn(`[OSMD] click: no note within range (map has ${map.size})`);
    }
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
        const built = buildNoteFreqMap(osmd, container);
        noteFreqRef.current = built.map;
        const count = wireClicks(built.map);
        onClickableCount?.(count);
        console.log(
          `[OSMD] click-to-hear → model notes: ${built.modelNotes}, ` +
            `DOM noteheads: ${built.domHeads}, wired: ${count}`,
        );
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
      const built = buildNoteFreqMap(osmd, containerRef.current);
      noteFreqRef.current = built.map;
      onClickableCount?.(wireClicks(built.map));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
