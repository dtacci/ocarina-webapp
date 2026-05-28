/**
 * Pure-function parser for the Teensy's USB-serial output. One line in, one
 * typed event out (or null for lines that aren't worth surfacing — boot
 * banners, debug noise, etc.). Used by the WebSerial driver to translate the
 * raw byte stream into the same HardwareEvent / TelemetryEvent shapes the
 * Realtime path emits, so /monitor's downstream logic is transport-agnostic.
 *
 * Two firmware dialects in the repo today:
 *   - firmware/main/main.ino: structured "STATUS:<TYPE>:..." lines @ 115200
 *   - firmware/teensy/pitch_detection_v8: loose "NOTE ON: ..." lines @ 9600
 * Both are handled by the same regex sequence below.
 */

import type { HardwareEvent } from "@/hooks/use-hardware-input";
import type { TelemetryEvent } from "@/hooks/use-device-telemetry";
import { NOTE_BUTTONS } from "@/lib/hardware/button-layout";

export type ParsedTeensyEvent =
  | { kind: "hw"; event: HardwareEvent }
  | { kind: "tel"; event: TelemetryEvent };

/** Subset of TelemetryEvent FX field union — kept local to avoid importing the union shape. */
type FxField =
  | "mode"
  | "harmony"
  | "distort"
  | "reverb"
  | "reverb_level"
  | "waveform"
  | "synth_harmony"
  | "synth_harmony_interval"
  | "octave";

const FX_FIELDS: ReadonlySet<FxField> = new Set([
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

/**
 * Parse a single line (without trailing newline) of Teensy serial output.
 * Returns null when the line is unrecognized — callers should treat that as a
 * no-op (not an error).
 */
export function parseTeensyLine(
  raw: string,
  now: () => number = Date.now
): ParsedTeensyEvent | null {
  const line = raw.trim();
  if (!line) return null;
  const ts = now();

  // --- main.ino structured protocol ------------------------------------------
  // STATUS:NOTE:<name>:<hz>[:<confidence>]
  const mNote = line.match(
    /^STATUS:NOTE:([A-G]#?-?\d?):([0-9]+(?:\.[0-9]+)?)(?::([0-9]+(?:\.[0-9]+)?))?$/
  );
  if (mNote) {
    return {
      kind: "tel",
      event: {
        type: "NOTE",
        name: mNote[1],
        hz: Number(mNote[2]),
        confidence: mNote[3] !== undefined ? Number(mNote[3]) : undefined,
        ts,
      },
    };
  }

  // STATUS:HEARTBEAT:<uptime_ms>
  const mHb = line.match(/^STATUS:HEARTBEAT:(\d+)$/);
  if (mHb) {
    return {
      kind: "tel",
      event: { type: "HEARTBEAT", uptime_ms: Number(mHb[1]), teensy: "ok", ts },
    };
  }

  // STATUS:FX:<field>:<value>
  const mFx = line.match(/^STATUS:FX:(\w+):(.+)$/);
  if (mFx && FX_FIELDS.has(mFx[1] as FxField)) {
    return {
      kind: "tel",
      event: {
        type: "FX",
        field: mFx[1] as FxField,
        value: parseFxValue(mFx[2]),
        ts,
      },
    };
  }

  // STATUS:BUTTON:<pin>:<press|release>
  const mBtn = line.match(/^STATUS:BUTTON:(\d+):(press|release|down|up)$/);
  if (mBtn) {
    return {
      kind: "hw",
      event: {
        button: Number(mBtn[1]),
        event: normalizeBtnEvent(mBtn[2]),
        ts,
      },
    };
  }

  // STATUS:ROTARY:<+1|-1>
  const mRot = line.match(/^STATUS:ROTARY:(-?\d+)$/);
  if (mRot) {
    return {
      kind: "hw",
      event: { rotary: Number(mRot[1]), ts },
    };
  }

  // STATUS:BOOT:READY (and other STATUS:BOOT:* signals) — synthetic heartbeat
  // so the console's "awaiting" gate releases as soon as the Teensy enumerates.
  if (line.startsWith("STATUS:BOOT:")) {
    return {
      kind: "tel",
      event: { type: "HEARTBEAT", uptime_ms: 0, teensy: "ok", ts },
    };
  }

  // --- pitch_detection_v8 loose protocol -------------------------------------
  // NOTE ON:  C4 (261.63 Hz)
  const mNoteOn = line.match(
    /^NOTE ON:\s*([A-G]#?-?\d?)\s*\(([0-9]+(?:\.[0-9]+)?)\s*Hz\)$/
  );
  if (mNoteOn) {
    return {
      kind: "tel",
      event: {
        type: "NOTE",
        name: mNoteOn[1],
        hz: Number(mNoteOn[2]),
        ts,
      },
    };
  }

  // NOTE OFF: btn 0  → resolve index → pin via NOTE_BUTTONS order
  const mNoteOff = line.match(/^NOTE OFF:\s+btn\s+(\d+)$/);
  if (mNoteOff) {
    const idx = Number(mNoteOff[1]);
    const def = NOTE_BUTTONS[idx];
    if (def?.pin !== undefined) {
      return {
        kind: "hw",
        event: { button: def.pin, event: "release", ts },
      };
    }
    return null;
  }

  // REVERB: ON / REVERB: OFF
  const mReverb = line.match(/^REVERB:\s*(ON|OFF)$/);
  if (mReverb) {
    return {
      kind: "tel",
      event: { type: "FX", field: "reverb", value: mReverb[1] === "ON", ts },
    };
  }

  // REVERB LEVEL: high (0.8)
  const mReverbLevel = line.match(/^REVERB LEVEL:\s*\w+\s*\(([0-9.]+)\)$/);
  if (mReverbLevel) {
    return {
      kind: "tel",
      event: {
        type: "FX",
        field: "reverb_level",
        value: Number(mReverbLevel[1]),
        ts,
      },
    };
  }

  // WAVEFORM: triangle
  const mWave = line.match(/^WAVEFORM:\s*(\w+)$/);
  if (mWave) {
    return {
      kind: "tel",
      event: { type: "FX", field: "waveform", value: mWave[1], ts },
    };
  }

  // OCTAVE: 4 (shift 0)  → value = the shift number when present, otherwise the octave
  const mOct = line.match(/^OCTAVE:\s*(-?\d+)(?:\s*\(shift\s*(-?\d+)\))?$/);
  if (mOct) {
    const shift = mOct[2] !== undefined ? Number(mOct[2]) : Number(mOct[1]);
    return {
      kind: "tel",
      event: { type: "FX", field: "octave", value: shift, ts },
    };
  }

  // Unrecognized — boot banner, debug noise, PINS dump, etc.
  return null;
}

/**
 * Chunked TextDecoder output → array of complete lines. Stateful: buffers
 * the trailing partial line and returns the rest. Reset it between
 * connection sessions.
 */
export class LineSplitter {
  private buffer = "";

  push(chunk: string): string[] {
    this.buffer += chunk;
    const parts = this.buffer.split(/\r?\n/);
    this.buffer = parts.pop() ?? "";
    return parts;
  }

  reset(): void {
    this.buffer = "";
  }
}

function parseFxValue(raw: string): string | number | boolean {
  const v = raw.trim();
  if (v === "true" || v === "ON") return true;
  if (v === "false" || v === "OFF") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function normalizeBtnEvent(raw: string): "press" | "release" {
  if (raw === "press" || raw === "down") return "press";
  return "release";
}
