/**
 * Stage 2 — Tempo and meter (doc §3.3).
 *
 * v1 is user-provided only (autocorrelation was removed — too unreliable on
 * sparse monophonic voice). This stage just exposes the conversion between
 * milliseconds and quarter-note beats given the chosen BPM.
 */

import type { TimeSignature } from "../types";

/** Milliseconds per quarter-note at a given tempo. */
export function beatMs(tempoBpm: number): number {
  return 60000 / tempoBpm;
}

/** Convert an absolute time in ms to quarter-note beats from session start. */
export function msToBeats(ms: number, tempoBpm: number): number {
  return ms / beatMs(tempoBpm);
}

/** Quarter-note beats contained in one measure of the given time signature. */
export function beatsPerMeasure([beats, beatType]: TimeSignature): number {
  // A quarter note is the unit. e.g. 6/8 → 6 * (4/8) = 3 quarter-beats.
  return beats * (4 / beatType);
}
