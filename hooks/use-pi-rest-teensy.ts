"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { HardwareEvent } from "@/hooks/use-hardware-input";
import type { TelemetryEvent } from "@/hooks/use-device-telemetry";
import {
  isOcarinaApiConfigured,
  ocarina,
  openEventStream,
  type StatusResponse,
} from "@/lib/ocarina-api";
import { NOTE_BUTTONS } from "@/lib/hardware/button-layout";

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
          onTelRef.current?.({
            type: "HEARTBEAT",
            uptime_ms: Math.round(e.uptime_s * 1000),
            teensy: "ok",
            ts: Date.now(),
          });
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
  };
}
