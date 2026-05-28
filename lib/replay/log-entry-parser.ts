/**
 * Parses the display strings written by useLiveConsoleSignals.appendLog back
 * into the original HardwareEvent / TelemetryEvent shapes so a saved capture
 * can be replayed through the same panels that rendered it live. Strings the
 * parser doesn't recognize are returned as null — replay still shows them in
 * the event log via the LogEntry itself.
 *
 * Keep these regexes in sync with the appendLog calls in
 * hooks/use-live-console-signals.ts and hooks/use-pi-rest-teensy.ts.
 */

import type { HardwareEvent } from "@/hooks/use-hardware-input";
import type { TelemetryEvent } from "@/hooks/use-device-telemetry";
import type { LogEntry } from "@/components/diagnostics/live-event-log";

export type ParsedEntry =
  | { kind: "hw"; event: HardwareEvent }
  | { kind: "tel"; event: TelemetryEvent };

export function parseLogEntry(entry: LogEntry): ParsedEntry | null {
  switch (entry.kind) {
    case "button":   return parseButton(entry);
    case "note":     return parseNote(entry);
    case "fx":       return parseFx(entry);
    case "heartbeat": return parseHeartbeat(entry);
    default:         return null;
  }
}

function parseButton(entry: LogEntry): ParsedEntry | null {
  // "pin <N> press" / "pin <N> release" optionally with " (BTN)"
  const mPin = entry.text.match(/^pin\s+(\d+)\s+(press|release|down|up)/);
  if (mPin) {
    const evt = mPin[2] === "press" || mPin[2] === "down" ? "press" : "release";
    return {
      kind: "hw",
      event: { button: Number(mPin[1]), event: evt, ts: entry.ts },
    };
  }
  // "rotary +1" / "rotary -1"
  const mRot = entry.text.match(/^rotary\s+([+-]?\d+)/);
  if (mRot) {
    return { kind: "hw", event: { rotary: Number(mRot[1]), ts: entry.ts } };
  }
  return null;
}

function parseNote(entry: LogEntry): ParsedEntry | null {
  // "<name> · <hz>Hz" optionally with " · amp <amp>"
  const m = entry.text.match(
    /^(\S+)\s+·\s+([\d.]+)Hz(?:\s+·\s+amp\s+([\d.]+))?$/
  );
  if (!m) return null;
  return {
    kind: "tel",
    event: {
      type: "NOTE",
      name: m[1],
      hz: Number(m[2]),
      amplitude: m[3] !== undefined ? Number(m[3]) : undefined,
      ts: entry.ts,
    },
  };
}

const FX_FIELDS: ReadonlySet<string> = new Set([
  "mode",
  "harmony",
  "distort",
  "reverb",
  "reverb_level",
  "waveform",
  "synth_harmony",
  "synth_harmony_interval",
  "octave",
]);

function parseFx(entry: LogEntry): ParsedEntry | null {
  // "<field> = <value>"
  const m = entry.text.match(/^(\w+)\s+=\s+(.+)$/);
  if (!m || !FX_FIELDS.has(m[1])) return null;
  const raw = m[2].trim();
  let value: string | number | boolean = raw;
  if (raw === "true") value = true;
  else if (raw === "false") value = false;
  else if (/^-?\d+(\.\d+)?$/.test(raw)) value = Number(raw);
  return {
    kind: "tel",
    event: {
      type: "FX",
      field: m[1] as TelemetryEvent extends { type: "FX"; field: infer F } ? F : never,
      value,
      ts: entry.ts,
    },
  };
}

function parseHeartbeat(entry: LogEntry): ParsedEntry | null {
  // "uptime <N>s" optionally with " · teensy=<state>"
  const m = entry.text.match(/^uptime\s+(\d+)s(?:\s+·\s+teensy=(\w+))?/);
  if (!m) return null;
  const teensy = m[2] as "ok" | "missing" | "busy" | undefined;
  return {
    kind: "tel",
    event: {
      type: "HEARTBEAT",
      uptime_ms: Number(m[1]) * 1000,
      teensy: teensy === "ok" || teensy === "missing" || teensy === "busy" ? teensy : undefined,
      ts: entry.ts,
    },
  };
}
