/**
 * Golden fixture suite for the derivation pipeline (doc §7.1).
 *
 * Assertions are structural (note counts, pitches, durations, measures,
 * warnings) computed independently of the emitter — not snapshots of its own
 * output — so a regression in derivation fails the build for a real reason.
 *
 * Run: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateOcrec, noteNameToMidi } from "./fake-events";
import { parseOcrec } from "./parse-jsonl";
import { derive } from "./derive";
import {
  DEFAULT_PARAMS,
  type DeriveParams,
  type DerivedNote,
  type OcarinaEvent,
  type OcarinaHeader,
} from "./types";
import { getSong } from "./songs";

function deriveSong(name: string, overrides: Partial<DeriveParams> = {}) {
  const song = getSong(name)!;
  const { header, events, badLineCount, truncated } = parseOcrec(generateOcrec(song));
  const params: DeriveParams = {
    ...DEFAULT_PARAMS,
    tempo_bpm: song.bpm,
    time_signature: song.timeSignature,
    ...overrides,
  };
  return { result: derive(events, header, params), badLineCount, truncated, params };
}

/** Pitched (non-rest) notes only. */
function pitched(notes: DerivedNote[]) {
  return notes.filter((n) => !n.isRest);
}

function warningKinds(result: { warnings: { kind: string }[] }) {
  return result.warnings.map((w) => w.kind);
}

test("twinkle: 14 clean quarter/half notes, no rests, in C major", () => {
  const { result } = deriveSong("twinkle");
  const notes = pitched(result.notes);
  assert.equal(result.notes.length, 14, "no rests inserted for contiguous melody");
  assert.equal(notes.length, 14);

  // First six are quarter notes (1 beat), then a half note (2 beats).
  const expectedMidi = ["C4", "C4", "G4", "G4", "A4", "A4", "G4"].map(noteNameToMidi);
  for (let i = 0; i < 7; i++) assert.equal(notes[i].midi, expectedMidi[i]);
  for (let i = 0; i < 6; i++) assert.equal(notes[i].durationBeats, 1, `note ${i} is a quarter`);
  assert.equal(notes[6].durationBeats, 2, "the 7th note is a half");

  assert.equal(result.keyCandidates[0].key, "C major");
});

test("mary: 13 notes laid out correctly", () => {
  const { result } = deriveSong("mary");
  assert.equal(pitched(result.notes).length, 13);
  // Total duration is 16 quarter-beats (four 4/4 measures).
  const total = result.notes.reduce((s, n) => s + n.durationBeats, 0);
  assert.equal(total, 16);
});

test("waltz: 3/4 — every measure holds 3 quarter-beats", () => {
  const { result } = deriveSong("waltz");
  const total = result.notes.reduce((s, n) => s + n.durationBeats, 0);
  // 1+1+1 + 2+1 + 3 = 9 beats = three 3/4 measures.
  assert.equal(total, 9);
  assert.match(result.musicxml, /<beats>3<\/beats><beat-type>4<\/beat-type>/);
});

test("jig: 6/8 — eighth notes and a key with F#", () => {
  const { result } = deriveSong("jig");
  assert.match(result.musicxml, /<beats>6<\/beats><beat-type>8<\/beat-type>/);
  // First note is an eighth (0.5 quarter-beats).
  assert.equal(pitched(result.notes)[0].durationBeats, 0.5);
});

test("held note: one 16-beat note becomes whole notes tied across 4 measures", () => {
  const { result } = deriveSong("held-note");
  assert.equal(pitched(result.notes).length, 1);
  assert.equal(pitched(result.notes)[0].durationBeats, 16);
  // Four whole notes, tied start→stop across the barlines.
  const wholeCount = (result.musicxml.match(/<type>whole<\/type>/g) ?? []).length;
  assert.equal(wholeCount, 4);
  assert.match(result.musicxml, /<tied type="start"\/>/);
  assert.match(result.musicxml, /<tied type="stop"\/>/);
});

test("gliss: a slide is detected and surfaced as a warning", () => {
  const { result } = deriveSong("gliss");
  assert.ok(warningKinds(result).includes("pitch_bend_slides"));
});

test("gliss: MusicXML emits balanced, paired glissando start/stop", () => {
  const { result } = deriveSong("gliss");
  const starts = (result.musicxml.match(/<glissando type="start"/g) ?? []).length;
  const stops = (result.musicxml.match(/<glissando type="stop"/g) ?? []).length;
  assert.ok(starts >= 1, "at least one glissando start");
  assert.equal(starts, stops, "every glissando start has a matching stop");
});

test("truncated file parses without throwing and still derives notes", () => {
  const song = getSong("twinkle")!;
  const jsonl = generateOcrec({ ...song, options: { truncate: true } });
  const parsed = parseOcrec(jsonl);
  assert.equal(parsed.truncated, true);
  const result = derive(parsed.events, parsed.header, {
    ...DEFAULT_PARAMS,
    tempo_bpm: song.bpm,
  });
  assert.ok(pitched(result.notes).length > 0);
});

