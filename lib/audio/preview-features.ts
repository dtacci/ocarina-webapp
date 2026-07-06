import type { Pattern, Step, Velocity } from "@/lib/audio/drum-engine";
import { VOICE_COUNT } from "@/lib/audio/drum-kit-manifest";

/**
 * Client-side signal analysis for a 30s song preview — zero dependencies, built
 * on OfflineAudioContext + BiquadFilter (the same Web Audio primitives the drum
 * synth/render already use). No essentia.js (AGPL); no npm DSP library.
 *
 * It derives a tempo (Deezer's bpm is the prior; we only autocorrelate when the
 * prior is missing), a downbeat phase, rough brightness/energy, and a drums-only
 * 16-step pattern by band-splitting the mix (low→kick, mid→snare, high→hat),
 * picking onsets per band, and quantizing them to the grid. The result is a
 * "sounds-like" groove sketch, not a transcription.
 */

const STEPS_PER_PATTERN = 16;
// Canonical voice rows (see DEFAULT_VOICE_NAMES): kick=0, snare=1, c-hat=3.
const KICK_ROW = 0;
const SNARE_ROW = 1;
const CHAT_ROW = 3;

export interface Onset {
  time: number; // seconds into the preview
  strength: number; // onset flux magnitude
}

export interface PreviewFeatures {
  bpm: number;
  beat0Sec: number; // phase: where the first downbeat sits in the preview
  brightness: number; // 1-10, high-band energy share
  energy: number; // 1-10, overall loudness
  drumPattern: Pattern;
  perVoiceConfidence: { kick: number; snare: number; hat: number };
}

// ---------------------------------------------------------------------------
// Pure helpers (no Web Audio) — unit-testable in isolation.
// ---------------------------------------------------------------------------

function emptyPattern(): Pattern {
  return Array.from({ length: VOICE_COUNT }, () =>
    Array.from({ length: STEPS_PER_PATTERN }, () => ({ on: false, velocity: 1 as Velocity })),
  );
}

/** Velocity bucket from a 0-1 normalized energy. */
function toVelocity(norm: number): Velocity {
  if (norm > 0.66) return 2;
  if (norm > 0.33) return 1;
  return 0;
}

/**
 * Accumulate a band's onsets onto the 16-step grid (summing energy across every
 * bar in the clip), then keep steps whose recurring energy clears a relative
 * threshold. Returns the filled VoiceRow + a 0-1 presence confidence.
 */
export function rowFromOnsets(
  onsets: Onset[],
  beat0Sec: number,
  sixteenthSec: number,
): { row: Step[]; confidence: number } {
  const energy = new Array<number>(STEPS_PER_PATTERN).fill(0);
  const counts = new Array<number>(STEPS_PER_PATTERN).fill(0);
  for (const o of onsets) {
    if (o.time < beat0Sec) continue;
    const step = Math.round((o.time - beat0Sec) / sixteenthSec);
    if (step < 0) continue;
    const idx = ((step % STEPS_PER_PATTERN) + STEPS_PER_PATTERN) % STEPS_PER_PATTERN;
    energy[idx] += o.strength;
    counts[idx] += 1;
  }

  const maxEnergy = Math.max(...energy);
  const row: Step[] = Array.from({ length: STEPS_PER_PATTERN }, () => ({
    on: false,
    velocity: 1 as Velocity,
  }));
  if (maxEnergy <= 0) return { row, confidence: 0 };

  let onSteps = 0;
  for (let i = 0; i < STEPS_PER_PATTERN; i++) {
    const norm = energy[i] / maxEnergy;
    // Keep steps that recur strongly — filters one-off bleed between bands.
    if (norm >= 0.25) {
      row[i] = { on: true, velocity: toVelocity(norm) };
      onSteps++;
    }
  }
  // Confidence: presence (did this voice fire repeatedly?) tempered by how many
  // distinct steps it occupies (a plausible groove, not noise on every step).
  const presence = Math.min(1, onsets.length / 8);
  const density = onSteps === 0 ? 0 : Math.min(1, onSteps / 8);
  return { row, confidence: +(presence * (0.5 + 0.5 * (1 - Math.abs(0.5 - density) * 2))).toFixed(3) };
}

/**
 * Build a drum Pattern from per-band onsets. Pure — drives both the live
 * analyzer and unit tests (feed synthetic onsets, assert the grid).
 */
