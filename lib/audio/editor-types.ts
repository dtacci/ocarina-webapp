/**
 * Sample Editor — effect chain spec.
 *
 * EffectNode is a discriminated union: each effect has its own param shape
 * plus a shared `enabled` flag for bypass without removing it from the chain.
 * An EditSpec is persisted alongside each saved sample (in `samples.edit_spec`)
 * so the editor can restore the exact chain when the sample is re-opened.
 */

export type FilterMode = "hp" | "lp" | "bp";
export type FadeCurve = "linear" | "exp";

export type EffectNode =
  | { kind: "trim"; enabled: boolean; startSec: number; endSec: number }
  | { kind: "fade"; enabled: boolean; inMs: number; outMs: number; curve: FadeCurve }
  | { kind: "filter"; enabled: boolean; mode: FilterMode; freq: number; q: number }
  | { kind: "pitch"; enabled: boolean; semitones: number }
  | { kind: "reverb"; enabled: boolean; decaySec: number; wet: number }
  | { kind: "gain"; enabled: boolean; db: number }
  | {
      kind: "compressor";
      enabled: boolean;
      /** dB, typically -60..0. Signal above this triggers compression. */
      threshold: number;
      /** Compression ratio, 1..20. */
      ratio: number;
      /** Seconds, 0.0001..0.1 (0.1..100 ms). */
      attack: number;
      /** Seconds, 0.01..1 (10..1000 ms). */
      release: number;
      /** dB, 0..40. Softness of the threshold knee. */
      knee: number;
      /** dB, applied post-compression. -12..+12. */
      makeup: number;
    };

export type EffectKind = EffectNode["kind"];

export interface EditSpec {
  chain: EffectNode[];
  sourceSampleId: string;
}

/**
 * Default chain state when opening a fresh editor session.
 * Trim spans the full sample (callers should clamp endSec to actual duration).
 * Everything else is disabled — user opts in per effect.
 */
export function defaultChain(durationSec: number): EffectNode[] {
  return [
    { kind: "trim", enabled: true, startSec: 0, endSec: durationSec },
    { kind: "fade", enabled: false, inMs: 0, outMs: 0, curve: "linear" },
    { kind: "filter", enabled: false, mode: "hp", freq: 80, q: 0.7 },
    { kind: "pitch", enabled: false, semitones: 0 },
    { kind: "reverb", enabled: false, decaySec: 2, wet: 0.25 },
    { kind: "gain", enabled: true, db: 0 },
  ];
}

/** Display label for an effect — small-caps mono header. */
export const EFFECT_LABELS: Record<EffectKind, string> = {
  trim: "TRIM",
  fade: "FADE",
  filter: "FILTER",
  pitch: "PITCH",
  reverb: "REVERB",
  gain: "GAIN",
  compressor: "COMPRESSOR",
};

/** Param ranges — reference for primitives. */
export const EFFECT_RANGES = {
  fade: { inMs: { min: 0, max: 2000, default: 0 }, outMs: { min: 0, max: 2000, default: 0 } },
  filter: { freq: { min: 20, max: 20000, default: 1000 }, q: { min: 0.1, max: 18, default: 0.7 } },
  pitch: { semitones: { min: -24, max: 24, default: 0 } },
  reverb: { decaySec: { min: 0.1, max: 10, default: 2 }, wet: { min: 0, max: 1, default: 0.25 } },
  gain: { db: { min: -24, max: 12, default: 0 } },
  compressor: {
    threshold: { min: -60, max: 0, default: -24 },
    ratio: { min: 1, max: 20, default: 4 },
    /** Stored in seconds; card displays ms. */
    attack: { min: 0.0001, max: 0.1, default: 0.003 },
    /** Stored in seconds; card displays ms. */
    release: { min: 0.01, max: 1, default: 0.25 },
    knee: { min: 0, max: 40, default: 30 },
    makeup: { min: -12, max: 12, default: 0 },
  },
} as const;

/**
 * Factory for a freshly-added effect node of the given kind.
 * Used by the `+ ADD` menu to seed new chain entries. `duration` is only
 * consulted for `trim` (which spans the full sample by default); other kinds
 * ignore it.
 */
export function makeDefaultNode(kind: EffectKind, duration: number): EffectNode {
  switch (kind) {
    case "trim":
      return { kind: "trim", enabled: true, startSec: 0, endSec: duration };
    case "fade":
      return { kind: "fade", enabled: true, inMs: 0, outMs: 0, curve: "linear" };
    case "filter":
      return { kind: "filter", enabled: true, mode: "hp", freq: 80, q: 0.7 };
    case "pitch":
      return { kind: "pitch", enabled: true, semitones: 0 };
    case "reverb":
      return { kind: "reverb", enabled: true, decaySec: 2, wet: 0.25 };
    case "gain":
      return { kind: "gain", enabled: true, db: 0 };
    case "compressor":
      return {
        kind: "compressor",
        enabled: true,
        threshold: -24,
        ratio: 4,
        attack: 0.003,
        release: 0.25,
        knee: 30,
        makeup: 0,
      };
  }
}
