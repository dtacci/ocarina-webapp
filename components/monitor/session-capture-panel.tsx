"use client";

import { useCallback, useRef, useState } from "react";
import {
  Circle,
  Square,
  Download,
  Trash2,
  Loader2,
  Check,
  AlertTriangle,
  Pencil,
  Plus,
} from "lucide-react";

import type { LogEntry } from "@/components/diagnostics/live-event-log";
import type { MonitorCaptureRow } from "@/lib/db/queries/monitor-captures";

const MAX_CAPTURE = 50_000;

type CaptureState =
  | "idle"
  | "recording"
  | "saving"
  | { kind: "saved"; capture: MonitorCaptureRow }
  | { kind: "failed"; error: string };

interface Props {
  /** Imperatively registered by the parent so the hook's onEvent funnels here. */
  registerSink: (sink: ((entry: LogEntry) => void) | null) => void;
  /** Used in the auto-generated capture name. */
  deviceName: string | null;
  /** Active transport for this monitor view — stored alongside the capture. */
  source: "pi_rest" | "realtime" | "webserial";
  /** Optional device id when one exists (realtime + sometimes pi_rest). */
  deviceId?: string | null;
  /** Fires after a successful save so the parent can refresh recent-captures list. */
  onSaved?: (capture: MonitorCaptureRow) => void;
}

/**
 * Session capture for the live monitor. Buffers LogEntries from Start, then
 * auto-persists to Vercel Blob + the monitor_captures table on Stop. Manual
 * JSON / CSV downloads are still available as a fallback on save failure.
 */