export function buildDrumPattern(
  bands: { kick: Onset[]; snare: Onset[]; hat: Onset[] },
  bpm: number,
  beat0Sec: number,
): { pattern: Pattern; confidence: PreviewFeatures["perVoiceConfidence"] } {
  const sixteenthSec = 60 / bpm / 4;
  const pattern = emptyPattern();
  const kick = rowFromOnsets(bands.kick, beat0Sec, sixteenthSec);
  const snare = rowFromOnsets(bands.snare, beat0Sec, sixteenthSec);
  const hat = rowFromOnsets(bands.hat, beat0Sec, sixteenthSec);
  pattern[KICK_ROW] = kick.row;
  pattern[SNARE_ROW] = snare.row;
  pattern[CHAT_ROW] = hat.row;
  return {
    pattern,
    confidence: { kick: kick.confidence, snare: snare.confidence, hat: hat.confidence },
  };
}

/** Short-window RMS envelope of a signal. */
function energyEnvelope(samples: Float32Array, hop: number, win: number): Float32Array {
  const frames = Math.max(0, Math.floor((samples.length - win) / hop) + 1);
  const env = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    const start = i * hop;
    for (let j = 0; j < win; j++) {
      const s = samples[start + j];
      sum += s * s;
    }
    env[i] = Math.sqrt(sum / win);
  }
  return env;
}

/** Half-wave-rectified first difference (onset flux) of an envelope. */
function fluxEnvelope(env: Float32Array): Float32Array {
  const flux = new Float32Array(env.length);
  for (let i = 1; i < env.length; i++) flux[i] = Math.max(0, env[i] - env[i - 1]);
  return flux;
}

/** Adaptive peak-pick over a flux envelope → onsets with strengths. */
function pickOnsets(
  flux: Float32Array,
  hopSec: number,
  opts: { window?: number; k?: number; refractoryHops?: number } = {},
): Onset[] {
  const W = opts.window ?? 16;
  const k = opts.k ?? 1.6;
  const refractory = opts.refractoryHops ?? 4;
  const onsets: Onset[] = [];
  let last = -Infinity;
  for (let i = 1; i < flux.length - 1; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - W); j <= Math.min(flux.length - 1, i + W); j++) {
      sum += flux[j];
      count++;
    }
    const thresh = (sum / count) * k + 1e-6;
    if (
      flux[i] > thresh &&
      flux[i] >= flux[i - 1] &&
      flux[i] >= flux[i + 1] &&
      i - last >= refractory
    ) {
      onsets.push({ time: i * hopSec, strength: flux[i] });
      last = i;
    }
  }
  return onsets;
}

/** Autocorrelation tempo estimate over a flux envelope (fallback only). */
function detectBpm(flux: Float32Array, hopSec: number, min = 70, max = 170): number {
  const minLag = Math.max(1, Math.floor(60 / max / hopSec));
  const maxLag = Math.ceil(60 / min / hopSec);
  let bestLag = minLag;
  let bestVal = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = lag; i < flux.length; i++) sum += flux[i] * flux[i - lag];
    if (sum > bestVal) {
      bestVal = sum;
      bestLag = lag;
    }
  }
  return 60 / (bestLag * hopSec);
}

/** Find the beat phase (downbeat offset) best aligned to the kick onsets. */
function detectBeat0(kickOnsets: Onset[], bpm: number): number {
  if (kickOnsets.length === 0) return 0;
  const beat = 60 / bpm;
  const sigma = beat * 0.08;
  const STEPS = 48;
  let bestPhase = 0;
  let bestScore = -Infinity;
  for (let s = 0; s < STEPS; s++) {
    const phase = (s / STEPS) * beat;
    let score = 0;
    for (const o of kickOnsets) {
      const rel = (((o.time - phase) % beat) + beat) % beat;
      const dist = Math.min(rel, beat - rel);
      score += o.strength * Math.exp(-(dist * dist) / (2 * sigma * sigma));
    }
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }
  return bestPhase;
}

// ---------------------------------------------------------------------------
// Web Audio glue (browser only).
// ---------------------------------------------------------------------------

function getOfflineCtx(length: number, sampleRate: number): OfflineAudioContext {
  const OAC =
    (window.OfflineAudioContext as typeof OfflineAudioContext | undefined) ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  return new OAC(1, length, sampleRate);
}

