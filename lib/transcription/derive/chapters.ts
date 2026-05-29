/**
 * Chapter splitting (doc §4.3).
 *
 * Sessions longer than ~5 minutes are split into chapters at the longest
 * silences, so the browser renders bounded OSMD canvases. The logic lives here
 * in Phase 1; the multi-canvas UI is deferred. Boundaries are in quarter-beats
 * so they're stable across re-renders.
 */

import type { Chapter, DerivedNote } from "../types";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function computeChapters(
  notes: DerivedNote[],
  tempoBpm: number,
  maxChapterMs = FIVE_MINUTES_MS,
): Chapter[] {
  if (notes.length === 0) return [{ index: 0, startBeats: 0, endBeats: 0 }];

  const beatMs = 60000 / tempoBpm;
  const maxBeats = maxChapterMs / beatMs;
  const endBeats = Math.max(
    ...notes.map((n) => n.startBeats + n.durationBeats),
  );

  if (endBeats <= maxBeats) {
    return [{ index: 0, startBeats: 0, endBeats }];
  }

  // Candidate split points: the start of each rest, ranked by rest length.
  const rests = notes
    .filter((n) => n.isRest)
    .map((n) => ({ at: n.startBeats, len: n.durationBeats }))
    .sort((a, b) => b.len - a.len);

  const cuts = new Set<number>();
  // Greedily add the longest rests as cuts until every span is under the cap.
  for (const r of rests) {
    cuts.add(r.at);
    const sorted = [0, ...Array.from(cuts), endBeats].sort((a, b) => a - b);
    const longest = sorted.reduce(
      (max, v, i) => (i === 0 ? max : Math.max(max, v - sorted[i - 1])),
      0,
    );
    if (longest <= maxBeats) break;
  }

  const bounds = [0, ...Array.from(cuts).sort((a, b) => a - b), endBeats];
  const chapters: Chapter[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    chapters.push({ index: i, startBeats: bounds[i], endBeats: bounds[i + 1] });
  }
  return chapters;
}
