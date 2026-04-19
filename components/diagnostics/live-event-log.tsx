"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

export interface LogEntry {
  id: string;
  kind: "note" | "fx" | "button" | "heartbeat" | "kit" | "karaoke" | "madlibs" | "loop" | "misc";
  text: string;
  ts: number;
}

interface Props {
  entries: LogEntry[];
}

/**
 * Compact scrolling tail of raw device events. Append-only; parent owns the
 * bounded ring-buffer. Pause captures the current cursor and keeps newer
 * events offscreen until resumed.
 */
export function LiveEventLog({ entries }: Props) {
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [visibleCutoffTs, setVisibleCutoffTs] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(entries.length);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Auto-scroll to newest entry (top) when new events arrive and we're live.
  useEffect(() => {
    if (paused) return;
    if (entries.length !== prevLengthRef.current) {
      prevLengthRef.current = entries.length;
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }
  }, [entries, paused]);

  const shown = paused && visibleCutoffTs !== null
    ? entries.filter((e) => e.ts <= visibleCutoffTs)
    : entries;

  const queued = paused && visibleCutoffTs !== null
    ? entries.filter((e) => e.ts > visibleCutoffTs).length
    : 0;

  function togglePause() {
    if (paused) {
      setVisibleCutoffTs(null);
      setPaused(false);
    } else {
      setVisibleCutoffTs(Date.now());
      setPaused(true);
    }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/10 px-4 py-3">
        <h2 className="text-sm font-medium">Live event log</h2>
        <div className="flex items-center gap-3">
          {queued > 0 && (
            <span className="text-xs font-medium text-amber-400">{queued} queued</span>
          )}
          <button
            onClick={togglePause}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title={paused ? "Resume live feed" : "Pause live feed"}
          >
            {paused ? (
              <>
                <Play className="size-3" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span>LIVE</span>
                <Pause className="size-3" />
              </>
            )}
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="max-h-80 overflow-y-auto font-mono text-xs"
      >
        {shown.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            No events yet
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {shown.slice(0, 200).map((e) => (
              <div
                key={e.id}
                className="flex items-baseline gap-3 px-4 py-1.5"
              >
                <span className="w-16 shrink-0 text-muted-foreground/60 tabular-nums">
                  {formatClock(e.ts)}
                </span>
                <span className={`w-16 shrink-0 uppercase tracking-wider ${kindColor(e.kind)}`}>
                  {e.kind}
                </span>
                <span className="flex-1 text-foreground/90">{e.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatClock(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms.slice(0, 2)}`;
}

function kindColor(kind: LogEntry["kind"]): string {
  switch (kind) {
    case "note":      return "text-emerald-400";
    case "fx":        return "text-amber-400";
    case "button":    return "text-violet-400";
    case "heartbeat": return "text-muted-foreground/70";
    case "kit":       return "text-sky-400";
    case "karaoke":   return "text-pink-400";
    case "madlibs":   return "text-orange-400";
    case "loop":      return "text-blue-400";
    default:          return "text-muted-foreground";
  }
}
