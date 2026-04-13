"use client";

import { useEffect, useState } from "react";
import type { MetricsResponse } from "@/app/api/metrics/route";

const BUCKET_COLORS = [
  "bg-emerald-400",   // < 1s
  "bg-emerald-300",   // 1-2s
  "bg-amber-300",     // 2-4s  ← expected range
  "bg-orange-400",    // 4-8s
  "bg-red-400",       // ≥ 8s
];

interface Props {
  histogram: MetricsResponse["commands"]["histogram"];
  totalCommands: number;
}

export function LatencyChart({ histogram, totalCommands }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const maxCount = Math.max(...histogram.map((b) => b.count), 1);

  if (totalCommands === 0) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium mb-3">Command roundtrip latency</h2>
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No commands dispatched yet
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Command roundtrip latency</h2>
        <span className="text-xs text-muted-foreground">{totalCommands} commands / 24h</span>
      </div>

      <div className="space-y-2">
        {histogram.map((bucket, i) => {
          const pct = (bucket.count / maxCount) * 100;
          const isExpected = bucket.label === "2–4s";
          const delay = i * 80;

          return (
            <div key={bucket.label} className="flex items-center gap-3">
              {/* Label */}
              <span className={`w-10 text-right text-xs shrink-0 ${
                isExpected ? "text-foreground font-medium" : "text-muted-foreground"
              }`}>
                {bucket.label}
              </span>

              {/* Bar container */}
              <div className="relative flex-1 h-7 rounded bg-muted/30 overflow-hidden">
                <div
                  className={`h-full rounded transition-none ${BUCKET_COLORS[i]}`}
                  style={{
                    width: mounted ? `${pct}%` : "0%",
                    transition: `width 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
                    opacity: bucket.count === 0 ? 0 : 0.8,
                  }}
                />
                {isExpected && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/60 pointer-events-none select-none">
                    expected range
                  </span>
                )}
              </div>

              {/* Count */}
              <span className="w-14 text-xs tabular-nums text-muted-foreground shrink-0">
                {bucket.count > 0 ? `${bucket.count} cmd${bucket.count !== 1 ? "s" : ""}` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/60">
        Pi polls commands every 2s — healthy commands land in the 2–4s bucket.
      </p>
    </div>
  );
}
