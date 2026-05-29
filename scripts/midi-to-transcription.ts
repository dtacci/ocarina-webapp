/**
 * Import a MIDI file as a transcription session (demo / testing helper).
 *
 *   npx tsx scripts/midi-to-transcription.ts <file.mid>            # inspect tracks
 *   npx tsx scripts/midi-to-transcription.ts <file.mid> <trk> --ingest
 *
 * A MIDI already carries the note timing + pitch the Ocarina device would emit,
 * so it's the most realistic non-hardware input. We extract a single melodic
 * line (v1 is monophonic single-staff), build an .ocrec.jsonl, and run it
 * through the real ingestSession pipeline with the MIDI's tempo/meter.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { Midi } from "@tonejs/midi";
import { createClient } from "@supabase/supabase-js";
import { ingestSession } from "@/lib/transcription/ingest";
import type { OcarinaEvent, OcarinaHeader } from "@/lib/transcription/types";

const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: midi-to-transcription.ts <file.mid> [trackIndex|auto] [--ingest]");
    process.exit(1);
  }
  const doIngest = process.argv.includes("--ingest");
  const trackArg = process.argv[3] && process.argv[3] !== "--ingest" ? process.argv[3] : "auto";

  const midi = new Midi(readFileSync(path));
  const bpm = Math.round(midi.header.tempos[0]?.bpm ?? 120);
  const tsRaw = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  const timeSig: [number, number] = [tsRaw[0], tsRaw[1]];

  // Track summary.
  console.log(`\n${basename(path)} — tempo ${bpm} BPM, ${timeSig.join("/")}`);
  midi.tracks.forEach((t, i) => {
    if (!t.notes.length) return;
    const pitches = t.notes.map((n) => n.midi);
    const avg = pitches.reduce((s, p) => s + p, 0) / pitches.length;
    console.log(
      `  #${i} "${t.name || t.instrument.name}" ch${t.channel} notes=${t.notes.length} ` +
        `avgPitch=${avg.toFixed(0)} range=${Math.min(...pitches)}-${Math.max(...pitches)}`,
    );
  });
  if (!doIngest) {
    console.log("\n(inspect only — pass a track index and --ingest to import)");
    return;
  }

  // Choose the melody track: explicit index, else the non-drum track with the
  // most notes (lead/vocal lines tend to be the densest single-instrument track).
  let idx: number;
  if (trackArg !== "auto") {
    idx = parseInt(trackArg, 10);
  } else {
    let best = -1;
    let bestCount = -1;
    midi.tracks.forEach((t, i) => {
      if (t.channel === 9) return; // skip percussion
      if (t.notes.length > bestCount) {
        bestCount = t.notes.length;
        best = i;
      }
    });
    idx = best;
  }
  const track = midi.tracks[idx];
  console.log(`\nUsing track #${idx} "${track.name || track.instrument.name}" (${track.notes.length} notes)`);

  // Monophonic reduction: at simultaneous onsets keep the highest pitch (melody
  // rides on top); clamp each note's end to the next onset so voices don't
  // overlap, while preserving genuine gaps (which become rests).
  const sorted = [...track.notes].sort((a, b) => a.time - b.time || b.midi - a.midi);
  const mono: typeof sorted = [];
  for (const n of sorted) {
    const last = mono[mono.length - 1];
    if (last && Math.abs(n.time - last.time) < 1e-3) continue; // same onset → keep higher
    mono.push(n);
  }

  const events: OcarinaEvent[] = [{ type: "session_start", t_ms: 0 }];
  for (let i = 0; i < mono.length; i++) {
    const n = mono[i];
    const next = mono[i + 1];
    const startMs = Math.round(n.time * 1000);
    let endMs = Math.round((n.time + n.duration) * 1000);
    if (next) endMs = Math.min(endMs, Math.round(next.time * 1000));
    if (endMs <= startMs) endMs = startMs + 30;
    events.push({
      type: "note_on",
      t_ms: startMs,
      midi: n.midi,
      vel: Math.round(n.velocity * 127),
      hz_raw: Math.round(midiToHz(n.midi) * 100) / 100,
      conf: 0.95,
    });
    events.push({ type: "note_off", t_ms: endMs, midi: n.midi });
  }
  const lastMs = events.reduce((m, e) => ("t_ms" in e ? Math.max(m, e.t_ms) : m), 0);
  events.push({ type: "session_end", t_ms: lastMs });

  const header: OcarinaHeader = {
    type: "header",
    format_version: 1,
    firmware_version: "midi-import",
    device_id: "oca_midi_import",
    session_uuid: `midi-${basename(path)}`,
    wall_clock_iso: "2026-05-29T00:00:00.000Z",
    detector_latency_ms: 0, // MIDI timing is exact — no detector lag to undo
  };
  const jsonl = [JSON.stringify(header), ...events.map((e) => JSON.stringify(e))].join("\n") + "\n";

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  const userId = list.users[0].id;
  const title = (track.name || basename(path)).replace(/\.midi?$/i, "");

  const result = await ingestSession(jsonl, {
    userId,
    title: `${title} (MIDI import)`,
    params: { tempo_bpm: bpm, time_signature: timeSig },
  });
  console.log("ingested →", result);
  console.log(`\n✓ View at /transcriptions/${result.recordingId}`);
}

main();
