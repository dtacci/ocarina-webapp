/**
 * Stage 1 — Note assembly (doc §3.2).
 *
 * Pair each `note_on` with its matching `note_off`, producing raw notes with
 * absolute start/end times in ms. Handles the edge cases that otherwise produce
 * "feels off" notation: orphan note_ons, same-pitch merges, confidence and
 * minimum-duration filtering, and glissando flagging from pitch_bend events.
 */

import type { DeriveParams, OcarinaEvent, Warning } from "../types";

/** A note before quantization: absolute ms timing, raw pitch. */
export interface RawNote {
  midi: number;
  startMs: number;
  endMs: number;
  conf: number;
  hasPitchBend: boolean;
}

/** Drop notes whose detector confidence is below this (doc §3.2). */
const CONF_THRESHOLD = 0.5;
/** Merge same-pitch notes separated by less than this gap (doc §3.2). */
const MERGE_GAP_MS = 30;
/** A pitch swing beyond this within a note marks it as a slide (doc §3.2). */
const GLISS_CENTS = 100;

export interface AssemblyResult {
  notes: RawNote[];
  warnings: Warning[];
}

function sessionEndMs(events: OcarinaEvent[]): number {
  let last = 0;
  for (const e of events) {
    if ("t_ms" in e && typeof e.t_ms === "number") last = Math.max(last, e.t_ms);
  }
  return last;
}

export function assembleNotes(
  events: OcarinaEvent[],
  params: DeriveParams,
): AssemblyResult {
  const warnings: Warning[] = [];
  const endMs = sessionEndMs(events);

  // Pair note_on → next note_off of the same pitch.
  const open = new Map<number, { startMs: number; conf: number }>();
  const raw: RawNote[] = [];

  for (const e of events) {
    if (e.type === "note_on") {
      // An already-open note of this pitch with no off: close it at this onset.
      const prev = open.get(e.midi);
      if (prev) {
        raw.push({
          midi: e.midi,
          startMs: prev.startMs,
          endMs: e.t_ms,
          conf: prev.conf,
          hasPitchBend: false,
        });
      }
      open.set(e.midi, { startMs: e.t_ms, conf: e.conf });
    } else if (e.type === "note_off") {
      const prev = open.get(e.midi);
      if (prev) {
        raw.push({
          midi: e.midi,
          startMs: prev.startMs,
          endMs: e.t_ms,
          conf: prev.conf,
          hasPitchBend: false,
        });
        open.delete(e.midi);
      }
    }
  }

  // Orphan note_ons (no note_off): extend to end of session.
  for (const [midi, { startMs, conf }] of open) {
    raw.push({ midi, startMs, endMs, conf, hasPitchBend: false });
  }

  raw.sort((a, b) => a.startMs - b.startMs || a.midi - b.midi);

  // Flag glissandi: a pitch_bend exceeding GLISS_CENTS during a note's span.
  for (const pb of events) {
    if (pb.type !== "pitch_bend") continue;
    if (Math.abs(pb.cents) < GLISS_CENTS) continue;
    for (const n of raw) {
      if (pb.t_ms >= n.startMs && pb.t_ms <= n.endMs) {
        n.hasPitchBend = true;
      }
    }
  }

  // Merge same-pitch notes separated by a tiny gap (detector flicker).
  const merged: RawNote[] = [];
  for (const n of raw) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.midi === n.midi &&
      n.startMs - last.endMs >= 0 &&
      n.startMs - last.endMs < MERGE_GAP_MS
    ) {
      last.endMs = Math.max(last.endMs, n.endMs);
      last.hasPitchBend = last.hasPitchBend || n.hasPitchBend;
      continue;
    }
    merged.push({ ...n });
  }

  // Confidence filter.
  let lowConf = 0;
  const confKept = merged.filter((n) => {
    if (n.conf < CONF_THRESHOLD) {
      lowConf++;
      return false;
    }
    return true;
  });
  if (lowConf > 0) {
    warnings.push({
      kind: "low_confidence_dropped",
      message: `${lowConf} low-confidence ${lowConf === 1 ? "note was" : "notes were"} dropped.`,
    });
  }

  // Minimum-duration filter (artifact removal).
  let tooShort = 0;
  const kept = confKept.filter((n) => {
    if (n.endMs - n.startMs < params.min_note_ms) {
      tooShort++;
      return false;
    }
    return true;
  });
  if (tooShort > 0) {
    warnings.push({
      kind: "short_notes_filtered",
      message: `${tooShort} ${tooShort === 1 ? "note was" : "notes were"} filtered out as too short.`,
    });
  }

  const slides = kept.filter((n) => n.hasPitchBend).length;
  if (slides > 0) {
    warnings.push({
      kind: "pitch_bend_slides",
      message: `${slides} ${slides === 1 ? "note had" : "notes had"} significant pitch bend and may be slides.`,
    });
  }

  return { notes: kept, warnings };
}
