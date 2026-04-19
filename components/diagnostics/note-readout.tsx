"use client";

import { useEffect, useRef, useState } from "react";

export interface NoteSample {
  name: string;
  hz: number;
  confidence?: number;
  ts: number;
}

interface Props {
  /** Most recent note event, or null. Rolling history of last ~20. */
  current: NoteSample | null;
  history: NoteSample[];
}

export function NoteReadout({ current, history }: Props) {
  const [flash, setFlash] = useState(0);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!current || current.ts === lastTsRef.current) return;
    lastTsRef.current = current.ts;
    setFlash((n) => n + 1);
    const t = setTimeout(() => setFlash((n) => n - 1), 400);
    return () => clearTimeout(t);
  }, [current]);

  const hzLabel = current ? `${current.hz.toFixed(1)} Hz` : "—";
  const conf =
    current && typeof current.confidence === "number"
      ? `${Math.round(current.confidence * 100)}%`
      : "—";

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Last note</h2>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          STATUS:NOTE
        </span>
      </div>
      <div
        className={[
          "flex items-baseline gap-4 rounded-lg border px-4 py-6 transition-colors",
          flash > 0 ? "border-emerald-400 bg-emerald-500/10" : "border-border bg-background/40",
        ].join(" ")}
        style={{ transition: "background-color 0.35s ease-out, border-color 0.35s ease-out" }}
      >
        <span className="font-mono text-5xl font-semibold tabular-nums text-foreground">
          {current?.name ?? "—"}
        </span>
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{hzLabel}</span>
          <span>confidence {conf}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Recent
        </div>
        <div className="flex flex-wrap gap-1.5">
          {history.length === 0 ? (
            <span className="text-xs text-muted-foreground">No notes yet</span>
          ) : (
            history.slice(0, 20).map((n, i) => (
              <span
                key={`${n.ts}-${i}`}
                className="rounded border border-border/60 bg-background/40 px-2 py-0.5 font-mono text-xs text-foreground"
                title={`${n.hz.toFixed(1)} Hz`}
              >
                {n.name}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
