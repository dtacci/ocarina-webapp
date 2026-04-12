"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export interface HardwareEvent {
  button?: number; // 1-8
  event?: "press" | "release";
  rotary?: number; // +1 / -1
  ts: number;
}

export type HardwareListener = (ev: HardwareEvent) => void;

/**
 * Subscribes to the Pi's hardware-input Realtime broadcast channel.
 *
 * The Pi forwards Teensy button / rotary events via
 * `POST /api/sync/input-events` (see app/api/sync/input-events/route.ts),
 * which republishes on the broadcast topic `device_input_${deviceId}`. This
 * hook subscribes and calls `onEvent` for each incoming event.
 *
 * Transport is Supabase Realtime broadcast (ephemeral, ~40-100ms typical
 * latency, rides the same WS connection the browser already holds for
 * `loop_state`). Chosen for zero new infra on the MVP.
 *
 * To swap this for a direct WebSocket transport later (e.g. PartyKit or
 * Cloudflare Durable Objects) — when the Ocarina grows velocity-sensitive
 * drum pads and needs sub-50ms latency — only this hook's implementation
 * needs to change. The `HardwareEvent` contract stays the same.
 */
export function useHardwareInput(
  deviceId: string | null,
  onEvent: HardwareListener
): void {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (!deviceId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`device_input_${deviceId}`)
      .on("broadcast", { event: "hw" }, (msg) => {
        const payload = (msg.payload ?? {}) as Partial<HardwareEvent>;
        onEventRef.current({
          button: payload.button,
          event: payload.event,
          rotary: payload.rotary,
          ts: payload.ts ?? Date.now(),
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId]);
}
