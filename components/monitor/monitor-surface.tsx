"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  useLiveConsoleSignals,
  type LiveConsoleSource,
} from "@/hooks/use-live-console-signals";
import { useLoopState } from "@/hooks/use-loop-state";
import { useWebSerialTeensy } from "@/hooks/use-web-serial-teensy";
import { usePiRestTeensy } from "@/hooks/use-pi-rest-teensy";

import { DeviceStatusBar } from "@/components/diagnostics/device-status-bar";
import { VirtualKeyboard } from "@/components/diagnostics/virtual-keyboard";
import { NoteReadout } from "@/components/diagnostics/note-readout";
import { FxStatePanel } from "@/components/diagnostics/fx-state-panel";
import { LiveEventLog, type LogEntry } from "@/components/diagnostics/live-event-log";

import { MicActivityStrip } from "@/components/monitor/mic-activity-strip";
import { SessionCapturePanel } from "@/components/monitor/session-capture-panel";
import { TeensyConnectCard } from "@/components/monitor/teensy-connect-card";
import { PiRestStatusCard } from "@/components/monitor/pi-rest-status-card";

export type MonitorMode =
  | {
      kind: "realtime";
      deviceId: string;
      deviceName: string | null;
      initialLastSeenAt: string | null;
      initialIsOnline: boolean;
      initialIsRecent: boolean;
    }
  | { kind: "pi_rest" }
  | { kind: "webserial" };

interface Props {
  mode: MonitorMode;
}

export function MonitorSurface({ mode }: Props) {
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

  const source: LiveConsoleSource = useMemo(() => {
    if (mode.kind === "realtime") {
      return { kind: "realtime", deviceId: mode.deviceId };
    }
    if (mode.kind === "pi_rest") return { kind: "pi_rest" };
    return { kind: "webserial" };
  }, [mode]);

  const signals = useLiveConsoleSignals(source, { onEvent });

  // Run all transport hooks unconditionally (rules of hooks), gated by
  // `enabled` so only one is live at a time.
  const [baudRate, setBaudRate] = useState(115200);
  const webserial = useWebSerialTeensy({
    baudRate,
    enabled: mode.kind === "webserial",
    onHardware: signals.pushHardwareEvent,
    onTelemetry: signals.pushTelemetryEvent,
  });
  const piRest = usePiRestTeensy({
    enabled: mode.kind === "pi_rest",
    onHardware: signals.pushHardwareEvent,
    onTelemetry: signals.pushTelemetryEvent,
  });

  const isConnected = (() => {
    if (mode.kind === "webserial") return webserial.status === "connected";
    if (mode.kind === "pi_rest") return piRest.status === "connected";
    return signals.status === "full" || signals.status === "pi_only";
  })();
  const isFull = (() => {
    if (mode.kind === "webserial") return webserial.status === "connected";
    if (mode.kind === "pi_rest") return piRest.status === "connected";
    return signals.status === "full";
  })();

  return (
    <div className="space-y-4">
      {mode.kind === "realtime" && (
        <>
          <DeviceStatusBar
            initialLastSeenAt={mode.initialLastSeenAt}
            initialIsOnline={mode.initialIsOnline}
            initialIsRecent={mode.initialIsRecent}
            deviceName={mode.deviceName}
          />
          <PiStatusRow status={signals.status} teensy={signals.teensyState} />
        </>
      )}

      {mode.kind === "pi_rest" && <PiRestStatusCard piRest={piRest} />}

      {mode.kind === "webserial" && (
        <TeensyConnectCard
          teensy={webserial}
          baudRate={baudRate}
          onBaudChange={setBaudRate}
        />
      )}

      {isConnected && (
        <>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-xl border bg-card p-4">
              <VirtualKeyboard
                activePhysical={signals.activePhysical}
                flashNote={signals.flashNote}
                deviceId={mode.kind === "realtime" ? mode.deviceId : null}
                teensyInteractive={isFull}
                onSimKey={
                  mode.kind === "webserial" ? webserial.sendSimKey : undefined
                }
              />
            </div>
            {isFull ? (
              <NoteReadout
                current={signals.currentNote}
                history={signals.noteHistory}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-card/40 p-4 text-xs text-muted-foreground">
                Pi only — plug the Teensy in for note readout, FX, and loop state.
              </div>
            )}
          </div>

          <MicActivityStrip
            current={signals.currentNote}
            history={signals.noteHistory}
          />

          {isFull && mode.kind === "realtime" && (
            <>
              <FxStatePanel state={signals.fxState} />
              <LoopPanel
                loopState={signals.loopState}
                status={signals.loopStatus}
              />
            </>
          )}

          {isFull && mode.kind !== "realtime" && (
            <FxStatePanel state={signals.fxState} />
          )}
        </>
      )}

      <SessionCapturePanel
        registerSink={registerSink}
        deviceName={
          mode.kind === "realtime"
            ? mode.deviceName
            : mode.kind === "pi_rest"
              ? "pi-rest"
              : "teensy"
        }
      />
      <LiveEventLog entries={signals.log} />
    </div>
  );
}

function PiStatusRow({
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
