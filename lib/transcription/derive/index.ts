/**
 * The derivation function (doc §3): events → notation.
 *
 *   derive(events, header, params) → { notes, musicxml, midi, warnings }
 *
 * Pure and idempotent, so `(events, params, parserVersion)` can be hashed and
 * the output cached. Runs identically in Node (server ingest) and the browser
 * (live parameter edits).
 */

import type {
  DeriveParams,
  DeriveResult,
  KeyCandidate,
  OcarinaEvent,
  OcarinaHeader,
  Warning,
} from "../types";
import { applyLatency } from "./latency";
import { assembleNotes } from "./note-assembly";
import { quantize } from "./quantize";
import { detectKey } from "./key-detect";
import { generateMusicXml } from "./musicxml-gen";
import { generateMidi } from "./midi-gen";
import { computeChapters } from "./chapters";

export interface DeriveOptions {
  /** Title woven into the MusicXML <work-title>. */
  title?: string;
  /**
   * True when the tempo came from defaults rather than the user, so we can warn
   * "tempo was guessed" (doc §3.7). Set by the ingest default-render path.
   */
  tempoGuessed?: boolean;
}

export function derive(
  events: OcarinaEvent[],
  header: OcarinaHeader,
  params: DeriveParams,
  options: DeriveOptions = {},
): DeriveResult {
  const warnings: Warning[] = [];

  // Stage 0 — latency calibration.
  const { events: shifted, warnings: latencyWarnings } = applyLatency(events, header);
  warnings.push(...latencyWarnings);

  // Stage 1 — note assembly.
  const { notes: rawNotes, warnings: assemblyWarnings } = assembleNotes(shifted, params);
  warnings.push(...assemblyWarnings);

  // Stage 3 — quantization (stage 2 tempo is folded in via params).
  const quantized = quantize(rawNotes, params);

  // Transpose: shift every pitch before key detection + spelling so the displayed
  // key and accidentals match the transposed notation (doc §10.1).
  const transpose = params.transpose ?? 0;
  const notes =
    transpose === 0
      ? quantized
      : quantized.map((n) =>
          n.isRest ? n : { ...n, midi: n.midi + transpose },
        );

  // Stage 4 — key signature: detect candidates, resolve the concrete key.
  let keyCandidates: KeyCandidate[] = [];
  let resolvedKey = params.key_signature;
  if (params.key_signature === "auto") {
    keyCandidates = detectKey(notes);
    resolvedKey = keyCandidates[0]?.key ?? "C major";
    // K-S is unreliable on monophonic input — flag ambiguity if the top two
    // candidates are close (doc §3.5/§3.7).
    if (
      keyCandidates.length >= 2 &&
      keyCandidates[0].score - keyCandidates[1].score < 0.05
    ) {
      warnings.push({
        kind: "key_ambiguous",
        message: `Key signature is ambiguous — alternates: ${keyCandidates
          .slice(1, 3)
          .map((c) => c.key)
          .join(", ")}.`,
      });
    }
  }

  if (options.tempoGuessed) {
    warnings.push({
      kind: "tempo_guessed",
      message: "Tempo was guessed; consider setting it manually.",
    });
  }

  // Kit-change note (informational).
  const kitChange = events.find((e) => e.type === "kit_change");
  if (kitChange) {
    const sec = Math.round((kitChange.t_ms ?? 0) / 1000);
    const mm = Math.floor(sec / 60);
    const ss = String(sec % 60).padStart(2, "0");
    warnings.push({
      kind: "kit_change",
      message: `Session contains a kit change at ${mm}:${ss} — notation continues regardless.`,
    });
  }

  // Stage 5 — MusicXML + MIDI.
  const musicxml = generateMusicXml(notes, params, {
    title: options.title,
    keySignature: resolvedKey,
  });
  const midi = generateMidi(notes, params);

  const chapters = computeChapters(notes, params.tempo_bpm);
  if (chapters.length > 1) {
    warnings.push({
      kind: "long_session_chaptered",
      message: `Recording is long; auto-split into ${chapters.length} chapters.`,
    });
  }

  return { notes, chapters, musicxml, midi, keyCandidates, warnings };
}
