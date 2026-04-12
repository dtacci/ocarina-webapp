"use client";

import { useEffect, useRef, useState } from "react";
import type { LrcLine } from "@/lib/utils/lrc";
import { findCurrentLine } from "@/lib/utils/lrc";

interface Props {
  lines: LrcLine[];
  plainLyrics: string | null;
  instrumental: boolean;
  currentTime: number;
  isPlaying: boolean;
}

export function LyricsDisplay({ lines, plainLyrics, instrumental, currentTime, isPlaying }: Props) {
  const [currentIdx, setCurrentIdx] = useState(-1);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Sync current line from playback time
  useEffect(() => {
    const idx = findCurrentLine(lines, currentTime);
    if (idx !== currentIdx) {
      setCurrentIdx(idx);
    }
  }, [currentTime, lines, currentIdx]);

  // Smooth scroll current line into view
  useEffect(() => {
    if (currentIdx >= 0 && lineRefs.current[currentIdx]) {
      lineRefs.current[currentIdx]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentIdx]);

  // Not started yet — show "waiting" state
  if (!isPlaying && currentIdx === -1 && lines.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <p className="text-sm">Press play to start</p>
        <p className="text-xs opacity-60">Lyrics will scroll automatically</p>
      </div>
    );
  }

  // Instrumental track
  if (instrumental) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-2xl font-light text-muted-foreground tracking-widest">♪ ♪ ♪</p>
      </div>
    );
  }

  // Have synced LRC lines — scrolling karaoke display
  if (lines.length > 0) {
    return (
      <div className="relative h-96 overflow-hidden select-none">
        {/* Top fade gradient */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 z-10 bg-gradient-to-b from-background to-transparent" />
        {/* Bottom fade gradient */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 z-10 bg-gradient-to-t from-background to-transparent" />

        <div className="py-40 space-y-2 text-center px-4">
          {lines.map((line, i) => {
            const dist = i - currentIdx;
            const isCurrent = dist === 0 && currentIdx >= 0;
            const isPast = dist < 0;

            let opacity = "opacity-25";
            let scale = "text-sm";
            let weight = "font-normal";
            let color = "text-muted-foreground";

            if (isCurrent) {
              opacity = "opacity-100";
              scale = "text-2xl";
              weight = "font-semibold";
              color = "text-foreground";
            } else if (dist === 1) {
              opacity = "opacity-60";
              scale = "text-base";
              weight = "font-medium";
              color = "text-foreground";
            } else if (dist === 2) {
              opacity = "opacity-40";
              scale = "text-sm";
              color = "text-muted-foreground";
            } else if (dist === -1) {
              opacity = "opacity-30";
              scale = "text-sm";
            } else if (dist === -2) {
              opacity = "opacity-15";
              scale = "text-xs";
            } else {
              opacity = "opacity-0";
            }

            return (
              <div
                key={i}
                ref={(el) => { lineRefs.current[i] = el; }}
                className={[
                  "transition-all duration-300 leading-relaxed px-2",
                  opacity,
                  scale,
                  weight,
                  color,
                  line.isInstrumental ? "tracking-widest" : "",
                  isCurrent ? "py-2" : "py-0.5",
                ].join(" ")}
              >
                {isCurrent && !line.isInstrumental ? (
                  <span>
                    <span className="text-primary/60 mr-2">══</span>
                    {line.text}
                    <span className="text-primary/60 ml-2">══</span>
                  </span>
                ) : (
                  line.text
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Plain lyrics fallback — no timestamps, just static text
  if (plainLyrics) {
    return (
      <div className="h-96 overflow-y-auto px-4">
        <div className="text-center space-y-1 py-8">
          {plainLyrics.split("\n").map((line, i) => (
            <p
              key={i}
              className={[
                "text-sm leading-relaxed",
                line.trim() === "" ? "h-4" : "text-muted-foreground",
              ].join(" ")}
            >
              {line || "\u00A0"}
            </p>
          ))}
          <p className="text-[10px] text-muted-foreground/40 mt-6">
            Lyrics synced playback unavailable for this song — reading mode only
          </p>
        </div>
      </div>
    );
  }

  // No lyrics at all
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      <p className="text-sm">Lyrics not found</p>
    </div>
  );
}
