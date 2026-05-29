/**
 * A small library of songs for the fake event generator (doc §7.1/§7.2).
 * These double as demo seeds (ingest by name) and golden-fixture inputs.
 */

import type { SongSpec } from "./fake-events";

const twinkleNotes = [
  { pitch: "C4", beats: 1 },
  { pitch: "C4", beats: 1 },
  { pitch: "G4", beats: 1 },
  { pitch: "G4", beats: 1 },
  { pitch: "A4", beats: 1 },
  { pitch: "A4", beats: 1 },
  { pitch: "G4", beats: 2 },
  { pitch: "F4", beats: 1 },
  { pitch: "F4", beats: 1 },
  { pitch: "E4", beats: 1 },
  { pitch: "E4", beats: 1 },
  { pitch: "D4", beats: 1 },
  { pitch: "D4", beats: 1 },
  { pitch: "C4", beats: 2 },
];

export const SONGS: Record<string, SongSpec> = {
  twinkle: {
    name: "Twinkle Twinkle Little Star",
    bpm: 120,
    timeSignature: [4, 4],
    notes: twinkleNotes,
  },

  "twinkle-wobble": {
    name: "Twinkle (with vibrato)",
    bpm: 120,
    timeSignature: [4, 4],
    notes: twinkleNotes,
    options: { pitchWobbleCents: 25, onsetJitterMs: 18 },
  },

  mary: {
    name: "Mary Had a Little Lamb",
    bpm: 100,
    timeSignature: [4, 4],
    notes: [
      { pitch: "E4", beats: 1 },
      { pitch: "D4", beats: 1 },
      { pitch: "C4", beats: 1 },
      { pitch: "D4", beats: 1 },
      { pitch: "E4", beats: 1 },
      { pitch: "E4", beats: 1 },
      { pitch: "E4", beats: 2 },
      { pitch: "D4", beats: 1 },
      { pitch: "D4", beats: 1 },
      { pitch: "D4", beats: 2 },
      { pitch: "E4", beats: 1 },
      { pitch: "G4", beats: 1 },
      { pitch: "G4", beats: 2 },
    ],
  },

  waltz: {
    name: "Waltz Fragment (3/4)",
    bpm: 150,
    timeSignature: [3, 4],
    notes: [
      { pitch: "G4", beats: 1 },
      { pitch: "B4", beats: 1 },
      { pitch: "D5", beats: 1 },
      { pitch: "C5", beats: 2 },
      { pitch: "B4", beats: 1 },
      { pitch: "A4", beats: 3 },
    ],
  },

  jig: {
    name: "Jig Fragment (6/8)",
    bpm: 120,
    timeSignature: [6, 8],
    notes: [
      { pitch: "D4", beats: 0.5 },
      { pitch: "E4", beats: 0.5 },
      { pitch: "F#4", beats: 0.5 },
      { pitch: "G4", beats: 0.5 },
      { pitch: "A4", beats: 0.5 },
      { pitch: "B4", beats: 0.5 },
      { pitch: "A4", beats: 1.5 },
    ],
  },

  "held-note": {
    name: "One Long Note",
    bpm: 120,
    timeSignature: [4, 4],
    notes: [{ pitch: "A4", beats: 16 }],
  },

  gliss: {
    name: "Glissando Phrase",
    bpm: 110,
    timeSignature: [4, 4],
    notes: [
      { pitch: "C4", beats: 1 },
      { pitch: "G4", beats: 2 },
      { pitch: "E4", beats: 1 },
    ],
    options: { glissBetweenIndices: [1] },
  },
};

export function getSong(name: string): SongSpec | undefined {
  return SONGS[name];
}

export const SONG_NAMES = Object.keys(SONGS);
