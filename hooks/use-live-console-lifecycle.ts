"use client";

import { useEffect, useRef } from "react";

const KEEPALIVE_INTERVAL_MS = 30_000;

async function sendCommand(deviceId: string, command: string) {
  try {
    await fetch("/api/sync/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, command }),
    });
  } catch {
    // Silent — missing commands manifest as UI staying in `awaiting`, which
    // is already a user-visible signal.
  }
}

/**
 * Live Console lifecycle: on mount, ask the Pi to enable telemetry streaming;
 * while mounted and the tab is visible, push a keepalive every 30s so the Pi
 * doesn't time out; on unmount we intentionally send nothing — we rely on the
 * Pi's 60s deadline to stop streaming.
 *
 * Why no disable-on-unmount:
 *   - Multi-tab safety. Tab A unmount disabling while Tab B is still open
 *     would create a 30s dead zone until Tab B's next keepalive re-enables.
 *   - Costs at most 60s of wasted Pi telemetry after the last tab closes,
 *     which is acceptable for a debug tool.
 */
export function useLiveConsoleLifecycle(deviceId: string | null): void {
  const deviceIdRef = useRef<string | null>(deviceId);

  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId) return;

    // Initial enable
    sendCommand(deviceId, "enable_live_console");

    let stopped = false;
    const interval = setInterval(() => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.hidden) return;
      const id = deviceIdRef.current;
      if (!id) return;
      sendCommand(id, "live_console_keepalive");
    }, KEEPALIVE_INTERVAL_MS);

    // Visibility handler: when tab comes back into focus, send an immediate
    // keepalive so we don't wait up to 30s for the interval to fire and the
    // Pi doesn't time out in between.
    function onVisibility() {
      if (stopped) return;
      if (typeof document !== "undefined" && document.hidden) return;
      const id = deviceIdRef.current;
      if (!id) return;
      sendCommand(id, "live_console_keepalive");
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      stopped = true;
      clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      // Intentional: do NOT send disable_live_console. Pi's 60s deadline handles it.
    };
  }, [deviceId]);
}
