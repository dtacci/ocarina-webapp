/**
 * Stage 5a — MusicXML generation (doc §3.6).
 *
 * Hand-rolled MusicXML 4.0 *partwise* emitter for the locked v1 subset (doc
 * §14.3): single part, single staff/voice, treble↔bass auto-switch, key sig,
 * time sig, tempo marking, notes, rests, and ties. Deterministic output → stable
 * golden fixtures. No dependency, runs in Node and browser.
 *
 * Resolution is fixed at DIVISIONS=12 per quarter note, which represents quarter
 * (12), eighth (6), sixteenth (3) and their single-dotted forms exactly. Triplet
 * grids are rounded to this resolution (documented limitation; v1 fixtures use
 * straight grids only).
 */

import type { DeriveParams, DerivedNote } from "../types";
import { keyAlterForStep, parseKeyName, spellMidi } from "./music";
import { beatsPerMeasure } from "./tempo";

const DIVISIONS = 12;
const MIDDLE_C = 60;

interface DurComponent {
  div: number;
  type: string;
  dots: number;
}

// Largest-first table of representable note durations (divisions @ DIVISIONS=12).
const DUR_TABLE: DurComponent[] = [
  { div: 48, type: "whole", dots: 0 },
  { div: 36, type: "half", dots: 1 },
  { div: 24, type: "half", dots: 0 },
  { div: 18, type: "quarter", dots: 1 },
  { div: 12, type: "quarter", dots: 0 },
  { div: 9, type: "eighth", dots: 1 },
  { div: 6, type: "eighth", dots: 0 },
  { div: 3, type: "16th", dots: 0 },
];

/** Round to the nearest representable resolution (multiple of 3 divisions). */
function roundDiv(div: number): number {
  return Math.max(0, Math.round(div / 3) * 3);
}

