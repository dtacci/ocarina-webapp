import {
  KitManifest,
  LoadedVoice,
  SynthVoiceKind,
  VOICE_COUNT,
} from "./drum-kit-manifest";

export type Velocity = 0 | 1 | 2;
export interface Step {
  on: boolean;
  velocity: Velocity;
}
export type VoiceRow = Step[]; // length 16
export type Pattern = VoiceRow[]; // length VOICE_COUNT

const STEPS_PER_PATTERN = 16;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.1;
const VELOCITY_GAIN: Record<Velocity, number> = { 0: 0.4, 1: 0.7, 2: 1.0 };

export type StepListener = (step: number, audioTime: number) => void;

export class DrumEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices: LoadedVoice[] = [];
  private pattern: Pattern = emptyPattern();
  private bpm = 120;
  private mutes: boolean[] = new Array(VOICE_COUNT).fill(false);
  private nextStepIndex = 0;
  private nextNoteTime = 0;
  private running = false;
  private timerId: number | null = null;
  private stepListeners = new Set<StepListener>();
  private anchorBeatTime: number | null = null;

  isRunning(): boolean {
    return this.running;
  }

  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AC =
        (window.AudioContext as typeof AudioContext | undefined) ??
        ((window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext as typeof AudioContext);
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  async loadKit(manifest: KitManifest): Promise<void> {
    const ctx = await this.ensureContext();
    if (manifest.kind === "synth") {
      this.voices = manifest.voices.map((v) => ({
        name: v.name,
        type: "synth" as const,
        synthVoice: v.name as SynthVoiceKind,
      }));
      return;
    }
    const loaded: LoadedVoice[] = [];
    for (const v of manifest.voices) {
      try {
        const res = await fetch(v.file);
        if (!res.ok) throw new Error(`Failed to fetch ${v.file}`);
        const arr = await res.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arr);
        loaded.push({ name: v.name, type: "sample", buffer });
      } catch (err) {
        console.warn(`[DrumEngine] Voice ${v.name} missing, falling back to synth:`, err);
        loaded.push({
          name: v.name,
          type: "synth",
          synthVoice: v.name as SynthVoiceKind,
        });
      }
    }
    this.voices = loaded;
  }

  setPattern(pattern: Pattern): void {
    this.pattern = pattern;
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  setMutes(mutes: boolean[]): void {
    this.mutes = mutes.slice();
  }

  // Called when looper broadcasts BPM + phase. Aligns the drum grid so
  // step 0 of the drum pattern lands on beat 0 of the looper cycle.
  // beat0AudioTime: AudioContext.currentTime value at which beat 0 occurs.
  anchorToLooper(bpm: number, beat0AudioTime: number): void {
    this.bpm = bpm;
    this.anchorBeatTime = beat0AudioTime;
    if (this.running && this.ctx) {
      // Soft re-anchor: snap nextNoteTime to the nearest upcoming 16th on the grid.
      const sixteenth = 60 / bpm / 4;
      const now = this.ctx.currentTime;
      const elapsed = now - beat0AudioTime;
      const nextSixteenthIdx = Math.ceil(elapsed / sixteenth);
      const proposed = beat0AudioTime + nextSixteenthIdx * sixteenth;
      // Only re-anchor if drift is audible (> 30ms) to avoid clicky micro-corrections.
      if (Math.abs(proposed - this.nextNoteTime) > 0.03) {
        this.nextNoteTime = proposed;
        this.nextStepIndex = ((nextSixteenthIdx % STEPS_PER_PATTERN) + STEPS_PER_PATTERN) % STEPS_PER_PATTERN;
      }
    }
  }

  start(): void {
    if (this.running || !this.ctx) return;
    this.running = true;
    this.nextStepIndex = 0;
    this.nextNoteTime = this.anchorBeatTime ?? this.ctx.currentTime + 0.05;
    this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  onStep(listener: StepListener): () => void {
    this.stepListeners.add(listener);
    return () => {
      this.stepListeners.delete(listener);
    };
  }

  dispose(): void {
    this.stop();
    this.stepListeners.clear();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.master = null;
    }
  }

  // Chris Wilson's "A Tale of Two Clocks" scheduler pattern.
  private tick = (): void => {
    if (!this.running || !this.ctx) return;
    const horizon = this.ctx.currentTime + SCHEDULE_AHEAD_SEC;
    while (this.nextNoteTime < horizon) {
      this.scheduleStep(this.nextStepIndex, this.nextNoteTime);
      const sixteenth = 60 / this.bpm / 4;
      this.nextNoteTime += sixteenth;
      this.nextStepIndex = (this.nextStepIndex + 1) % STEPS_PER_PATTERN;
    }
    this.timerId = window.setTimeout(this.tick, LOOKAHEAD_MS);
  };

  private scheduleStep(stepIdx: number, when: number): void {
    // Notify listeners slightly before the step audibly fires, so UI can
    // animate the playhead in sync. Use the actual audio time.
    for (const l of this.stepListeners) {
      try {
        l(stepIdx, when);
      } catch {
        // listener errors shouldn't crash the scheduler
      }
    }
    for (let v = 0; v < this.voices.length; v++) {
      if (this.mutes[v]) continue;
      const row = this.pattern[v];
      const step = row?.[stepIdx];
      if (!step || !step.on) continue;
      this.triggerVoice(v, when, step.velocity);
    }
  }

  private triggerVoice(voiceIdx: number, when: number, velocity: Velocity): void {
    const voice = this.voices[voiceIdx];
    if (!voice || !this.ctx || !this.master) return;
    const gain = VELOCITY_GAIN[velocity];
    if (voice.type === "sample" && voice.buffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = voice.buffer;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(this.master);
      src.start(when);
      return;
    }
    if (voice.synthVoice) {
      synthesize(this.ctx, this.master, voice.synthVoice, when, gain);
    }
  }
}

