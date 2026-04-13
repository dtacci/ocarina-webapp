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
  | { kind: "gain"; enabled: boolean; db: number };

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
};

/** Param ranges — reference for primitives. */
export const EFFECT_RANGES = {
  fade: { inMs: { min: 0, max: 2000, default: 0 }, outMs: { min: 0, max: 2000, default: 0 } },
  filter: { freq: { min: 20, max: 20000, default: 1000 }, q: { min: 0.1, max: 18, default: 0.7 } },
  pitch: { semitones: { min: -24, max: 24, default: 0 } },
  reverb: { decaySec: { min: 0.1, max: 10, default: 2 }, wet: { min: 0, max: 1, default: 0.25 } },
  gain: { db: { min: -24, max: 12, default: 0 } },
} as const;
