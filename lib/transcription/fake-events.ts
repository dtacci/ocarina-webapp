/**
 * Fake event generator (doc §7.2).
 *
 * Produces plausible `.ocrec.jsonl` streams from a high-level song description.
 * This is the engine of Phase 1: it unblocks the whole pipeline (derivation,
 * OSMD rendering, UX) with zero hardware, and is also the input to the golden
 * fixtures (§7.1).
 *
 * Output is deterministic: a seeded PRNG (seeded from the song name) means
 * "realistic" jitter/wobble is reproducible, so fixtures are stable.
 */

import { gzipSync } from "fflate";
import type {
  OcarinaEvent,
  OcarinaHeader,
  TimeSignature,
} from "./types";
import { DEFAULT_LATENCY_MS } from "./derive/latency";

export interface SongNote {
  /** Note name like "C4" / "F#5", or a raw MIDI number. */
  pitch: string | number;
  /** Duration in quarter-note beats. */
  beats: number;
  rest?: boolean;
}

export interface SongOptions {
  pitchWobbleCents?: number;
  onsetJitterMs?: number;
  detectorLatencyMs?: number;
  /** Fraction (0–1) of notes given a below-threshold confidence. */
  confidenceFloor?: number;
  /** Indices (into `notes`) that should carry a slide-grade pitch bend. */
  glissBetweenIndices?: number[];
  /** Number of spurious sub-60ms artifact notes to sprinkle in. */
  shortArtifacts?: number;
  /** Drop `session_end` and leave a partial trailing line (truncation test). */
  truncate?: boolean;
  /** Inject this many non-JSON corrupt lines. */
  corruptLines?: number;
  /** Emit a kit_change at this beat. */
  kitChangeAtBeat?: number;
}

export interface SongSpec {
  name: string;
  bpm: number;
  timeSignature: TimeSignature;
  notes: SongNote[];
  options?: SongOptions;
}

const PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** "C4", "F#5", "Bb3" → MIDI number (C4 = 60). */
export function noteNameToMidi(name: string): number {
  const m = name.trim().match(/^([A-G])([#b]?)(-?\d+)$/);
  if (!m) throw new Error(`Bad note name: ${name}`);
  const base = PC[m[1].toUpperCase()];
  const accidental = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  const octave = parseInt(m[3], 10);
  return (octave + 1) * 12 + base + accidental;
}

function toMidi(pitch: string | number): number {
  return typeof pitch === "number" ? pitch : noteNameToMidi(pitch);
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Deterministic PRNG (mulberry32). */
function makeRng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build the array of JSONL lines for a song (header first). Exposed separately
 * so tests can inspect structure; `generateOcrec` joins them.
 */
export function buildOcrecLines(spec: SongSpec): string[] {
  const opts = spec.options ?? {};
  const latency = opts.detectorLatencyMs ?? DEFAULT_LATENCY_MS;
  const beatMs = 60000 / spec.bpm;
  const rng = makeRng(spec.name);
  const jitter = () => (opts.onsetJitterMs ? (rng() - 0.5) * 2 * opts.onsetJitterMs : 0);

  const header: OcarinaHeader = {
    type: "header",
    format_version: 1,
    firmware_version: "0.4.2",
    device_id: "oca_fake_0001",
    session_uuid: `fake-${spec.name.replace(/\s+/g, "-").toLowerCase()}`,
    wall_clock_iso: "2026-05-28T00:00:00.000Z",
    detector_latency_ms: latency,
  };

  const events: OcarinaEvent[] = [{ type: "session_start", t_ms: 0 }];
  const gliss = new Set(opts.glissBetweenIndices ?? []);
  let cursorMs = 0;

  spec.notes.forEach((note, idx) => {
    const durMs = note.beats * beatMs;
    if (note.rest) {
      cursorMs += durMs;
      return;
    }
    const midi = toMidi(note.pitch);
    // Real device timestamps lag true onset by the detector latency; stage 0
    // undoes this. Onset jitter humanizes timing pre-quantization.
    const onset = Math.max(0, cursorMs + jitter()) + latency;
    const conf =
      opts.confidenceFloor && rng() < opts.confidenceFloor ? 0.3 : 0.95;
    events.push({
      type: "note_on",
      t_ms: Math.round(onset),
      midi,
      vel: 90,
      hz_raw: Math.round(midiToHz(midi) * 100) / 100,
      conf,
    });

    // Pitch wobble (sub-slide) or an explicit slide for flagged notes.
    if (opts.pitchWobbleCents || gliss.has(idx)) {
      const cents = gliss.has(idx) ? 180 : opts.pitchWobbleCents ?? 0;
      events.push({
        type: "pitch_bend",
        t_ms: Math.round(onset + durMs / 2),
        hz_raw: Math.round(midiToHz(midi) * 100) / 100,
        cents,
      });
    }

    // Release the note slightly early so repeated same-pitch notes stay distinct.
    // A small *fixed* gap (50ms) clears the 30ms same-pitch merge threshold while
    // staying short enough that quantization still recovers the intended duration
    // (a percentage-based gap would break snapping on long notes).
    const releaseGap = Math.min(50, durMs / 2);
    const off = onset + (durMs - releaseGap);
    events.push({ type: "note_off", t_ms: Math.round(off), midi });
    cursorMs += durMs;
  });

  if (opts.kitChangeAtBeat !== undefined) {
    events.push({
      type: "kit_change",
      t_ms: Math.round(opts.kitChangeAtBeat * beatMs) + latency,
      kit_id: "kit_strings",
    });
  }

  // Short artifact notes (sub-min_note_ms) to exercise filtering.
  for (let i = 0; i < (opts.shortArtifacts ?? 0); i++) {
    const at = Math.round(rng() * cursorMs) + latency;
    const midi = 60 + Math.floor(rng() * 12);
    events.push({ type: "note_on", t_ms: at, midi, vel: 70, hz_raw: midiToHz(midi), conf: 0.9 });
    events.push({ type: "note_off", t_ms: at + 25, midi });
  }

  // Keep events ordered by time (artifacts/kit-change were appended).
  events.sort((a, b) => ("t_ms" in a ? a.t_ms : 0) - ("t_ms" in b ? b.t_ms : 0));

  if (!opts.truncate) {
    events.push({ type: "session_end", t_ms: Math.round(cursorMs) + latency });
  }

  const lines = [JSON.stringify(header), ...events.map((e) => JSON.stringify(e))];

  // Inject corrupt (non-JSON) lines at deterministic positions.
  for (let i = 0; i < (opts.corruptLines ?? 0); i++) {
    const pos = 1 + Math.floor(rng() * (lines.length - 1));
    lines.splice(pos, 0, `<<corrupt garbage line ${i}>>`);
  }

  // Truncation leaves a partial trailing JSON fragment.
  if (opts.truncate) {
    lines.push('{"type":"note_on","t_ms":99999,"mi');
  }

  return lines;
}

export function generateOcrec(spec: SongSpec): string {
  return buildOcrecLines(spec).join("\n") + "\n";
}

export function generateOcrecGzip(spec: SongSpec): Uint8Array {
  return gzipSync(new TextEncoder().encode(generateOcrec(spec)));
}
