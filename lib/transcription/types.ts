/**
 * Shared types for the Ocarina → Sheet Music transcription pipeline.
 *
 * Two layers, kept deliberately separate (see plan §2 / doc §2):
 *  - Raw events (`Ocarina*Event`): lossless capture of what the device emitted.
 *    Never mutated after capture.
 *  - Derived structure (`DerivedNote`, `DeriveResult`): notes as a musician thinks
 *    of them, produced by applying an *interpretation* (tempo/meter/key) to the
 *    raw events. Cheap to recompute; never destroys the raw events.
 *
 * Everything here is pure data — no Node- or browser-only imports — so the same
 * code runs server-side (ingest) and client-side (live edits).
 */

// ---------------------------------------------------------------------------
// Raw event stream (doc §2.1)
// ---------------------------------------------------------------------------

/** First line of every `.ocrec.jsonl` file. */
export interface OcarinaHeader {
  type: "header";
  format_version: number;
  firmware_version: string;
  device_id: string;
  session_uuid: string;
  /** Wall-clock at session start, ISO-8601 UTC. */
  wall_clock_iso: string;
  /**
   * Per-device calibration constant: typical delay between voice onset and the
   * pitch detector reporting confidence. Used by derive stage 0 to shift onsets
   * back before quantization.
   */
  detector_latency_ms: number;
}

export interface SessionStartEvent {
  type: "session_start";
  t_ms: number;
  kit_id?: string;
}

export interface SessionEndEvent {
  type: "session_end";
  t_ms: number;
}

export interface NoteOnEvent {
  type: "note_on";
  t_ms: number;
  midi: number;
  /** Velocity 0–127. */
  vel: number;
  /** Raw detected frequency in Hz. */
  hz_raw: number;
  /** Detector confidence 0–1. */
  conf: number;
  kit_slot?: number;
}

export interface NoteOffEvent {
  type: "note_off";
  t_ms: number;
  /** MIDI note included so overlapping voices stay disambiguated. */
  midi: number;
}

export interface PitchBendEvent {
  type: "pitch_bend";
  t_ms: number;
  hz_raw: number;
  /** Cents deviation from the nominal MIDI pitch. */
  cents: number;
}

export interface KitChangeEvent {
  type: "kit_change";
  t_ms: number;
  kit_id: string;
}

export interface ConfigChangeEvent {
  type: "config_change";
  t_ms: number;
  key: string;
  value: unknown;
}

export interface MarkerEvent {
  type: "marker";
  t_ms: number;
  label?: string;
}

export type OcarinaEvent =
  | SessionStartEvent
  | SessionEndEvent
  | NoteOnEvent
  | NoteOffEvent
  | PitchBendEvent
  | KitChangeEvent
  | ConfigChangeEvent
  | MarkerEvent;

/** Result of parsing a `.ocrec.jsonl` stream (see parse-jsonl.ts). */
export interface ParsedSession {
  header: OcarinaHeader;
  events: OcarinaEvent[];
  /** Number of lines that failed to parse as JSON (skipped). */
  badLineCount: number;
  /** True if the file lacked a clean `session_end` (truncation / power loss). */
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// Derivation parameters (doc §3)
// ---------------------------------------------------------------------------

export type QuantizeGrid = "1/4" | "1/8" | "1/16" | "1/8t" | "1/16t";
export type RestsVsTies = "rests" | "ties";

/** A time signature as [beats, beatType], e.g. [3, 4] for 3/4, [6, 8] for 6/8. */
export type TimeSignature = [number, number];

export interface DeriveParams {
  tempo_bpm: number;
  time_signature: TimeSignature;
  /** A key name like "C major" / "F# minor", or "auto" to detect. */
  key_signature: string;
  quantize_grid: QuantizeGrid;
  /** Fraction of a grid cell within which an onset snaps to it (default 0.5). */
  snap_threshold: number;
  /** Notes shorter than this (ms) are treated as artifacts (default 60). */
  min_note_ms: number;
  rests_vs_ties: RestsVsTies;
  /** Semitones to shift every pitch (e.g. fix a wrong-octave performance). */
  transpose: number;
}

/** Sensible defaults applied to a fresh session's first ("default") render. */
export const DEFAULT_PARAMS: DeriveParams = {
  tempo_bpm: 120,
  time_signature: [4, 4],
  key_signature: "auto",
  quantize_grid: "1/16",
  snap_threshold: 0.5,
  min_note_ms: 60,
  rests_vs_ties: "rests",
  transpose: 0,
};

// ---------------------------------------------------------------------------
// Derived structure
// ---------------------------------------------------------------------------

/**
 * A note after assembly + quantization, expressed in musical units.
 * `startBeats` / `durationBeats` are in quarter-note beats from session start.
 */
export interface DerivedNote {
  /** MIDI note number; ignored when `isRest` is true. */
  midi: number;
  isRest: boolean;
  startBeats: number;
  durationBeats: number;
  /** Original (pre-quantize) timing, kept for debugging / future variable tempo. */
  rawStartMs: number;
  rawEndMs: number;
  /** Pitch swung > a semitone within the note (render as glissando). */
  hasPitchBend?: boolean;
}

/** Long sessions split into chapters at the longest silences (doc §4.3). */
export interface Chapter {
  index: number;
  startBeats: number;
  endBeats: number;
}

export interface KeyCandidate {
  /** e.g. "C major", "A minor". */
  key: string;
  /** Krumhansl-Schmuckler correlation score. */
  score: number;
}

export type WarningKind =
  | "tempo_guessed"
  | "short_notes_filtered"
  | "pitch_bend_slides"
  | "key_ambiguous"
  | "kit_change"
  | "missing_latency_calibration"
  | "long_session_chaptered"
  | "low_confidence_dropped"
  | "truncated_file"
  | "corrupt_lines";

export interface Warning {
  kind: WarningKind;
  /** User-facing, friendly message (doc §3.7 — these are starting points, not errors). */
  message: string;
}

export interface DeriveResult {
  notes: DerivedNote[];
  chapters: Chapter[];
  musicxml: string;
  /** Standard MIDI file bytes. */
  midi: Uint8Array;
  /** Detected key candidates, best first. Empty when the user pinned a key. */
  keyCandidates: KeyCandidate[];
  warnings: Warning[];
}
