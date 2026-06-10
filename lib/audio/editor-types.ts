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
  | {
      kind: "delay";
      enabled: boolean;
      /** Seconds, 0.01..2. */
      timeSec: number;
      /** 0..0.95 — kept under 1 to prevent runaway feedback. */
      feedback: number;
      /** Wet/dry mix, 0..1. */
      wet: number;
    }
  | {
      kind: "harmony";
      enabled: boolean;
      /** Voice 1 pitch offset in semitones, -24..+24. */
      voice1Semitones: number;
      /** Voice 2 pitch offset in semitones, -24..+24 (set to 0 to disable voice 2). */
      voice2Semitones: number;
      /** Wet/dry mix, 0..1. 0 = dry only, 1 = harmonies only. */
      wet: number;
    }
  | {
      kind: "eq3";
      enabled: boolean;
      /** Band gains in dB, -24..+6 (kill-EQ range). */
      low: number;
      mid: number;
      high: number;
      /** Low/mid crossover in Hz. */
      lowFreq: number;
      /** Mid/high crossover in Hz. */
      highFreq: number;
    }
  | {
      kind: "distortion";
      enabled: boolean;
      /** Drive amount, 0..1. */
      amount: number;
      /** Wet/dry mix, 0..1. */
      wet: number;
    }
  | {
      kind: "chorus";
      enabled: boolean;
      /** LFO rate in Hz, 0.1..8. */
      rateHz: number;
      /** Modulation depth, 0..1. */
      depth: number;
      /** Wet/dry mix, 0..1. */
      wet: number;
    }
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
 * Everything else is disabled — user opts in per effect by clicking the LED.
 *
 * All seven effect cards are present from the start so users can see the
 * full pedalboard at a glance instead of having to discover them via "+ ADD".
 */
export function defaultChain(durationSec: number): EffectNode[] {
  return [
    { kind: "trim", enabled: true, startSec: 0, endSec: durationSec },
    { kind: "fade", enabled: false, inMs: 0, outMs: 0, curve: "linear" },
    { kind: "filter", enabled: false, mode: "hp", freq: 80, q: 0.7 },
    { kind: "pitch", enabled: false, semitones: 0 },
    { kind: "harmony", enabled: false, voice1Semitones: 7, voice2Semitones: 12, wet: 0.5 },
    { kind: "delay", enabled: false, timeSec: 0.25, feedback: 0.35, wet: 0.3 },
    { kind: "reverb", enabled: false, decaySec: 2, wet: 0.25 },
    { kind: "compressor", enabled: false, threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 30, makeup: 0 },
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
  delay: "DELAY",
  harmony: "HARMONY",
  eq3: "EQ",
  distortion: "DISTORT",
  chorus: "CHORUS",
  gain: "GAIN",
  compressor: "COMPRESSOR",
};

/** Param ranges — reference for primitives. */
export const EFFECT_RANGES = {
  fade: { inMs: { min: 0, max: 2000, default: 0 }, outMs: { min: 0, max: 2000, default: 0 } },
  filter: { freq: { min: 20, max: 20000, default: 1000 }, q: { min: 0.1, max: 18, default: 0.7 } },
  pitch: { semitones: { min: -24, max: 24, default: 0 } },
  reverb: { decaySec: { min: 0.1, max: 10, default: 2 }, wet: { min: 0, max: 1, default: 0.25 } },
  delay: {
    timeSec: { min: 0.01, max: 2, default: 0.25 },
    feedback: { min: 0, max: 0.95, default: 0.35 },
    wet: { min: 0, max: 1, default: 0.3 },
  },
  harmony: {
    voice1Semitones: { min: -24, max: 24, default: 7 },  // perfect 5th
    voice2Semitones: { min: -24, max: 24, default: 12 }, // octave
    wet: { min: 0, max: 1, default: 0.5 },
  },
  eq3: {
    low: { min: -24, max: 6, default: 0 },
    mid: { min: -24, max: 6, default: 0 },
    high: { min: -24, max: 6, default: 0 },
    lowFreq: { min: 80, max: 1000, default: 400 },
    highFreq: { min: 1000, max: 8000, default: 2500 },
  },
  distortion: {
    amount: { min: 0, max: 1, default: 0.4 },
    wet: { min: 0, max: 1, default: 1 },
  },
  chorus: {
    rateHz: { min: 0.1, max: 8, default: 1.5 },
    depth: { min: 0, max: 1, default: 0.7 },
    wet: { min: 0, max: 1, default: 0.5 },
  },
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
    case "delay":
      return { kind: "delay", enabled: true, timeSec: 0.25, feedback: 0.35, wet: 0.3 };
    case "harmony":
      return { kind: "harmony", enabled: true, voice1Semitones: 7, voice2Semitones: 12, wet: 0.5 };
    case "eq3":
      return { kind: "eq3", enabled: true, low: 0, mid: 0, high: 0, lowFreq: 400, highFreq: 2500 };
    case "distortion":
      return { kind: "distortion", enabled: true, amount: 0.4, wet: 1 };
    case "chorus":
      return { kind: "chorus", enabled: true, rateHz: 1.5, depth: 0.7, wet: 0.5 };
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
