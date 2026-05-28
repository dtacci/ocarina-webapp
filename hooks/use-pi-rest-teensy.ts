"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { HardwareEvent } from "@/hooks/use-hardware-input";
import type { TelemetryEvent } from "@/hooks/use-device-telemetry";
import {
  isOcarinaApiConfigured,
  ocarina,
  openEventStream,
  type HeartbeatEvent,
  type StatusResponse,
  type TeensyHealth,
} from "@/lib/ocarina-api";
import { NOTE_BUTTONS } from "@/lib/hardware/button-layout";

const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

/** Equal-temperament Hz → "A4" / "F#5" / "?". */
function hzToNoteName(hz: number): string {
  if (!Number.isFinite(hz) || hz <= 0) return "?";
  const midi = Math.round(12 * Math.log2(hz / 440) + 69);
  const idx = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[idx]}${octave}`;
}

export type PiRestStatus =
  | "disabled"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface UsePiRestTeensyOptions {
  /** When false, the hook is fully inert. Defaults to true. */
  enabled?: boolean;
  onHardware?: (ev: HardwareEvent) => void;
  onTelemetry?: (ev: TelemetryEvent) => void;
}

export interface UsePiRestTeensy {
  status: PiRestStatus;
  errorMessage: string | null;
  isConfigured: boolean;
  /** Latest button mapping snapshot (also re-fetched on demand). */
  buttonStatus: StatusResponse | null;
  refreshStatus: () => Promise<void>;
  /** Latest pots snapshot from the most recent heartbeat. */
  pots: HeartbeatEvent["pots"] | null;
  /** Wall-clock ms when the last heartbeat was received. */
  lastHeartbeatAt: number | null;
  /** Latest Pi → Teensy round-trip latency in ms, polled every 15s. */
  teensyLatencyMs: number | null;
}

/**
 * Subscribes to the Pi's `/events` WebSocket and forwards parsed messages as
 * the same HardwareEvent / TelemetryEvent shapes the Realtime path emits, so
 * useLiveConsoleSignals stays transport-agnostic.
 *
 * Auto-connects when NEXT_PUBLIC_OCARINA_API is set (no user gesture needed,
 * unlike WebSerial). Exponential reconnect on close — Tailscale Funnel can
 * drop the WS during transient network blips.
 */
export function usePiRestTeensy(
  options: UsePiRestTeensyOptions = {}
): UsePiRestTeensy {
  const { enabled = true, onHardware, onTelemetry } = options;

  const onHwRef = useRef(onHardware);
  const onTelRef = useRef(onTelemetry);
  useEffect(() => { onHwRef.current = onHardware; }, [onHardware]);
  useEffect(() => { onTelRef.current = onTelemetry; }, [onTelemetry]);

  const isConfigured = isOcarinaApiConfigured();
  const [status, setStatus] = useState<PiRestStatus>(
    !enabled || !isConfigured ? "disabled" : "connecting"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [buttonStatus, setButtonStatus] = useState<StatusResponse | null>(null);
  const [pots, setPots] = useState<HeartbeatEvent["pots"] | null>(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
  const [teensyLatencyMs, setTeensyLatencyMs] = useState<number | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!isConfigured) return;
    try {
      const s = await ocarina.status();
      setButtonStatus(s);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Status fetch failed");
    }
  }, [isConfigured]);

  // Initial status load when the hook becomes active.
  useEffect(() => {
    if (!enabled || !isConfigured) return;
    void refreshStatus();
  }, [enabled, isConfigured, refreshStatus]);

  // Periodic Teensy latency poll. The Pi reports Funnel + serial round-trip
  // combined here — typically ~0–5ms when healthy, climbs sharply during
  // Tailscale blips or Teensy reflashes.
  useEffect(() => {
    if (!enabled || !isConfigured) return;
    let cancelled = false;
    const pollOnce = async () => {
      try {
        const h: TeensyHealth = await ocarina.teensyHealth();
        if (cancelled) return;
        setTeensyLatencyMs(h.connected ? h.latency_ms : null);
      } catch {
        if (!cancelled) setTeensyLatencyMs(null);
      }
    };
    void pollOnce();
    const iv = setInterval(pollOnce, 15_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [enabled, isConfigured]);

  // WebSocket lifecycle with exponential reconnect.
  useEffect(() => {
    if (!enabled || !isConfigured) {
      setStatus("disabled");
      return;
    }

    let cancelled = false;
    let backoffMs = 500;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (cancelled) return;
      setStatus("connecting");
      ws = openEventStream({
        onOpen: () => {
          if (cancelled) return;
          setStatus("connected");
          setErrorMessage(null);
          backoffMs = 500;
        },
        onClose: (reason) => {
          if (cancelled) return;
          setStatus("disconnected");
          setErrorMessage(reason);
          setTimeout(connect, backoffMs);
          backoffMs = Math.min(backoffMs * 2, 8000);
        },
        onError: () => {
          // onClose follows; let the reconnect path handle status.
          if (cancelled) return;
          setStatus("error");
        },
        onHeartbeat: (e) => {
          const ts = Date.now();
          setPots(e.pots);
          setLastHeartbeatAt(ts);
          onTelRef.current?.({
            type: "HEARTBEAT",
            uptime_ms: Math.round(e.uptime_s * 1000),
            teensy: "ok",
            ts,
          });
          // The Pi packs live mic data into every heartbeat. We emit a NOTE
          // telemetry sample whenever the mic is enabled — no amplitude
          // threshold — so the strip + readout always reflect what the Pi
          // is hearing. Bar height comes from `amplitude` downstream, so
          // silence renders as low bars and singing renders as tall bars
          // without us needing to guess a threshold.
          if (e.mic.enabled) {
            onTelRef.current?.({
              type: "NOTE",
              name: hzToNoteName(e.mic.freq_hz),
              hz: e.mic.freq_hz,
              confidence: e.mic.probability,
              amplitude: e.mic.amplitude,
              ts,
            });
          }
        },
        onNoteOn: (e) => {
          onTelRef.current?.({
            type: "NOTE",
            name: e.note,
            hz: e.freq_hz,
            ts: Date.now(),
          });
        },
        onNoteOff: (e) => {
          // Pi sends button index 1..12; resolve to a Teensy pin so the
          // virtual keyboard lights up. Buttons 9..12 fall outside the
          // 8-entry NOTE_BUTTONS layout — use the raw button number then,
          // which won't highlight but will still appear in the event log.
          const def = NOTE_BUTTONS[e.button - 1];
          const pin = def?.pin ?? e.button;
          onHwRef.current?.({ button: pin, event: "release", ts: Date.now() });
        },
      });
    };
    connect();

    return () => {
      cancelled = true;
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, [enabled, isConfigured]);

  return {
    status,
    errorMessage,
    isConfigured,
    buttonStatus,
    refreshStatus,
    pots,
    lastHeartbeatAt,
    teensyLatencyMs,
  };
}
