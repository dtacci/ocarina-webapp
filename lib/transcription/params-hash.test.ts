/**
 * Tests for the render-cache key (doc §2.3): canonicalization + hashing.
 * Run: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalizeParams, paramsHash } from "./params-hash";
import { DEFAULT_PARAMS, type DeriveParams } from "./types";

test("identical params produce an identical hash", async () => {
  const a = await paramsHash(DEFAULT_PARAMS);
  const b = await paramsHash({ ...DEFAULT_PARAMS });
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("tempo differences beyond rounding change the hash", async () => {
  const a = await paramsHash(DEFAULT_PARAMS);
  const b = await paramsHash({ ...DEFAULT_PARAMS, tempo_bpm: 140 });
  assert.notEqual(a, b);
});

test("sub-rounding tempo jitter does NOT change the hash", async () => {
  // Rounded to 0.1 BPM, so 120.00 and 120.04 collapse to the same key.
  const a = await paramsHash({ ...DEFAULT_PARAMS, tempo_bpm: 120.0 });
  const b = await paramsHash({ ...DEFAULT_PARAMS, tempo_bpm: 120.04 });
  assert.equal(a, b);
});

test("canonicalization is key-order independent", () => {
  const reordered: DeriveParams = {
    rests_vs_ties: "rests",
    min_note_ms: 60,
    time_signature: [4, 4],
    tempo_bpm: 120,
    key_signature: "auto",
    snap_threshold: 0.5,
    quantize_grid: "1/16",
    transpose: 0,
  };
  assert.equal(canonicalizeParams(reordered), canonicalizeParams(DEFAULT_PARAMS));
});

test("transpose changes the hash", async () => {
  const a = await paramsHash(DEFAULT_PARAMS);
  const b = await paramsHash({ ...DEFAULT_PARAMS, transpose: 12 });
  assert.notEqual(a, b);
});
