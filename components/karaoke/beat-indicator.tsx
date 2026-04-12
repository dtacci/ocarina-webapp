"use client";

import { useEffect, useState } from "react";

interface Props {
  bpm: number;
  isPlaying: boolean;
}

export function BeatIndicator({ bpm, isPlaying }: Props) {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (!isPlaying) {
      setBeat(0);
      return;
    }
    const ms = (60 / Math.max(bpm, 1)) * 1000;
    const id = setInterval(() => setBeat((b) => (b + 1) % 4), ms);
    return () => clearInterval(id);
  }, [isPlaying, bpm]);

  return (
    <div className="flex items-center justify-center gap-3 py-2">
      {[0, 1, 2, 3].map((i) => {
        const isActive = isPlaying && i === beat;
        const isDownbeat = i === 0;
        return (
          <div
            key={i}
            className={[
              "rounded-full transition-all duration-75",
              isDownbeat ? "size-3" : "size-2",
              isActive
                ? isDownbeat
                  ? "bg-primary scale-125"
                  : "bg-primary/70 scale-110"
                : isDownbeat
                ? "bg-muted-foreground/30"
                : "bg-muted-foreground/20",
            ].join(" ")}
          />
        );
      })}
      {bpm > 0 && (
        <span className="ml-2 text-[10px] text-muted-foreground/50 tabular-nums">
          {Math.round(bpm)} BPM
        </span>
      )}
    </div>
  );
}
