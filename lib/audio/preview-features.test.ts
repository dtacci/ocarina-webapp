import { test } from "node:test";
import assert from "node:assert/strict";

import { buildDrumPattern, rowFromOnsets, type Onset } from "./preview-features";

const KICK_ROW = 0;
const SNARE_ROW = 1;
const CHAT_ROW = 3;

/** Onsets for `bars` repetitions of hits on the given 16th-note step indices. */
function onsetsAtSteps(steps: number[], bars: number, bpm = 120, strength = 1): Onset[] {
  const sixteenth = 60 / bpm / 4;
  const out: Onset[] = [];
  for (let bar = 0; bar < bars; bar++) {
    for (const s of steps) {
      out.push({ time: (bar * 16 + s) * sixteenth, strength });
    }
  }
  return out;
}

test("rowFromOnsets places four-on-the-floor kicks on steps 0/4/8/12", () => {
  const sixteenth = 60 / 120 / 4;
  const { row } = rowFromOnsets(onsetsAtSteps([0, 4, 8, 12], 2), 0, sixteenth);
  const on = row.map((s) => s.on);
  assert.deepEqual(
    on,
    [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
  );
});

test("buildDrumPattern maps bands to kick/snare/hat rows", () => {
  const pattern = buildDrumPattern(
    {
      kick: onsetsAtSteps([0, 4, 8, 12], 4),
      snare: onsetsAtSteps([4, 12], 4),
      hat: onsetsAtSteps([0, 2, 4, 6, 8, 10, 12, 14], 4),
    },
    120,
    0,
  ).pattern;

  assert.equal(pattern[KICK_ROW][0].on, true);
  assert.equal(pattern[KICK_ROW][8].on, true);
  assert.equal(pattern[SNARE_ROW][4].on, true);
  assert.equal(pattern[SNARE_ROW][12].on, true);
  assert.equal(pattern[SNARE_ROW][0].on, false);
  assert.equal(pattern[CHAT_ROW][2].on, true);
  assert.equal(pattern[CHAT_ROW][14].on, true);
});

test("rowFromOnsets returns zero confidence on silence", () => {
  const sixteenth = 60 / 120 / 4;
  const { row, confidence } = rowFromOnsets([], 0, sixteenth);
  assert.equal(confidence, 0);
  assert.equal(row.every((s) => !s.on), true);
});
