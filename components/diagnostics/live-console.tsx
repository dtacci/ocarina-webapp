"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, AlertTriangle, Usb } from "lucide-react";

import { useHardwareInput, type HardwareEvent } from "@/hooks/use-hardware-input";
import { useDeviceTelemetry, type TelemetryEvent } from "@/hooks/use-device-telemetry";
import { useLoopState } from "@/hooks/use-loop-state";
import { useLiveConsoleLifecycle } from "@/hooks/use-live-console-lifecycle";

import { DeviceStatusBar } from "@/components/diagnostics/device-status-bar";
import {
  VirtualKeyboard,
  resolveNoteButtonId,
  resolveButtonIdByPin,
} from "@/components/diagnostics/virtual-keyboard";
import { NoteReadout, type NoteSample } from "@/components/diagnostics/note-readout";
import {
  FxStatePanel,
  EMPTY_FX_STATE,
  type FxState,
} from "@/components/diagnostics/fx-state-panel";
import {
  LiveEventLog,
  type LogEntry,
} from "@/components/diagnostics/live-event-log";

const MAX_HISTORY = 20;
const MAX_LOG = 200;
const AWAITING_TIMEOUT_MS = 10_000;
const TEENSY_STALE_MS = 30_000;

type ConsoleStatus = "awaiting" | "agent_stale" | "pi_only" | "full";
type TeensyState = "ok" | "missing" | "busy" | "unknown";

interface Props {
  deviceId: string | null;
  deviceName: string | null;
  initialLastSeenAt: string | null;
  initialIsOnline: boolean;
  initialIsRecent: boolean;
}

export function LiveConsole({
  deviceId,
  deviceName,
  initialLastSeenAt,
  initialIsOnline,
  initialIsRecent,
}: Props) {
  useLiveConsoleLifecycle(deviceId);

  const [activePhysical, setActivePhysical] = useState<Set<string>>(new Set());
  const [currentNote, setCurrentNote] = useState<NoteSample | null>(null);
  const [noteHistory, setNoteHistory] = useState<NoteSample[]>([]);
  const [fxState, setFxState] = useState<FxState>(EMPTY_FX_STATE);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [teensyState, setTeensyState] = useState<TeensyState>("unknown");
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
  const [lastTeensyTelemetryAt, setLastTeensyTelemetryAt] = useState<number | null>(null);
  const [mountedAt] = useState<number>(() => Date.now());
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const logCounterRef = useRef(0);
  const { loopState, status: loopStatus } = useLoopState(deviceId);

  const appendLog = useCallback((kind: LogEntry["kind"], text: string, ts: number) => {
    logCounterRef.current += 1;
    const id = `${ts}-${logCounterRef.current}`;
    setLog((prev) => [{ id, kind, text, ts }, ...prev].slice(0, MAX_LOG));
  }, []);

  // Re-tick every 2s while awaiting so the agent_stale timeout fires without a
  // dependent state change. Only while we don't have a heartbeat yet.
  useEffect(() => {
    if (lastHeartbeatAt !== null) return;
    const iv = setInterval(() => setNowTick(Date.now()), 2000);
    return () => clearInterval(iv);
  }, [lastHeartbeatAt]);

  // Derive the console status from observed signals.
  const status: ConsoleStatus = useMemo(() => {
    if (lastHeartbeatAt === null) {
      return nowTick - mountedAt > AWAITING_TIMEOUT_MS ? "agent_stale" : "awaiting";
    }
    if (
      lastTeensyTelemetryAt !== null &&
      nowTick - lastTeensyTelemetryAt < TEENSY_STALE_MS
    ) {
      return "full";
    }
    return "pi_only";
  }, [lastHeartbeatAt, lastTeensyTelemetryAt, mountedAt, nowTick]);

  // Note flash — ~250ms highlight on the keyboard.
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flashNote, setFlashNote] = useState<string | null>(null);
  const triggerFlash = useCallback((btnId: string | null) => {
    setFlashNote(btnId);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashNote(null), 250);
  }, []);

  // Physical button events (device_input_${deviceId})
  const handleHardwareEvent = useCallback(
    (ev: HardwareEvent) => {
      const ts = ev.ts || Date.now();
      if (typeof ev.button === "number") {
        const teensyId = resolveButtonIdByPin(ev.button, "teensy");
        const piId = teensyId ? null : resolveButtonIdByPin(ev.button, "pi");
        const id = teensyId ?? piId;
        if (id) {
          setActivePhysical((prev) => {
            const next = new Set(prev);
            if (ev.event === "press") next.add(id);
            else next.delete(id);
            return next;
          });
        }
        appendLog(
          "button",
          `pin ${ev.button} ${ev.event ?? "?"}${id ? ` (${id})` : ""}`,
          ts
        );
      }
      if (typeof ev.rotary === "number") {
        appendLog("button", `rotary ${ev.rotary > 0 ? "+" : ""}${ev.rotary}`, ts);
      }
    },
    [appendLog]
  );

  useHardwareInput(deviceId, handleHardwareEvent);

  // Rich telemetry (device_telemetry_${deviceId})
  const handleTelemetry = useCallback(
    (ev: TelemetryEvent) => {
      const ts = ev.ts || Date.now();
      switch (ev.type) {
        case "NOTE": {
          const sample: NoteSample = {
            name: ev.name,
            hz: ev.hz,
            confidence: ev.confidence,
            ts,
          };
          setCurrentNote(sample);
          setNoteHistory((prev) => [sample, ...prev].slice(0, MAX_HISTORY));
          setLastTeensyTelemetryAt(ts);
          const btnId = resolveNoteButtonId(ev.name);
          if (btnId) triggerFlash(btnId);
          appendLog("note", `${ev.name} · ${ev.hz.toFixed(1)}Hz`, ts);
          break;
        }
        case "FX": {
          setFxState((prev) => ({ ...prev, [ev.field]: ev.value }));
          setLastTeensyTelemetryAt(ts);
          appendLog("fx", `${ev.field} = ${String(ev.value)}`, ts);
          break;
        }
        case "HEARTBEAT": {
          setLastHeartbeatAt(ts);
          if (ev.teensy) {
            setTeensyState(ev.teensy);
            if (ev.teensy === "ok") setLastTeensyTelemetryAt(ts);
          }
          appendLog(
            "heartbeat",
            `uptime ${Math.round(ev.uptime_ms / 1000)}s${ev.teensy ? ` · teensy=${ev.teensy}` : ""}`,
            ts
          );
          break;
        }
      }
    },
    [appendLog, triggerFlash]
  );

  useDeviceTelemetry(deviceId, handleTelemetry);

  // Loop state changes → log (hook already powers its own panel).
  const lastLoopSignatureRef = useRef<string>("");
  useMemo(() => {
    const sig = JSON.stringify({
      tracks: loopState.tracks.map((t) => `${t.id}:${t.state}`),
      bpm: loopState.bpm,
      active: loopState.active_track,
    });
    if (sig !== lastLoopSignatureRef.current && lastLoopSignatureRef.current !== "") {
      appendLog(
        "loop",
        `active=${loopState.active_track}${loopState.bpm ? ` · ${loopState.bpm} bpm` : ""} · ${loopState.tracks
          .map((t) => `${t.id}:${t.state}`)
          .join(" ")}`,
        Date.now()
      );
    }
    lastLoopSignatureRef.current = sig;
  }, [loopState, appendLog]);

  const isFull = status === "full";

  return (
    <div className="space-y-4">
      <DeviceStatusBar
        initialLastSeenAt={initialLastSeenAt}
        initialIsOnline={initialIsOnline}
        initialIsRecent={initialIsRecent}
        deviceName={deviceName}
      />

      <ConsoleStatusRow status={status} teensy={teensyState} />

      {status === "awaiting" && <AwaitingCard />}
      {status === "agent_stale" && <AgentStaleCard />}

      {status !== "awaiting" && status !== "agent_stale" && (
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
              <TeensyBanner teensy={teensyState} />
            )}
          </div>

          {isFull && (
            <>
              <FxStatePanel state={fxState} />
              <LoopStatePanel loopState={loopState} status={loopStatus} />
            </>
          )}
        </>
      )}

      <LiveEventLog entries={log} />
    </div>
  );
}

