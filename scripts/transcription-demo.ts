/**
 * Smoke-test / demo for the transcription pipeline (doc §12 Phase 1, PR1).
 *
 *   npx tsx scripts/transcription-demo.ts [songName]
 *
 * Generates a fake .ocrec.jsonl for a song, runs the full derivation, and prints
 * the MusicXML, warnings, and a note summary. No device, no DB, no UI.
 */

import { generateOcrec } from "@/lib/transcription/fake-events";
import { parseOcrec } from "@/lib/transcription/parse-jsonl";
import { derive } from "@/lib/transcription/derive";
import { DEFAULT_PARAMS } from "@/lib/transcription/types";
import { getSong, SONG_NAMES } from "@/lib/transcription/songs";

const songName = process.argv[2] ?? "twinkle";
const song = getSong(songName);
if (!song) {
  console.error(`Unknown song "${songName}". Available: ${SONG_NAMES.join(", ")}`);
  process.exit(1);
}

const jsonl = generateOcrec(song);
const { header, events, badLineCount, truncated } = parseOcrec(jsonl);

const params = {
  ...DEFAULT_PARAMS,
  tempo_bpm: song.bpm,
  time_signature: song.timeSignature,
};

const result = derive(events, header, params, { title: song.name, tempoGuessed: false });

console.log(`\n=== ${song.name} ===`);
console.log(`events: ${events.length}  badLines: ${badLineCount}  truncated: ${truncated}`);
console.log(`notes (incl. rests): ${result.notes.length}`);
console.log(`key candidates: ${result.keyCandidates.slice(0, 3).map((c) => `${c.key} (${c.score.toFixed(2)})`).join(", ")}`);
console.log(`MIDI bytes: ${result.midi.length}`);
console.log(`warnings:`);
for (const w of result.warnings) console.log(`  - [${w.kind}] ${w.message}`);
console.log(`\n--- MusicXML ---\n`);
console.log(result.musicxml);
