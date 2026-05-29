"use client";

/**
 * Renders MusicXML as engraved notation via OpenSheetMusicDisplay (doc §4.1).
 *
 * Client-only — OSMD needs the DOM. The parent loads this through next/dynamic
 * with `{ ssr: false }` so the OSMD bundle never runs server-side.
 *
 * Beyond rendering, it supports:
 *  - `zoom`: re-renders at a scale without reloading the score.
 *  - `playheadSec` + `isPlaying`: drives OSMD's cursor to follow synth playback,
 *    advancing by OSMD's own musical timestamp (robust to ties/rests) and
 *    auto-scrolling the current note into view.
 *
 * All OSMD calls are wrapped defensively so a cursor/zoom hiccup degrades to
 * "no cursor" rather than blanking the score.
 */

import { useEffect, useRef, useState } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { Skeleton } from "@/components/ui/skeleton";

export interface NotationCanvasProps {
  musicxml: string;
  /** Render scale; 1 = default. */
  zoom?: number;
  /** Synth playback position in seconds, or null when stopped. */
  playheadSec?: number | null;
  isPlaying?: boolean;
  /** Tempo used to map playhead seconds → score position. */
  tempoBpm?: number;
  className?: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        followCursor: true,
        cursorsOptions: [
          // Standard highlight box, in the app's amber, semi-transparent.
          { type: 0, color: "#d97706", alpha: 0.28, follow: true },
        ],
      });
    }
    const osmd = osmdRef.current;

    readyRef.current = false;
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
        if (process.env.NODE_ENV !== "production") {
          console.debug(`[OSMD] layout ${(performance.now() - started).toFixed(0)}ms`);
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
    // zoom intentionally excluded — handled by its own effect (re-render, no reload).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicxml]);

  // Re-render on zoom change (no reload).
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !readyRef.current) return;
    try {
      osmd.zoom = zoom;
      osmd.render();
    } catch {
      /* ignore */
    }
  }, [zoom]);

  // Drive the cursor from the synth playhead.
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !readyRef.current) return;
    try {
      const cursor = osmd.cursor;
      if (!cursor) return;

      if (playheadSec == null || !isPlaying) {
        cursor.reset();
        cursor.hide();
        return;
      }

      cursor.show();
      // Position in whole notes: seconds → quarter-beats → whole notes.
      const targetWhole = ((playheadSec * tempoBpm) / 60) / 4;
      const current = () => cursor.iterator?.currentTimeStamp?.RealValue ?? 0;
      // Seeked backwards → restart from the top.
      if (current() > targetWhole + 1e-6) cursor.reset();
      let guard = 0;
      while (
        !cursor.iterator?.EndReached &&
        current() < targetWhole &&
        guard++ < 10000
      ) {
        cursor.next();
      }
      // Keep the active note in view.
      cursor.cursorElement?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    } catch {
      /* cursor is best-effort */
    }
  }, [playheadSec, isPlaying, tempoBpm]);

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
