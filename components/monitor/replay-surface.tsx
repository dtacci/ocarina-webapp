"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { useLiveConsoleSignals } from "@/hooks/use-live-console-signals";
import { useReplayPlayback } from "@/hooks/use-replay-playback";

import { VirtualKeyboard } from "@/components/diagnostics/virtual-keyboard";
import { NoteReadout } from "@/components/diagnostics/note-readout";
import { FxStatePanel } from "@/components/diagnostics/fx-state-panel";
import { LiveEventLog, type LogEntry } from "@/components/diagnostics/live-event-log";

import { MicActivityStrip } from "@/components/monitor/mic-activity-strip";
import { ReplayControls } from "@/components/monitor/replay-controls";
import { LoopStatePanel } from "@/components/looper/loop-state-panel";
import type { LoopSnapshot } from "@/lib/ocarina-api";

interface CaptureMeta {
  id: string;
  name: string;
  blobUrl: string;
  source: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  eventCount: number;
}

interface CapturePayload {
  name: string;
  source: string;
  deviceId: string | null;
  deviceName: string | null;
  startedAt: string;
  endedAt: string;
  eventCount: number;
  events: LogEntry[];
  loopSnapshots?: { ts: number; snapshot: LoopSnapshot }[];
}

interface Props {
  capture: CaptureMeta;
}

export function ReplaySurface({ capture }: Props) {
  const [payload, setPayload] = useState<CapturePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(capture.blobUrl);
        if (!res.ok) throw new Error(`Blob fetch ${res.status} ${res.statusText}`);
        const body = (await res.json()) as CapturePayload;
        if (!cancelled) setPayload(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed");
      }
    })();
    return () => { cancelled = true; };
  }, [capture.blobUrl]);

  const signals = useLiveConsoleSignals({ kind: "replay" });
  const [currentLoop, setCurrentLoop] = useState<LoopSnapshot | null>(null);

  // Reset signals state when the capture changes by remounting via key. Inside
  // the same capture, the scheduler just keeps pushing.
  const onLog = useCallback((entry: LogEntry) => {
    // The scheduler emits this for every entry; signals' appendLog already runs
    // via the parsed pushHardwareEvent / pushTelemetryEvent. We only forward
    // unparseable entries here so they still show in the log.
    void entry;
  }, []);

  const onLoopSnapshot = useCallback((snapshot: LoopSnapshot) => {
    setCurrentLoop(snapshot);
  }, []);

  // Reset loop state when the capture itself changes (different blobUrl).
  useEffect(() => {
    setCurrentLoop(null);
  }, [capture.blobUrl]);

  const startMs = payload ? new Date(payload.startedAt).getTime() : 0;
  const endMs = payload ? new Date(payload.endedAt).getTime() : 0;
  const hasLoopSnapshots = (payload?.loopSnapshots?.length ?? 0) > 0;

  const playback = useReplayPlayback({
    events: payload?.events ?? [],
    loopSnapshots: payload?.loopSnapshots,
    startMs,
    endMs,
    onHardware: signals.pushHardwareEvent,
    onTelemetry: signals.pushTelemetryEvent,
    onLog,
    onLoopSnapshot,
  });

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-4 text-red-400" />
        <div>
          <div className="font-medium text-red-300">Couldn&apos;t load capture</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> loading capture…
      </div>
    );
  }

  const labelTime = new Date(payload.startedAt).toLocaleString();
  const label = `${payload.deviceName ?? "device"} · ${labelTime}`;

  return (
    <div className="space-y-4">
      <ReplayControls playback={playback} label={label} />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border bg-card p-4">
          <VirtualKeyboard
            activePhysical={signals.activePhysical}
            flashNote={signals.flashNote}
            deviceId={null}
            teensyInteractive={false}
          />
        </div>
        <NoteReadout
          current={signals.currentNote}
          history={signals.noteHistory}
        />
      </div>

      <MicActivityStrip
        current={signals.currentNote}
        history={signals.noteHistory}
      />

      <FxStatePanel state={signals.fxState} />

      {hasLoopSnapshots && (
        <LoopStatePanel
          snapshot={currentLoop}
          progress={null}
          teensyConnected={true}
        />
      )}

      <LiveEventLog entries={signals.log} />
    </div>
  );
}
