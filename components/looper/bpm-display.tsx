"use client";

import { useRef, useState } from "react";

interface Props {
  bpm: number | null;
  masterLengthMs: number;
  onTapTempo: (bpm: number) => void;
}

export function BpmDisplay({ bpm, masterLengthMs, onTapTempo }: Props) {
  const tapsRef = useRef<number[]>([]);
  const [tapping, setTapping] = useState(false);

  function handleTap() {
    const now = Date.now();
    const taps = tapsRef.current;
    // Flush taps older than 3s
    const recent = taps.filter((t) => now - t < 3000);
    recent.push(now);
    tapsRef.current = recent;
    setTapping(true);

    if (recent.length >= 2) {
      const intervals = recent.slice(1).map((t, i) => t - recent[i]);
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const tappedBpm = Math.round(60000 / avgInterval);
      onTapTempo(tappedBpm);
    }

    setTimeout(() => setTapping(false), 200);
  }

  const masterSec = masterLengthMs > 0
    ? `${(masterLengthMs / 1000).toFixed(1)}s loop`
    : null;

  return (
    <div className="flex items-center gap-4">
      {/* BPM readout */}
      <div className="text-center">
        <div className="text-4xl font-bold tabular-nums tracking-tight">
          {bpm ?? "—"}
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
          BPM
        </div>
      </div>

      {/* Master loop length */}
      {masterSec && (
        <div className="text-center border-l pl-4">
          <div className="text-2xl font-semibold tabular-nums">
            {masterSec}
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
            Master
          </div>
        </div>
      )}

      {/* Tap tempo */}
      <button
        onClick={handleTap}
        className={[
          "ml-auto rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all select-none",
          tapping
            ? "border-primary bg-primary/10 scale-95"
            : "border-border hover:border-foreground/30 hover:bg-muted/50",
        ].join(" ")}
      >
        Tap
      </button>
    </div>
  );
}