export function SessionCapturePanel({
  registerSink,
  deviceName,
  source,
  deviceId,
  onSaved,
}: Props) {
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

  const persist = useCallback(
    async (events: LogEntry[], startTs: number, endTs: number) => {
      const name = defaultName(deviceName, startTs);
      try {
        const res = await fetch("/api/monitor/captures", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name,
            source,
            deviceId: deviceId ?? null,
            deviceName,
            startedAt: startTs,
            endedAt: endTs,
            events,
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`${res.status}: ${body || res.statusText}`);
        }
        const { capture } = (await res.json()) as { capture: MonitorCaptureRow };
        setState({ kind: "saved", capture });
        onSaved?.(capture);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Save failed";
        setState({ kind: "failed", error: msg });
      }
    },
    [deviceName, source, deviceId, onSaved]
  );

  const stop = useCallback(() => {
    registerSink(null);
    const endTs = Date.now();
    const events = bufferRef.current;
    if (events.length === 0 || startedAt === null) {
      setState("idle");
      return;
    }
    setState("saving");
    void persist(events, startedAt, endTs);
  }, [registerSink, startedAt, persist]);

  const reset = useCallback(() => {
    bufferRef.current = [];
    setSize(0);
    setOverflow(false);
    setStartedAt(null);
    setState("idle");
  }, []);

  const downloadFallbackJSON = () => {
    const payload = {
      deviceName,
      source,
      startedAt: startedAt ? new Date(startedAt).toISOString() : null,
      endedAt: new Date().toISOString(),
      entryCount: bufferRef.current.length,
      overflow,
      entries: bufferRef.current,
    };
    downloadBlob(
      JSON.stringify(payload, null, 2),
      "application/json",
      `${filenameBase(deviceName, startedAt)}.json`
    );
  };

  const downloadFallbackCSV = () => {
    const header = "ts_iso,ts_ms,kind,text";
    const lines = bufferRef.current.map((e) => {
      const ts = new Date(e.ts).toISOString();
      const text = `"${e.text.replace(/"/g, '""')}"`;
      return `${ts},${e.ts},${e.kind},${text}`;
    });
    downloadBlob(
      [header, ...lines].join("\n"),
      "text/csv",
      `${filenameBase(deviceName, startedAt)}.csv`
    );
  };

  const isObj = typeof state === "object";

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">Session capture</h2>
          <p className="text-xs text-muted-foreground">
            Records the live event log and auto-saves to your library.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          {state === "saving" && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Saving…
            </span>
          )}
          {isObj && (state as { kind: string }).kind === "saved" && (
            <NewCaptureButton onClick={reset} />
          )}
          {isObj && (state as { kind: string }).kind === "failed" && (
            <>
              <button
                type="button"
                onClick={downloadFallbackJSON}
                className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/15"
              >
                <Download className="size-3" />
                JSON
              </button>
              <button
                type="button"
                onClick={downloadFallbackCSV}
                className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/15"
              >
                <Download className="size-3" />
                CSV
              </button>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Discard
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span>
          <span className="font-mono tabular-nums text-foreground/80">{size}</span>{" "}
          entries
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

      {isObj && (state as { kind: string }).kind === "saved" && (
        <SavedCaptureCard
          capture={(state as { kind: "saved"; capture: MonitorCaptureRow }).capture}
          onRenamed={(updated) =>
            setState({ kind: "saved", capture: updated })
          }
          onDeleted={reset}
        />
      )}

      {isObj && (state as { kind: string }).kind === "failed" && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 text-red-400" />
          <div>
            <div className="font-medium text-red-300">
              Couldn&apos;t save to library
            </div>
            <p className="mt-0.5 text-muted-foreground">
              {(state as { kind: "failed"; error: string }).error}
              {" — "}
              your buffer is intact; download JSON / CSV before discarding.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function NewCaptureButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <Plus className="size-3" />
      New capture
    </button>
  );
}

function SavedCaptureCard({
  capture,
  onRenamed,
  onDeleted,
}: {
  capture: MonitorCaptureRow;
  onRenamed: (next: MonitorCaptureRow) => void;
  onDeleted: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(capture.name);
  const [busy, setBusy] = useState(false);

  async function rename() {
    const next = draftName.trim();
    if (!next || next === capture.name) {
      setRenaming(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/monitor/captures/${capture.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      if (res.ok) {
        const { capture: updated } = (await res.json()) as {
          capture: MonitorCaptureRow;
        };
        onRenamed(updated);
      }
    } finally {
      setBusy(false);
      setRenaming(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete capture "${capture.name}"?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/monitor/captures/${capture.id}`, { method: "DELETE" });
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Check className="size-3.5 text-emerald-400" />
        {renaming ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => {
              if (e.key === "Enter") void rename();
              if (e.key === "Escape") { setDraftName(capture.name); setRenaming(false); }
            }}
            className="flex-1 rounded border bg-background px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="flex-1 truncate text-left text-sm font-medium hover:underline"
            title="Click to rename"
          >
            {capture.name}
          </button>
        )}
        <a
          href={capture.blob_url}
          download={`${capture.name}.json`}
          className="flex items-center gap-1 rounded-md border border-border bg-card/50 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <Download className="size-3" />
          JSON
        </a>
        <button
          type="button"
          onClick={() => setRenaming((r) => !r)}
          disabled={busy}
          className="flex items-center gap-1 rounded-md border border-border bg-card/50 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          title="Rename"
        >
          <Pencil className="size-3" />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="flex items-center gap-1 rounded-md border border-border bg-card/50 px-2 py-1 text-[10px] text-muted-foreground hover:border-red-400/50 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          title="Delete"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        <span>{capture.event_count} events</span>
        <span>{Math.round(capture.duration_ms / 1000)}s</span>
        {capture.button_event_count > 0 && (
          <span className="text-violet-300/80">{capture.button_event_count} buttons</span>
        )}
        {capture.note_event_count > 0 && (
          <span className="text-emerald-300/80">{capture.note_event_count} notes</span>
        )}
        {capture.fx_event_count > 0 && (
          <span className="text-amber-300/80">{capture.fx_event_count} fx</span>
        )}
      </div>
    </div>
  );
}

// ---------- helpers ----------

function defaultName(deviceName: string | null, ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dev = deviceName ? `${deviceName} · ` : "";
  return `${dev}${stamp}`;
}

function filenameBase(deviceName: string | null, startedAt: number | null): string {
  const stamp = startedAt ? new Date(startedAt) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const slug =
    `${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}` +
    `-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}`;
  const device = (deviceName ?? "device").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `monitor-${device}-${slug}`;
}

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
