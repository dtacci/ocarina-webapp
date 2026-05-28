"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useHardwareInput, type HardwareEvent } from "@/hooks/use-hardware-input";
import { useDeviceTelemetry, type TelemetryEvent } from "@/hooks/use-device-telemetry";
import { useLoopState } from "@/hooks/use-loop-state";
import { useLiveConsoleLifecycle } from "@/hooks/use-live-console-lifecycle";

import {
  resolveNoteButtonId,
  resolveButtonIdByPin,
} from "@/lib/hardware/button-layout";
import type { NoteSample } from "@/components/diagnostics/note-readout";
import { EMPTY_FX_STATE, type FxState } from "@/components/diagnostics/fx-state-panel";
import type { LogEntry } from "@/components/diagnostics/live-event-log";

export type ConsoleStatus = "awaiting" | "agent_stale" | "pi_only" | "full";
export type TeensyState = "ok" | "missing" | "busy" | "unknown";

/**
 * Where events arrive from. The state machine downstream is the same for all
 * three — only how raw bytes/messages turn into HardwareEvent / TelemetryEvent
 * differs, and that's the caller's job: when source is "webserial" or
 * "pi_rest", invoke the returned push functions for every event.
 *
 * - realtime: Supabase Realtime broadcast keyed by deviceId (existing Pi
 *   `sync_agent.py` → `/api/sync/telemetry` path).
 * - pi_rest: Direct Pi FastAPI WebSocket (`/events`) via Tailscale Funnel.
 *   Preferred when NEXT_PUBLIC_OCARINA_API is configured.
 * - webserial: Browser-side USB serial (dev-only, ?webserial=1 escape hatch).
 */
export type LiveConsoleSource =
  | { kind: "realtime"; deviceId: string | null }
  | { kind: "pi_rest" }
  | { kind: "webserial" };

const MAX_HISTORY = 20;
const MAX_LOG = 200;
const AWAITING_TIMEOUT_MS = 10_000;
const TEENSY_STALE_MS = 30_000;

export interface UseLiveConsoleSignalsOptions {
  /** Sibling callback fired for every log entry — used by session capture. */
  onEvent?: (entry: LogEntry) => void;
}

export interface UseLiveConsoleSignalsResult {
  status: ConsoleStatus;
  teensyState: TeensyState;
  activePhysical: Set<string>;
  flashNote: string | null;
  currentNote: NoteSample | null;
  noteHistory: NoteSample[];
  fxState: FxState;
  loopState: ReturnType<typeof useLoopState>["loopState"];
  loopStatus: ReturnType<typeof useLoopState>["status"];
  log: LogEntry[];
  /** For WebSerial callers: feed parsed events in here. No-op when using Realtime. */
  pushHardwareEvent: (ev: HardwareEvent) => void;
  pushTelemetryEvent: (ev: TelemetryEvent) => void;
}

export function useLiveConsoleSignals(
  source: LiveConsoleSource,
  options: UseLiveConsoleSignalsOptions = {}
): UseLiveConsoleSignalsResult {
  const { onEvent } = options;
  const realtimeDeviceId = source.kind === "realtime" ? source.deviceId : null;

  useLiveConsoleLifecycle(realtimeDeviceId);

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
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  // The loop engine state Realtime channel is keyed by device id; for
  // WebSerial there's no DB device, so we pass null and rely on the panel's
  // empty-state rendering.
  const { loopState, status: loopStatus } = useLoopState(realtimeDeviceId);

  const appendLog = useCallback((kind: LogEntry["kind"], text: string, ts: number) => {
    logCounterRef.current += 1;
    const id = `${ts}-${logCounterRef.current}`;
    const entry: LogEntry = { id, kind, text, ts };
    setLog((prev) => [entry, ...prev].slice(0, MAX_LOG));
    onEventRef.current?.(entry);
  }, []);

  useEffect(() => {
    if (lastHeartbeatAt !== null) return;
    const iv = setInterval(() => setNowTick(Date.now()), 2000);
    return () => clearInterval(iv);
  }, [lastHeartbeatAt]);

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

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flashNote, setFlashNote] = useState<string | null>(null);
  const triggerFlash = useCallback((btnId: string | null) => {
    setFlashNote(btnId);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashNote(null), 250);
  }, []);

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

  useHardwareInput(realtimeDeviceId, handleHardwareEvent);

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

  useDeviceTelemetry(realtimeDeviceId, handleTelemetry);

  const lastLoopSignatureRef = useRef<string>("");
  useEffect(() => {
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

  return {
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
    pushHardwareEvent: handleHardwareEvent,
    pushTelemetryEvent: handleTelemetry,
  };
}
