/**
 * Stage 5b — MIDI generation (doc §3.6).
 *
 * Reuses the already-installed `@tonejs/midi` (no new dependency). Runs in both
 * Node and browser. MIDI is essentially free given we already have notes, and
 * ships in v1 because sheet-music tooling expects it.
 */

import { Midi } from "@tonejs/midi";
import type { DeriveParams, DerivedNote } from "../types";
import { beatMs } from "./tempo";

export function generateMidi(
  notes: DerivedNote[],
  params: DeriveParams,
): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(params.tempo_bpm);
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [params.time_signature[0], params.time_signature[1]],
  });
  midi.header.update();

  const track = midi.addTrack();
  const secPerBeat = beatMs(params.tempo_bpm) / 1000;

  for (const n of notes) {
    if (n.isRest) continue;
    track.addNote({
      midi: n.midi,
      time: n.startBeats * secPerBeat,
      duration: n.durationBeats * secPerBeat,
    });
  }

  // toArray() returns a Uint8Array; wrap defensively in case of array-likes.
  return new Uint8Array(midi.toArray());
}
