/**
 * Stage 3 — Quantization (doc §3.4).
 *
 * Snap note onsets and durations to a grid, resolve monophonic overlaps, and
 * fill gaps with rests (or extend the previous note, per `rests_vs_ties`).
 *
 * Onset accuracy is prioritized over duration accuracy: the next note's snapped
 * onset is the authoritative endpoint of the previous note's duration.
 */

import type { DeriveParams, DerivedNote, QuantizeGrid } from "../types";
import { msToBeats } from "./tempo";
import type { RawNote } from "./note-assembly";

/** Grid cell size in quarter-note beats. */
export function gridBeats(grid: QuantizeGrid): number {
  switch (grid) {
    case "1/4":
      return 1;
    case "1/8":
      return 0.5;
    case "1/16":
      return 0.25;
    case "1/8t":
      return 1 / 3;
    case "1/16t":
      return 1 / 6;
  }
}

function snap(beats: number, cell: number): number {
  return Math.round(beats / cell) * cell;
}

export function quantize(raw: RawNote[], params: DeriveParams): DerivedNote[] {
  const cell = gridBeats(params.quantize_grid);
  const bpm = params.tempo_bpm;

  // 1. Snap onsets and ends to the grid (start in beats from session start).
  type Snapped = RawNote & { startQ: number; endQ: number };
  const snapped: Snapped[] = raw
    .map((n) => {
      const startQ = snap(msToBeats(n.startMs, bpm), cell);
      let endQ = snap(msToBeats(n.endMs, bpm), cell);
      if (endQ <= startQ) endQ = startQ + cell; // minimum one grid cell
      return { ...n, startQ, endQ };
    })
    .sort((a, b) => a.startQ - b.startQ);

  // 2. Resolve monophonic overlaps: a note can't start before the prior ends.
  for (let i = 1; i < snapped.length; i++) {
    const prev = snapped[i - 1];
    const cur = snapped[i];
    if (cur.startQ < prev.endQ) prev.endQ = cur.startQ;
    // Drop degenerate notes squeezed to zero by the overlap fix.
    if (prev.endQ <= prev.startQ) prev.endQ = prev.startQ; // marked for removal below
  }
  const playable = snapped.filter((n) => n.endQ > n.startQ);

  // 3. Build the note/rest sequence, prioritizing onset accuracy.
  const out: DerivedNote[] = [];
  let cursor = 0;
  for (let i = 0; i < playable.length; i++) {
    const n = playable[i];

    if (n.startQ > cursor) {
      const gap = n.startQ - cursor;
      if (params.rests_vs_ties === "ties" && out.length > 0) {
        // Extend the previous note to fill the gap instead of resting.
        out[out.length - 1].durationBeats += gap;
      } else {
        out.push({
          midi: 0,
          isRest: true,
          startBeats: cursor,
          durationBeats: gap,
          rawStartMs: 0,
          rawEndMs: 0,
        });
      }
    }

    // The next note's onset is the authoritative end of this one.
    const next = playable[i + 1];
    const endQ = next ? Math.max(n.endQ, n.startQ + cell) : n.endQ;
    const trueEnd = next && next.startQ < endQ ? n.endQ : endQ;
    const durationBeats = Math.max(cell, trueEnd - n.startQ);

    out.push({
      midi: n.midi,
      isRest: false,
      startBeats: n.startQ,
      durationBeats,
      rawStartMs: n.startMs,
      rawEndMs: n.endMs,
      hasPitchBend: n.hasPitchBend || undefined,
    });
    cursor = n.startQ + durationBeats;
  }

  return out;
}