/** Greedily split a duration into tied/representable components, largest first. */
function decompose(div: number): DurComponent[] {
  const out: DurComponent[] = [];
  let remaining = roundDiv(div);
  while (remaining >= 3) {
    const piece = DUR_TABLE.find((d) => d.div <= remaining);
    if (!piece) break;
    out.push(piece);
    remaining -= piece.div;
  }
  if (out.length === 0) out.push({ div: 3, type: "16th", dots: 0 });
  return out;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Notes below this confidence render faint, flagging the detector's uncertainty. */
const CONF_LOW = 0.75;
/** Faint ink for low-confidence notes (muted brown-grey, readable on paper). */
const LOW_CONF_COLOR = "#9a8f7a";

/** A measure-aligned segment after splitting at bar lines. */
interface Piece {
  measure: number;
  isRest: boolean;
  midi: number;
  div: number;
  tieStop: boolean; // continues a note from the previous piece
  tieStart: boolean; // continues into the next piece
  confidence?: number;
  /** Index into the source notes array (for glissando pairing). */
  noteIndex: number;
  /** First / last piece of its source note (a note may span barlines). */
  isNoteStart: boolean;
  isNoteEnd: boolean;
}

function splitIntoMeasures(
  notes: DerivedNote[],
  divsPerMeasure: number,
): Piece[] {
  const pieces: Piece[] = [];
  notes.forEach((n, noteIndex) => {
    let startDiv = roundDiv(n.startBeats * DIVISIONS);
    let remaining = roundDiv(n.durationBeats * DIVISIONS);
    let continuing = false;
    const firstIdx = pieces.length;
    while (remaining > 0) {
      const measure = Math.floor(startDiv / divsPerMeasure);
      const measureEnd = (measure + 1) * divsPerMeasure;
      const take = Math.min(remaining, measureEnd - startDiv);
      const crosses = take < remaining;
      pieces.push({
        measure,
        isRest: n.isRest,
        midi: n.midi,
        div: take,
        tieStop: !n.isRest && continuing,
        tieStart: !n.isRest && crosses,
        confidence: n.confidence,
        noteIndex,
        isNoteStart: !continuing,
        isNoteEnd: false,
      });
      startDiv += take;
      remaining -= take;
      continuing = true;
    }
    // Mark the last emitted piece as the note's end.
    if (pieces.length > firstIdx) pieces[pieces.length - 1].isNoteEnd = true;
  });
  return pieces;
}

function noteXml(
  piece: Piece,
  comp: DurComponent,
  fifths: number,
  tieStop: boolean,
  tieStart: boolean,
  glissStop = false,
  glissStart = false,
): string {
  const dots = "<dot/>".repeat(comp.dots);
  if (piece.isRest) {
    return `      <note>\n        <rest/>\n        <duration>${comp.div}</duration>\n        <type>${comp.type}</type>\n${dots ? `        ${dots}\n` : ""}      </note>`;
  }

  const { step, alter, octave } = spellMidi(piece.midi, fifths);
  const alterXml = alter !== 0 ? `\n          <alter>${alter}</alter>` : "";
  // Emit an explicit accidental only when the note departs from the key sig.
  const needsAccidental = alter !== keyAlterForStep(step, fifths);
  const accidentalName =
    alter === 1 ? "sharp" : alter === -1 ? "flat" : "natural";
  const accidentalXml = needsAccidental
    ? `\n        <accidental>${accidentalName}</accidental>`
    : "";

  const ties: string[] = [];
  const tiedNotations: string[] = [];
  if (tieStop) {
    ties.push(`<tie type="stop"/>`);
    tiedNotations.push(`<tied type="stop"/>`);
  }
  if (tieStart) {
    ties.push(`<tie type="start"/>`);
    tiedNotations.push(`<tied type="start"/>`);
  }
  const tieXml = ties.length ? `\n        ${ties.join("\n        ")}` : "";

  // Glissando: stop before start (close the prior span, then open the next).
  const notationParts = [...tiedNotations];
  if (glissStop) notationParts.push(`<glissando type="stop" number="1" line-type="wavy"/>`);
  if (glissStart) notationParts.push(`<glissando type="start" number="1" line-type="wavy"/>`);
  const notationsXml = notationParts.length
    ? `\n        <notations>${notationParts.join("")}</notations>`
    : "";

  // Low-confidence notes render faint (overlay of detector uncertainty).
  const colorAttr =
    piece.confidence !== undefined && piece.confidence < CONF_LOW
      ? ` color="${LOW_CONF_COLOR}"`
      : "";

  return `      <note${colorAttr}>
        <pitch>
          <step>${step}</step>${alterXml}
          <octave>${octave}</octave>
        </pitch>
        <duration>${comp.div}</duration>${tieXml}
        <type>${comp.type}</type>${dots ? `\n        ${dots}` : ""}${accidentalXml}${notationsXml}
      </note>`;
}

export interface MusicXmlOptions {
  title?: string;
  /** Resolved concrete key (never "auto"). */
  keySignature: string;
}

export function generateMusicXml(
  notes: DerivedNote[],
  params: DeriveParams,
  options: MusicXmlOptions,
): string {
  const parsedKey = parseKeyName(options.keySignature);
  const fifths = parsedKey?.fifths ?? 0;
  const mode = parsedKey?.mode ?? "major";

  const divsPerMeasure = Math.round(beatsPerMeasure(params.time_signature) * DIVISIONS);

  // Clef: treble by default; bass when the median pitch sits below middle C.
  const pitched = notes.filter((n) => !n.isRest).map((n) => n.midi).sort((a, b) => a - b);
  const median = pitched.length ? pitched[Math.floor(pitched.length / 2)] : MIDDLE_C + 7;
  const useBass = median < MIDDLE_C;

  // Glissando pairing: a note flagged with a pitch bend slides into the
  // immediately-following pitched note (start on the bent note, stop on the next).
  const slideStart = new Set<number>();
  const slideStop = new Set<number>();
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (!n.isRest && n.hasPitchBend) {
      const next = notes[i + 1];
      if (next && !next.isRest) {
        slideStart.add(i);
        slideStop.add(i + 1);
      }
    }
  }

  const pieces = splitIntoMeasures(notes, divsPerMeasure);
  const lastMeasure = pieces.length ? pieces[pieces.length - 1].measure : 0;

  const measures: string[] = [];
  for (let m = 0; m <= lastMeasure; m++) {
    const measurePieces = pieces.filter((p) => p.measure === m);

    const body: string[] = [];
    for (const piece of measurePieces) {
      const comps = decompose(piece.div);
      comps.forEach((comp, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === comps.length - 1;
        // Gliss markers go on the note's outermost components only.
        const glissStop = piece.isNoteStart && isFirst && slideStop.has(piece.noteIndex);
        const glissStart = piece.isNoteEnd && isLast && slideStart.has(piece.noteIndex);
        body.push(
          noteXml(
            piece,
            comp,
            fifths,
            piece.tieStop && isFirst ? true : !isFirst, // stop on inner joins
            piece.tieStart && isLast ? true : !isLast, // start on inner joins
            glissStop,
            glissStart,
          ),
        );
      });
    }

    let attributes = "";
    if (m === 0) {
      const clef = useBass
        ? "<clef><sign>F</sign><line>4</line></clef>"
        : "<clef><sign>G</sign><line>2</line></clef>";
      attributes = `      <attributes>
        <divisions>${DIVISIONS}</divisions>
        <key><fifths>${fifths}</fifths><mode>${mode}</mode></key>
        <time><beats>${params.time_signature[0]}</beats><beat-type>${params.time_signature[1]}</beat-type></time>
        ${clef}
      </attributes>
      <direction placement="above">
        <direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${Math.round(params.tempo_bpm)}</per-minute></metronome></direction-type>
        <sound tempo="${Math.round(params.tempo_bpm)}"/>
      </direction>\n`;
    }

    const content =
      body.length > 0
        ? body.join("\n")
        : // Empty measure → a full-measure rest keeps it valid.
          `      <note><rest measure="yes"/><duration>${divsPerMeasure}</duration></note>`;

    measures.push(`    <measure number="${m + 1}">\n${attributes}${content}\n    </measure>`);
  }

  const titleXml = options.title
    ? `  <work><work-title>${escapeXml(options.title)}</work-title></work>\n`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
${titleXml}  <part-list>
    <score-part id="P1"><part-name>Voice</part-name></score-part>
  </part-list>
  <part id="P1">
${measures.join("\n")}
  </part>
</score-partwise>`;
}
