"use client";

import { useCallback, useRef, useState } from "react";
import { Circle, Square, Download, Trash2 } from "lucide-react";

import type { LogEntry } from "@/components/diagnostics/live-event-log";

const MAX_CAPTURE = 50_000;

type CaptureState = "idle" | "recording" | "captured";

interface Props {
  /** Imperatively registered by the parent so the hook's onEvent funnels here. */
  registerSink: (sink: ((entry: LogEntry) => void) | null) => void;
  deviceName: string | null;
}

/**
 * Session capture for the live monitor. Keeps a separate (unbounded for the
 * duration, capped at 50k) buffer of LogEntries from the moment the user clicks
 * Start, then offers JSON / CSV download. Persisting captures server-side is
 * intentionally out of scope — this is a "share a debug repro" affordance.
 */
export function SessionCapturePanel({ registerSink, deviceName }: Props) {
  const [state, setState] = useState<CaptureState>("idle");
  const [size, setSize] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [overflow, setOverflow] = useState(false);
  const bufferRef = useRef<LogEntry[]>([]);

  const sink = useCallback((entry: LogEntry) => {
    if (bufferRef.current.length >= MAX_CAPTURE) {
      setOverflow(true);
      return;
    }
    bufferRef.current.push(entry);
    setSize(bufferRef.current.length);
  }, []);

  const start = useCallback(() => {
    bufferRef.current = [];
    setSize(0);
    setOverflow(false);
    setStartedAt(Date.now());
    setState("recording");
    registerSink(sink);
  }, [registerSink, sink]);

  const stop = useCallback(() => {
    registerSink(null);
    setState(bufferRef.current.length > 0 ? "captured" : "idle");
  }, [registerSink]);

  const clear = useCallback(() => {
    bufferRef.current = [];
    setSize(0);
    setOverflow(false);
    setStartedAt(null);
    setState("idle");
  }, []);

  const filenameBase = () => {
    const stamp = startedAt ? new Date(startedAt) : new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const slug =
      `${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}` +
      `-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}`;
    const device = (deviceName ?? "device").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `monitor-${device}-${slug}`;
  };

  const downloadBlob = (content: string, mime: string, ext: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenameBase()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const payload = {
      deviceName,
      startedAt: startedAt ? new Date(startedAt).toISOString() : null,
      endedAt: new Date().toISOString(),
      entryCount: bufferRef.current.length,
      overflow,
      entries: bufferRef.current,
    };
    downloadBlob(JSON.stringify(payload, null, 2), "application/json", "json");
  };

  const exportCSV = () => {
    const header = "ts_iso,ts_ms,kind,text";
    const lines = bufferRef.current.map((e) => {
      const ts = new Date(e.ts).toISOString();
      const text = `"${e.text.replace(/"/g, '""')}"`;
      return `${ts},${e.ts},${e.kind},${text}`;
    });
    downloadBlob([header, ...lines].join("\n"), "text/csv", "csv");
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Session capture</h2>
          <p className="text-xs text-muted-foreground">
            Record everything that arrives in the event log, then export it as
            JSON or CSV.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state === "idle" && (
            <button
              type="button"
              onClick={start}
              className="flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/15"
            >
              <Circle className="size-3 fill-red-400 text-red-400" />
              Start
            </button>
          )}
          {state === "recording" && (
            <button
              type="button"
              onClick={stop}
              className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/15"
            >
              <Square className="size-3 fill-amber-400 text-amber-400" />
              Stop
            </button>
          )}
          {state === "captured" && (
            <>
              <button
                type="button"
                onClick={exportJSON}
                className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/15"
              >
                <Download className="size-3" />
                JSON
              </button>
              <button
                type="button"
                onClick={exportCSV}
                className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/15"
              >
                <Download className="size-3" />
                CSV
              </button>
              <button
                type="button"
                onClick={clear}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="size-3" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span>
          <span className="font-mono tabular-nums text-foreground/80">{size}</span> entries
        </span>
        {startedAt && state !== "idle" && (
          <span>
            since{" "}
            <span className="font-mono">
              {new Date(startedAt).toLocaleTimeString()}
            </span>
          </span>
        )}
        {state === "recording" && (
          <span className="flex items-center gap-1.5 font-mono uppercase tracking-wider text-red-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
            REC
          </span>
        )}
        {overflow && (
          <span className="text-amber-400">
            buffer full ({MAX_CAPTURE.toLocaleString()} cap) — newer events dropped
          </span>
        )}
      </div>
    </div>
  );
}
