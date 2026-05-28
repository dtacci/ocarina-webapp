"use client";

import { useCallback, useRef } from "react";

import { useLiveConsoleSignals } from "@/hooks/use-live-console-signals";
import { useLoopState } from "@/hooks/use-loop-state";

import { DeviceStatusBar } from "@/components/diagnostics/device-status-bar";
import { VirtualKeyboard } from "@/components/diagnostics/virtual-keyboard";
import { NoteReadout } from "@/components/diagnostics/note-readout";
import { FxStatePanel } from "@/components/diagnostics/fx-state-panel";
import { LiveEventLog, type LogEntry } from "@/components/diagnostics/live-event-log";

import { MicActivityStrip } from "@/components/monitor/mic-activity-strip";
import { SessionCapturePanel } from "@/components/monitor/session-capture-panel";

interface Props {
  deviceId: string;
  deviceName: string | null;
  initialLastSeenAt: string | null;
  initialIsOnline: boolean;
  initialIsRecent: boolean;
}

export function MonitorSurface({
  deviceId,
  deviceName,
  initialLastSeenAt,
  initialIsOnline,
  initialIsRecent,
}: Props) {
  // The capture panel registers a sink imperatively. We hold it in a ref so
  // the hook's onEvent callback stays stable while we swap the underlying
  // function (start / stop without rebuilding subscriptions).
  const sinkRef = useRef<((entry: LogEntry) => void) | null>(null);
  const registerSink = useCallback(
    (sink: ((entry: LogEntry) => void) | null) => {
      sinkRef.current = sink;
    },
    []
  );
  const onEvent = useCallback((entry: LogEntry) => {
    sinkRef.current?.(entry);
  }, []);

  const {
    status,
    teensyState,
    activePhysical,
    flashNote,
    currentNote,
    noteHistory,
    fxState,
    loopState,
    loopStatus,
    log,
  } = useLiveConsoleSignals(deviceId, { onEvent });

  const ready = status === "full" || status === "pi_only";
  const isFull = status === "full";

  return (
    <div className="space-y-4">
      <DeviceStatusBar
        initialLastSeenAt={initialLastSeenAt}
        initialIsOnline={initialIsOnline}
        initialIsRecent={initialIsRecent}
        deviceName={deviceName}
      />

      <StatusRow status={status} teensy={teensyState} />

      {ready && (
        <>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-xl border bg-card p-4">
              <VirtualKeyboard
                activePhysical={activePhysical}
                flashNote={flashNote}
                deviceId={deviceId}
                teensyInteractive={isFull}
              />
            </div>
            {isFull ? (
              <NoteReadout current={currentNote} history={noteHistory} />
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-card/40 p-4 text-xs text-muted-foreground">
                Pi only — plug the Teensy in for note readout, FX, and loop state.
              </div>
            )}
          </div>

          <MicActivityStrip current={currentNote} history={noteHistory} />

          {isFull && (
            <>
              <FxStatePanel state={fxState} />
              <LoopPanel loopState={loopState} status={loopStatus} />
            </>
          )}
        </>
      )}

      <SessionCapturePanel registerSink={registerSink} deviceName={deviceName} />
      <LiveEventLog entries={log} />
    </div>
  );
}

function StatusRow({
  status,
  teensy,
}: {
  status: ReturnType<typeof useLiveConsoleSignals>["status"];
  teensy: ReturnType<typeof useLiveConsoleSignals>["teensyState"];
}) {
  const piLabel =
    status === "awaiting" ? "starting…"
    : status === "agent_stale" ? "no response"
    : "streaming";
  const teensyLabel =
    teensy === "ok" ? "connected"
    : teensy === "missing" ? "not connected"
    : teensy === "busy" ? "busy (app running)"
    : "?";
  const piColor =
    status === "awaiting" ? "text-amber-400"
    : status === "agent_stale" ? "text-red-400"
    : "text-emerald-400";
  const teensyColor =
    teensy === "ok" ? "text-emerald-400"
    : teensy === "missing" ? "text-muted-foreground"
    : teensy === "busy" ? "text-amber-400"
    : "text-muted-foreground";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card/60 px-4 py-2 text-xs">
      <span className="text-muted-foreground">Pi:</span>
      <span className={`font-mono font-semibold ${piColor}`}>{piLabel}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">Teensy:</span>
      <span className={`font-mono font-semibold ${teensyColor}`}>{teensyLabel}</span>
    </div>
  );
}

function LoopPanel({
  loopState,
  status,
}: {
  loopState: ReturnType<typeof useLoopState>["loopState"];
  status: ReturnType<typeof useLoopState>["status"];
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Loop engine</h2>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {status}
          {loopState.bpm ? ` · ${loopState.bpm} bpm` : ""}
        </span>
      </div>
      <div className="space-y-1.5">
        {loopState.tracks.map((t) => {
          const active = t.id === loopState.active_track;
          const color =
            t.state === "recording"
              ? "bg-red-500/15 border-red-500 text-red-100"
              : t.state === "playing"
              ? "bg-emerald-500/15 border-emerald-500 text-emerald-100"
              : t.state === "muted"
              ? "bg-muted/20 border-border text-muted-foreground"
              : "bg-background/40 border-border/60 text-muted-foreground/70";
          return (
            <div
              key={t.id}
              className={[
                "flex items-center gap-3 rounded-lg border px-3 py-1.5 text-xs",
                color,
                active ? "ring-1 ring-amber-400/60" : "",
              ].join(" ")}
            >
              <span className="w-6 font-mono font-semibold">{t.id}</span>
              <span className="w-20 font-mono uppercase tracking-wider">
                {t.state}
              </span>
              <span className="flex-1 font-mono tabular-nums text-muted-foreground/80">
                {t.length_ms > 0 ? `${(t.length_ms / 1000).toFixed(2)}s` : "—"}
              </span>
              {t.muted && <span className="text-[10px] text-muted-foreground">MUTED</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
