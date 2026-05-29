/**
 * Stage 0 — Latency calibration (doc §3.1).
 *
 * The detector reports the moment it was *confident* a note was being sung,
 * which lags the actual onset by ~30–50ms. Shift every timestamp back by the
 * per-device `detector_latency_ms` before quantization, or short notes
 * systematically late-snap.
 */

import type { OcarinaEvent, OcarinaHeader, Warning } from "../types";

/** Used when the header omits a calibration value (older firmware). */
export const DEFAULT_LATENCY_MS = 35;

export interface LatencyResult {
  events: OcarinaEvent[];
  warnings: Warning[];
}

export function applyLatency(
  events: OcarinaEvent[],
  header: OcarinaHeader,
): LatencyResult {
  const warnings: Warning[] = [];
  let latency = header.detector_latency_ms;

  if (typeof latency !== "number" || !Number.isFinite(latency)) {
    latency = DEFAULT_LATENCY_MS;
    warnings.push({
      kind: "missing_latency_calibration",
      message: `Detector latency calibration was missing; using ${DEFAULT_LATENCY_MS}ms default.`,
    });
  }

  if (latency === 0) return { events, warnings };

  const shifted = events.map((e) => {
    if ("t_ms" in e && typeof e.t_ms === "number") {
      // Never push a timestamp before the session start.
      return { ...e, t_ms: Math.max(0, e.t_ms - latency) } as OcarinaEvent;
    }
    return e;
  });

  return { events: shifted, warnings };
}
