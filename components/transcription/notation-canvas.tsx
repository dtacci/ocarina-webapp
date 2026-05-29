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
 *    (recoloring their live SVG), advancing via OSMD's own musical timestamp so
 *    it's robust to ties/rests. Auto-scroll is gentle and yields to the user:
 *    it only nudges when the active note is off-screen, and pauses for 4s after
 *    any manual scroll.
 *
 * OSMD calls are wrapped defensively so a cursor hiccup degrades to "no
 * highlight" rather than blanking the score.
 */

import { useEffect, useRef, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        // Cursor drives the playback highlight; kept invisible.
        cursorsOptions: [{ type: 0, color: "#000000", alpha: 0, follow: false }],
      });
    }
    const osmd = osmdRef.current;

    readyRef.current = false;
    setLoading(true);
    setError(null);

    osmd
      .load(musicxml)
      .then(() => {
        if (cancelled) return;
        osmd.zoom = zoom;
        osmd.render();
        readyRef.current = true;
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

      const targetWhole = ((playheadSec * tempoBpm) / 60) / 4;
      const current = () => cursor.iterator?.currentTimeStamp?.RealValue ?? 0;
      if (current() > targetWhole + 1e-6) cursor.reset();
      let guard = 0;
      while (!cursor.iterator?.EndReached && current() < targetWhole && guard++ < 10000) {
        cursor.next();
      }

      const gnotes = cursor.GNotesUnderCursor?.() ?? [];
      const els: Element[] = [];
      for (const gn of gnotes) {
        const el = (gn as unknown as {
          getSVGGElement?: () => SVGGElement | null;
        }).getSVGGElement?.();
        if (el) els.push(el);
      }
      clearHighlight();
      for (const el of els) el.classList.add(ACTIVE_CLASS);
      highlightedRef.current = els;

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
  }, [playheadSec, isPlaying, tempoBpm]);

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