test("corrupt lines are skipped and counted, derivation still works", () => {
  const song = getSong("twinkle")!;
  const jsonl = generateOcrec({ ...song, options: { corruptLines: 3 } });
  const parsed = parseOcrec(jsonl);
  assert.equal(parsed.badLineCount, 3);
  const result = derive(parsed.events, parsed.header, {
    ...DEFAULT_PARAMS,
    tempo_bpm: song.bpm,
  });
  assert.equal(pitched(result.notes).length, 14);
});

test("short artifacts are filtered with a warning", () => {
  const song = getSong("twinkle")!;
  const jsonl = generateOcrec({ ...song, options: { shortArtifacts: 5 } });
  const parsed = parseOcrec(jsonl);
  const result = derive(parsed.events, parsed.header, {
    ...DEFAULT_PARAMS,
    tempo_bpm: song.bpm,
  });
  assert.ok(warningKinds(result).includes("short_notes_filtered"));
  // The real 14 notes survive; the 5 artifacts are dropped.
  assert.equal(pitched(result.notes).length, 14);
});

test("low-confidence notes are dropped with a warning", () => {
  const song = getSong("twinkle")!;
  const jsonl = generateOcrec({ ...song, options: { confidenceFloor: 1 } });
  const parsed = parseOcrec(jsonl);
  const result = derive(parsed.events, parsed.header, {
    ...DEFAULT_PARAMS,
    tempo_bpm: song.bpm,
  });
  assert.ok(warningKinds(result).includes("low_confidence_dropped"));
});

test("missing latency calibration warns and uses the default", () => {
  const song = getSong("twinkle")!;
  const parsed = parseOcrec(generateOcrec(song));
  // Strip the calibration from the header.
  const header = { ...parsed.header, detector_latency_ms: NaN };
  const result = derive(parsed.events, header, {
    ...DEFAULT_PARAMS,
    tempo_bpm: song.bpm,
  });
  assert.ok(warningKinds(result).includes("missing_latency_calibration"));
});

test("transpose shifts every pitch by the given semitones", () => {
  const base = deriveSong("twinkle");
  const up = deriveSong("twinkle", { transpose: 12 });
  const basePitched = pitched(base.result.notes);
  const upPitched = pitched(up.result.notes);
  assert.equal(basePitched.length, upPitched.length);
  for (let i = 0; i < basePitched.length; i++) {
    assert.equal(upPitched[i].midi, basePitched[i].midi + 12);
  }
});

test("user-pinned key overrides detection (no candidates returned)", () => {
  const { result } = deriveSong("twinkle", { key_signature: "G major" });
  assert.equal(result.keyCandidates.length, 0);
  assert.match(result.musicxml, /<fifths>1<\/fifths>/);
});

test("confidence is carried onto notes; low-confidence notes render faint", () => {
  const header: OcarinaHeader = {
    type: "header",
    format_version: 1,
    firmware_version: "t",
    device_id: "d",
    session_uuid: "s",
    wall_clock_iso: "2026-01-01T00:00:00.000Z",
    detector_latency_ms: 0,
  };
  const events: OcarinaEvent[] = [
    { type: "session_start", t_ms: 0 },
    { type: "note_on", t_ms: 0, midi: 60, vel: 90, hz_raw: 261.63, conf: 0.6 },
    { type: "note_off", t_ms: 480, midi: 60 },
    { type: "note_on", t_ms: 500, midi: 62, vel: 90, hz_raw: 293.66, conf: 0.95 },
    { type: "note_off", t_ms: 980, midi: 62 },
    { type: "session_end", t_ms: 1000 },
  ];
  const result = derive(events, header, { ...DEFAULT_PARAMS, key_signature: "C major" });
  const notes = pitched(result.notes);
  assert.equal(notes[0].confidence, 0.6);
  assert.equal(notes[1].confidence, 0.95);
  // The 0.6 note is faint; the 0.95 note is not.
  const colorCount = (result.musicxml.match(/color="#9a8f7a"/g) ?? []).length;
  assert.equal(colorCount, 1);
});

test("emitted MusicXML is well-formed-ish: balanced score-partwise + parts", () => {
  const { result } = deriveSong("twinkle");
  assert.match(result.musicxml, /^<\?xml/);
  assert.ok(result.musicxml.includes("<score-partwise"));
  assert.ok(result.musicxml.includes("</score-partwise>"));
  const opens = (result.musicxml.match(/<measure /g) ?? []).length;
  const closes = (result.musicxml.match(/<\/measure>/g) ?? []).length;
  assert.equal(opens, closes);
  assert.equal(opens, 4);
});