function emptyPattern(): Pattern {
  return Array.from({ length: VOICE_COUNT }, () =>
    Array.from({ length: STEPS_PER_PATTERN }, () => ({ on: false, velocity: 1 as Velocity }))
  );
}

// ---- TR-808-ish synthesis ----------------------------------------------------
// Zero-sample fallback so the drum machine works out of the box. Not a faithful
// 808 clone — just serviceable drum voices built from WebAudio primitives.

function synthesize(
  ctx: AudioContext,
  dest: AudioNode,
  kind: SynthVoiceKind,
  when: number,
  gain: number
): void {
  switch (kind) {
    case "kick":
      return synthKick(ctx, dest, when, gain);
    case "snare":
      return synthSnare(ctx, dest, when, gain);
    case "clap":
      return synthClap(ctx, dest, when, gain);
    case "c-hat":
      return synthHat(ctx, dest, when, gain, 0.05);
    case "o-hat":
      return synthHat(ctx, dest, when, gain, 0.3);
    case "low-tom":
      return synthTom(ctx, dest, when, gain, 80);
    case "mid-tom":
      return synthTom(ctx, dest, when, gain, 140);
    case "hi-tom":
      return synthTom(ctx, dest, when, gain, 220);
  }
}

function synthKick(ctx: AudioContext, dest: AudioNode, when: number, gain: number): void {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, when);
  osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(gain, when + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.4);
  osc.connect(amp).connect(dest);
  osc.start(when);
  osc.stop(when + 0.45);
}

function synthSnare(ctx: AudioContext, dest: AudioNode, when: number, gain: number): void {
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1800;
  bp.Q.value = 0.8;
  const noiseAmp = ctx.createGain();
  noiseAmp.gain.setValueAtTime(0.0001, when);
  noiseAmp.gain.exponentialRampToValueAtTime(gain * 0.8, when + 0.003);
  noiseAmp.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
  noise.connect(bp).connect(noiseAmp).connect(dest);
  noise.start(when);
  noise.stop(when + 0.2);

  const tone = ctx.createOscillator();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(180, when);
  const toneAmp = ctx.createGain();
  toneAmp.gain.setValueAtTime(0.0001, when);
  toneAmp.gain.exponentialRampToValueAtTime(gain * 0.5, when + 0.003);
  toneAmp.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
  tone.connect(toneAmp).connect(dest);
  tone.start(when);
  tone.stop(when + 0.1);
}

function synthClap(ctx: AudioContext, dest: AudioNode, when: number, gain: number): void {
  // Three quick noise bursts + one longer tail, classic clap trick.
  const bursts = [0, 0.01, 0.022];
  for (const offset of bursts) {
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1200;
    bp.Q.value = 1.2;
    const amp = ctx.createGain();
    const t = when + offset;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain * 0.7, t + 0.002);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    noise.connect(bp).connect(amp).connect(dest);
    noise.start(t);
    noise.stop(t + 0.05);
  }
  const tailNoise = ctx.createBufferSource();
  tailNoise.buffer = getNoiseBuffer(ctx);
  const tailBp = ctx.createBiquadFilter();
  tailBp.type = "bandpass";
  tailBp.frequency.value = 1400;
  tailBp.Q.value = 0.9;
  const tailAmp = ctx.createGain();
  const tStart = when + 0.03;
  tailAmp.gain.setValueAtTime(0.0001, tStart);
  tailAmp.gain.exponentialRampToValueAtTime(gain * 0.4, tStart + 0.005);
  tailAmp.gain.exponentialRampToValueAtTime(0.0001, tStart + 0.2);
  tailNoise.connect(tailBp).connect(tailAmp).connect(dest);
  tailNoise.start(tStart);
  tailNoise.stop(tStart + 0.22);
}

function synthHat(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  gain: number,
  decaySec: number
): void {
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(gain * 0.5, when + 0.002);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + decaySec);
  noise.connect(hp).connect(amp).connect(dest);
  noise.start(when);
  noise.stop(when + decaySec + 0.05);
}

function synthTom(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  gain: number,
  baseFreq: number
): void {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(baseFreq * 1.6, when);
  osc.frequency.exponentialRampToValueAtTime(baseFreq, when + 0.18);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(gain * 0.8, when + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.35);
  osc.connect(amp).connect(dest);
  osc.start(when);
  osc.stop(when + 0.4);
}

// Shared noise buffer — 1 second of white noise, reused for all noise voices.
let noiseBuffer: AudioBuffer | null = null;
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const sampleRate = ctx.sampleRate;
  const buf = ctx.createBuffer(1, sampleRate, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buf;
  return buf;
}
