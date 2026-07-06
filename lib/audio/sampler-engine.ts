import * as Tone from "tone";

export interface EnsembleVoiceSpec {
  id: string;
  url: string;
  baseNote?: string;
}

/**
 * Polyphonic, pitched playback for a matched "ensemble" — one Tone.Sampler per
 * voice, each holding the matched library sample at a base note so it plays
 * chromatically. Tone.js is already a dependency (dj-engine, tone-chain);
 * Tone.Sampler gives transposition + velocity for free, so the looper gets a
 * playable melodic surface without hand-rolled pitch shifting.
 */
export class SamplerEngine {
  private samplers = new Map<string, Tone.Sampler>();
  private started = false;

  /** Resume the AudioContext — must run from a user gesture before playback. */
  async ensureStarted(): Promise<void> {
    if (!this.started) {
      await Tone.start();
      this.started = true;
    }
  }

  /** Load (replacing all) the voice set. Resilient: a failed sample is skipped. */
  async loadVoices(voices: EnsembleVoiceSpec[]): Promise<void> {
    this.dispose();
    await Promise.allSettled(voices.map((v) => this.loadVoice(v.id, v.url, v.baseNote)));
  }

  /** Load or replace one voice (used for alternative-sample swaps). */
  loadVoice(id: string, url: string, baseNote = "C4"): Promise<void> {
    this.samplers.get(id)?.dispose();
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      const sampler = new Tone.Sampler({
        urls: { [baseNote]: url },
        onload: done,
        onerror: done,
      }).toDestination();
      this.samplers.set(id, sampler);
      // Safety net: never hang the ensemble on a stuck fetch.
      setTimeout(done, 8000);
    });
  }

  async trigger(id: string, note = "C4", velocity = 0.9, duration = "8n"): Promise<void> {
    await this.ensureStarted();
    const sampler = this.samplers.get(id);
    if (!sampler || sampler.disposed) return;
    sampler.triggerAttackRelease(note, duration, undefined, velocity);
  }

  has(id: string): boolean {
    return this.samplers.has(id);
  }

  dispose(): void {
    for (const s of this.samplers.values()) s.dispose();
    this.samplers.clear();
  }
}