/** Decode a fetched preview (mp3) ArrayBuffer into an AudioBuffer. */
export async function decodePreview(data: ArrayBuffer): Promise<AudioBuffer> {
  const AC =
    (window.AudioContext as typeof AudioContext | undefined) ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    return await ctx.decodeAudioData(data.slice(0));
  } finally {
    void ctx.close();
  }
}

function toMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0).slice();
  const mono = new Float32Array(buf.length);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < data.length; i++) mono[i] += data[i] / buf.numberOfChannels;
  }
  return mono;
}

async function renderBand(
  mono: Float32Array,
  sampleRate: number,
  filter: { type: BiquadFilterType; freq: number; Q?: number },
): Promise<Float32Array> {
  const oc = getOfflineCtx(mono.length, sampleRate);
  const buf = oc.createBuffer(1, mono.length, sampleRate);
  buf.getChannelData(0).set(mono);
  const src = oc.createBufferSource();
  src.buffer = buf;
  const biquad = oc.createBiquadFilter();
  biquad.type = filter.type;
  biquad.frequency.value = filter.freq;
  if (filter.Q != null) biquad.Q.value = filter.Q;
  src.connect(biquad).connect(oc.destination);
  src.start();
  const rendered = await oc.startRendering();
  return rendered.getChannelData(0);
}

function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

const HOP = 512;
const WIN = 1024;

/**
 * Analyze a decoded preview into tempo, downbeat phase, brightness/energy, and
 * a drums-only 16-step pattern. `bpmHint` (Deezer's value) is trusted when sane;
 * we only autocorrelate the onset envelope when it's missing/implausible.
 */
export async function analyzePreview(
  buf: AudioBuffer,
  opts: { bpmHint?: number | null } = {},
): Promise<PreviewFeatures> {
  const sr = buf.sampleRate;
  const mono = toMono(buf);
  const hopSec = HOP / sr;

  const [low, mid, high] = await Promise.all([
    renderBand(mono, sr, { type: "lowpass", freq: 120 }),
    renderBand(mono, sr, { type: "bandpass", freq: 1500, Q: 0.6 }),
    renderBand(mono, sr, { type: "highpass", freq: 7000 }),
  ]);

  const lowFlux = fluxEnvelope(energyEnvelope(low, HOP, WIN));
  const midFlux = fluxEnvelope(energyEnvelope(mid, HOP, WIN));
  const highFlux = fluxEnvelope(energyEnvelope(high, HOP, WIN));

  const kickOnsets = pickOnsets(lowFlux, hopSec, { k: 1.5 });
  const snareOnsets = pickOnsets(midFlux, hopSec, { k: 1.7 });
  const hatOnsets = pickOnsets(highFlux, hopSec, { k: 1.8, refractoryHops: 3 });

  // Tempo: trust the Deezer hint when plausible; else autocorrelate.
  let bpm = opts.bpmHint && opts.bpmHint >= 60 && opts.bpmHint <= 200 ? opts.bpmHint : 0;
  if (!bpm) {
    const combined = new Float32Array(lowFlux.length);
    for (let i = 0; i < combined.length; i++)
      combined[i] = lowFlux[i] + midFlux[i] + (highFlux[i] ?? 0);
    bpm = detectBpm(combined, hopSec);
    // Fold to a musical range to dodge half/double-time errors.
    while (bpm < 80) bpm *= 2;
    while (bpm > 160) bpm /= 2;
  }
  bpm = Math.round(bpm);

  const beat0Sec = detectBeat0(kickOnsets, bpm);
  const { pattern, confidence } = buildDrumPattern(
    { kick: kickOnsets, snare: snareOnsets, hat: hatOnsets },
    bpm,
    beat0Sec,
  );

  // Rough overall descriptors to ground the LLM profile (1-10).
  const lowE = rms(low);
  const midE = rms(mid);
  const highE = rms(high);
  const totalE = lowE + midE + highE + 1e-9;
  const brightness = Math.max(1, Math.min(10, Math.round((highE / totalE) * 40) + 1));
  const energy = Math.max(1, Math.min(10, Math.round(rms(mono) * 60)));

  return { bpm, beat0Sec, brightness, energy, drumPattern: pattern, perVoiceConfidence: confidence };
}
