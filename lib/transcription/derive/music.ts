/**
 * Small, dependency-free music-theory helpers shared by key detection and the
 * MusicXML emitter. Kept pure so the whole derivation runs in Node and browser.
 */

export interface Spelling {
  /** Diatonic letter: C D E F G A B. */
  step: string;
  /** Chromatic alteration: -1 flat, 0 natural, 1 sharp. */
  alter: number;
  /** Scientific octave (MIDI 60 = C4). */
  octave: number;
}

const SHARP_TABLE: Array<{ step: string; alter: number }> = [
  { step: "C", alter: 0 }, // 0
  { step: "C", alter: 1 }, // 1  C#
  { step: "D", alter: 0 }, // 2
  { step: "D", alter: 1 }, // 3  D#
  { step: "E", alter: 0 }, // 4
  { step: "F", alter: 0 }, // 5
  { step: "F", alter: 1 }, // 6  F#
  { step: "G", alter: 0 }, // 7
  { step: "G", alter: 1 }, // 8  G#
  { step: "A", alter: 0 }, // 9
  { step: "A", alter: 1 }, // 10 A#
  { step: "B", alter: 0 }, // 11
];

const FLAT_TABLE: Array<{ step: string; alter: number }> = [
  { step: "C", alter: 0 }, // 0
  { step: "D", alter: -1 }, // 1  Db
  { step: "D", alter: 0 }, // 2
  { step: "E", alter: -1 }, // 3  Eb
  { step: "E", alter: 0 }, // 4
  { step: "F", alter: 0 }, // 5
  { step: "G", alter: -1 }, // 6  Gb
  { step: "G", alter: 0 }, // 7
  { step: "A", alter: -1 }, // 8  Ab
  { step: "A", alter: 0 }, // 9
  { step: "B", alter: -1 }, // 10 Bb
  { step: "B", alter: 0 }, // 11
];

const PITCH_CLASS_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/** "C", "C#", ... for a MIDI pitch class (0–11). */
export function pitchClassName(midi: number): string {
  return PITCH_CLASS_NAMES[((midi % 12) + 12) % 12];
}

/**
 * Number of sharps (positive) or flats (negative) in a major/minor key.
 * Used both for the MusicXML <fifths> element and to pick a spelling table.
 */
const MAJOR_FIFTHS: Record<string, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  "F#": 6,
  "C#": 7,
  F: -1,
  Bb: -2,
  Eb: -3,
  Ab: -4,
  Db: -5,
  Gb: -6,
  Cb: -7,
};

// Minor keys share the fifths of their relative major (tonic + 3 semitones).
const MINOR_FIFTHS: Record<string, number> = {
  A: 0,
  E: 1,
  B: 2,
  "F#": 3,
  "C#": 4,
  "G#": 5,
  "D#": 6,
  "A#": 7,
  D: -1,
  G: -2,
  C: -3,
  F: -4,
  Bb: -5,
  Eb: -6,
  Ab: -7,
};

export interface ParsedKey {
  tonic: string;
  mode: "major" | "minor";
  fifths: number;
}

/** Parse "C major" / "F# minor" → tonic, mode, and the key-signature fifths. */
export function parseKeyName(key: string): ParsedKey | null {
  const m = key.trim().match(/^([A-G][#b]?)\s+(major|minor)$/i);
  if (!m) return null;
  const tonic = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  const mode = m[2].toLowerCase() as "major" | "minor";
  const table = mode === "major" ? MAJOR_FIFTHS : MINOR_FIFTHS;
  const fifths = table[tonic];
  if (fifths === undefined) return null;
  return { tonic, mode, fifths };
}

/**
 * Spell a MIDI note for notation, choosing sharps or flats based on the key's
 * fifths (>= 0 → sharps, < 0 → flats). Non-diatonic notes follow the same
 * spelling convention — adequate for v1 (doc §3.5).
 */
export function spellMidi(midi: number, fifths: number): Spelling {
  const pc = ((midi % 12) + 12) % 12;
  const table = fifths >= 0 ? SHARP_TABLE : FLAT_TABLE;
  const { step, alter } = table[pc];
  // Octave from C: MIDI 60 = C4. Flat spellings that name the note with a
  // higher letter (e.g. Cb) don't occur in these tables, so a simple floor works.
  const octave = Math.floor(midi / 12) - 1;
  return { step, alter, octave };
}

/**
 * The alteration the key signature already implies for a given step, so the
 * emitter knows when an explicit <accidental> is needed.
 */
export function keyAlterForStep(step: string, fifths: number): number {
  // Order sharps are added: F C G D A E B. Flats: B E A D G C F.
  const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
  const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
  if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(step) ? 1 : 0;
  if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(step) ? -1 : 0;
  return 0;
}
