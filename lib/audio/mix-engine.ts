/**
 * Track-editor playback engine: N looper stems through master-bus channels,
 * started on one shared timestamp so they stay phase-locked the way they
 * were recorded. Stems loop at their own length (Pi track lengths are
 * multiples of the master loop, so they re-align every master cycle).
 *
 * Solo semantics: any solo active → every non-soloed channel is silenced
 * (via the channel's mute gain ramp); explicit per-channel mutes stack.
 */
import * as Tone from "tone";
import { createMixBus, type MixBus, type MixChannel } from "./master-bus";
import type { MixChannelSpec, SessionMixDoc } from "./mix-types";
import type { EffectNode } from "./editor-types";

export interface MixStem {
  recordingId: string;
  buffer: AudioBuffer;
}

export interface MixEngine {
  play: () => Promise<void>;
  stop: () => void;
  isPlaying: () => boolean;
  /** Seconds since play started (master timeline, not per-stem loop). */
  position: () => number;
  durationSec: number;
  /** Volume / pan / mute / solo updates; solo recomputes the whole matrix. */
  applyChannel: (recordingId: string, spec: MixChannelSpec, allSpecs: MixChannelSpec[]) => void;
  updateChainFor: (recordingId: string, chain: EffectNode[]) => Promise<void>;
  channelAnalyser: (recordingId: string) => Tone.Analyser | null;
  masterAnalyser: Tone.Analyser;
  setMasterVolume: (v: number) => void;
  dispose: () => void;
}

export async function createMixEngine(
  stems: MixStem[],
  doc: SessionMixDoc,
): Promise<MixEngine> {
  const bus: MixBus = createMixBus();
  const channels = new Map<string, MixChannel>();

  const specFor = (id: string) => doc.channels.find((c) => c.recordingId === id);

  for (const stem of stems) {
    const spec = specFor(stem.recordingId);
    const ch = await bus.addChannel(stem.buffer, {
      chain: spec?.chain ?? [],
      volume: spec?.volume ?? 1,
      pan: spec?.pan ?? 0,
      muted: spec?.muted ?? false,
    });
    ch.player.loop = true;
    channels.set(stem.recordingId, ch);
  }
  bus.setMasterVolume(doc.master.volume ?? 1);

  const anySolo = (specs: MixChannelSpec[]) => specs.some((c) => c.soloed);
  const effectiveMuted = (spec: MixChannelSpec, specs: MixChannelSpec[]) =>
    spec.muted || (anySolo(specs) && !spec.soloed);

  // Apply initial solo matrix (addChannel only saw raw mutes).
  for (const spec of doc.channels) {
    channels.get(spec.recordingId)?.setMuted(effectiveMuted(spec, doc.channels));
  }

  let playing = false;
  let startedAtCtx = 0;
  const durationSec = stems.reduce((m, s) => Math.max(m, s.buffer.duration), 0);

  return {
    async play() {
      if (playing) return;
      await Tone.start();
      // One shared timestamp keeps the stems phase-locked.
      const t = Tone.now() + 0.1;
      for (const ch of channels.values()) ch.player.start(t, 0);
      startedAtCtx = t;
      playing = true;
    },

    stop() {
      if (!playing) return;
      for (const ch of channels.values()) {
        try { ch.player.stop(); } catch { /* not started */ }
      }
      playing = false;
    },

    isPlaying: () => playing,

    position: () => (playing ? Math.max(0, Tone.now() - startedAtCtx) : 0),

    durationSec,

    applyChannel(recordingId, spec, allSpecs) {
      const ch = channels.get(recordingId);
      if (!ch) return;
      ch.setVolume(spec.volume);
      ch.setPan(spec.pan);
      // Solo state affects EVERY channel's effective mute.
      for (const s of allSpecs) {
        channels.get(s.recordingId)?.setMuted(effectiveMuted(s, allSpecs));
      }
    },

    updateChainFor(recordingId, chain) {
      return channels.get(recordingId)?.updateChain(chain) ?? Promise.resolve();
    },

    channelAnalyser: (recordingId) => channels.get(recordingId)?.analyser ?? null,

    masterAnalyser: bus.masterAnalyser,
    setMasterVolume: bus.setMasterVolume,

    dispose() {
      bus.dispose();
      channels.clear();
    },
  };
}
