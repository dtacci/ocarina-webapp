/**
 * Canonicalize + hash derivation parameters for the render cache (doc §2.3).
 *
 * The hash is the cache key for `transcription_renders`, solving the
 * float-equality problem (never uniquely-index on a real column): round tempo,
 * sort keys, JSON-serialize, sha256. Combined with `parser_version`, a parser
 * bump invalidates stale renders correctly.
 *
 * Works in Node (crypto.createHash) and the browser (crypto.subtle), so the
 * server default-render and the client live-edit produce identical keys.
 */

import type { DeriveParams } from "./types";

/** Stable, rounded, key-sorted JSON for a params object. */
export function canonicalizeParams(params: DeriveParams): string {
  const canonical = {
    key_signature: params.key_signature.trim(),
    min_note_ms: Math.round(params.min_note_ms),
    quantize_grid: params.quantize_grid,
    rests_vs_ties: params.rests_vs_ties,
    snap_threshold: Math.round(params.snap_threshold * 100) / 100,
    tempo_bpm: Math.round(params.tempo_bpm * 10) / 10,
    time_signature: params.time_signature,
    transpose: Math.round(params.transpose ?? 0),
  };
  return JSON.stringify(canonical, Object.keys(canonical).sort());
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 hex of the canonicalized params. Async to support both runtimes. */
export async function paramsHash(params: DeriveParams): Promise<string> {
  const canonical = canonicalizeParams(params);

  // Browser / Edge: Web Crypto.
  if (
    typeof globalThis.crypto !== "undefined" &&
    globalThis.crypto.subtle
  ) {
    const data = new TextEncoder().encode(canonical);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return toHex(new Uint8Array(digest));
  }

  // Node fallback.
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(canonical).digest("hex");
}
