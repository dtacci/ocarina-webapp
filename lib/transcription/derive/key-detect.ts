/**
 * Stage 4 — Key signature detection (doc §3.5).
 *
 * Krumhansl-Schmuckler: build a duration-weighted pitch-class histogram, then
 * correlate it against the 24 major/minor key profiles. We surface the top
 * candidates as *hints* — K-S is mediocre on monophonic input, so the UI always
 * lets the user override (doc §3.5).
 */

import type { DerivedNote, KeyCandidate } from "../types";

// Krumhansl-Kessler probe-tone profiles.
const MAJOR_PROFILE = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];
const MINOR_PROFILE = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

// Canonical key names per pitch class — all chosen to exist in the fifths
// tables in music.ts (so they round-trip through parseKeyName).
const MAJOR_NAMES = [
  "C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B",
];
const MINOR_NAMES = [
  "C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B",
];

function pitchHistogram(notes: DerivedNote[]): number[] {
  const hist = new Array(12).fill(0);
  for (const n of notes) {
    if (n.isRest) continue;
    hist[((n.midi % 12) + 12) % 12] += n.durationBeats;
  }
  return hist;
}

/** Pearson correlation between two equal-length vectors. */
function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : num / denom;
}

/** Rotate a profile so degree 0 sits at pitch class `tonic`. */
function rotated(profile: number[], tonic: number): number[] {
  return profile.map((_, pc) => profile[((pc - tonic) % 12 + 12) % 12]);
}

/**
 * Return all 24 keys ranked best-first. Empty if there are no pitched notes.
 */
export function detectKey(notes: DerivedNote[]): KeyCandidate[] {
  const hist = pitchHistogram(notes);
  if (hist.every((v) => v === 0)) return [];

  const candidates: KeyCandidate[] = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    candidates.push({
      key: `${MAJOR_NAMES[tonic]} major`,
      score: pearson(hist, rotated(MAJOR_PROFILE, tonic)),
    });
    candidates.push({
      key: `${MINOR_NAMES[tonic]} minor`,
      score: pearson(hist, rotated(MINOR_PROFILE, tonic)),
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}
