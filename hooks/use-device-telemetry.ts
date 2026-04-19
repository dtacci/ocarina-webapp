"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export type TelemetryEvent =
  | { type: "NOTE"; name: string; hz: number; confidence?: number; ts: number }
  | {
      type: "FX";
      field:
        | "mode"
        | "harmony"
        | "distort"
        | "reverb"
        | "reverb_level"
        | "waveform"
        | "synth_harmony"
        | "synth_harmony_interval"
        | "octave";
      value: string | number | boolean;
      ts: number;
    }
  | {
      type: "HEARTBEAT";
      uptime_ms: number;
      teensy?: "ok" | "missing" | "busy";
      ts: number;
    };

export type TelemetryListener = (ev: TelemetryEvent) => void;

/**
 * Subscribes to the Pi's device-telemetry Realtime broadcast channel.
 *
 * The Pi forwards state changes (notes, FX toggles, heartbeats with Teensy
 * state) via `POST /api/sync/telemetry` (see app/api/sync/telemetry/route.ts),
 * which republishes on the broadcast topic `device_telemetry_${deviceId}`.
 *
 * Button press / release events ride a different channel —
 * `device_input_${deviceId}` via `useHardwareInput`.
 */
export function useDeviceTelemetry(
  deviceId: string | null,
  onEvent: TelemetryListener
): void {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (!deviceId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`device_telemetry_${deviceId}`)
      .on("broadcast", { event: "note" }, (msg) => {
        onEventRef.current(normalize(msg.payload));
      })
      .on("broadcast", { event: "fx" }, (msg) => {
        onEventRef.current(normalize(msg.payload));
      })
      .on("broadcast", { event: "heartbeat" }, (msg) => {
        onEventRef.current(normalize(msg.payload));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId]);
}

function normalize(raw: unknown): TelemetryEvent {
  const p = (raw ?? {}) as Record<string, unknown>;
  return {
    ...p,
    ts: typeof p.ts === "number" ? p.ts : Date.now(),
  } as TelemetryEvent;
}