function ConsoleStatusRow({
  status,
  teensy,
}: {
  status: ConsoleStatus;
  teensy: TeensyState;
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

function AwaitingCard() {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-6">
      <Loader2 className="size-4 animate-spin text-muted-foreground" />
      <div>
        <div className="text-sm font-medium">Asking device to start streaming…</div>
        <div className="text-xs text-muted-foreground">
          The webapp is waiting for the Pi to acknowledge and begin sending telemetry.
        </div>
      </div>
    </div>
  );
}

function AgentStaleCard() {
  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 text-red-400" />
        <div className="space-y-1">
          <div className="text-sm font-medium text-red-300">
            Device agent isn't responding
          </div>
          <div className="text-xs text-muted-foreground">
            The Pi's SyncAgent didn't answer within 10 seconds. Likely running an
            older version without Live Console support. Update the Pi and restart
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              sync_agent.py
            </code>
            then reopen this page.
          </div>
        </div>
      </div>
    </div>
  );
}

function TeensyBanner({ teensy }: { teensy: TeensyState }) {
  const variant = teensy === "busy" ? "busy" : "missing";
  const title = variant === "busy" ? "Teensy busy" : "Teensy not connected";
  const body =
    variant === "busy"
      ? "The Teensy is in use by the Ocarina app. Stop main.py on the Pi and reopen the console to debug the Teensy directly."
      : "Plug the Teensy into the Pi's USB to unlock notes, FX state, and loop tracks here. Pi GPIO buttons still work below.";
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-card/40 p-4">
      <div className="flex items-start gap-3">
        <Usb className="mt-0.5 size-5 text-muted-foreground" />
        <div className="space-y-1">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{body}</div>
        </div>
      </div>
    </div>
  );
}

function LoopStatePanel({
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
