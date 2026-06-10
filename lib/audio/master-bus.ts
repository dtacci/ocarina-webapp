/**
 * Shared mixing foundation for multi-source playback surfaces (DJ decks,
 * track-editor mixer). One master output per surface; N channels feed it.
 *
 * Topology per channel:
 *   Tone.Player → [EffectNode stages] → Tone.Panner → fader Gain → mute Gain
 *     → Tone.Analyser (pass-through, feeds peak-meter.tsx) → bus master
 *
 * Master: Gain → Analyser → Tone.Destination.
 *
 * Rules of the house:
 *  - Every audible level change goes through `.rampTo(v, ~50ms)` — instant
 *    `.value =` sets click.
 *  - Channels reuse the sample editor's chain code (chain-stages.ts), so the
 *    same EffectNode[] vocabulary works here, with the same zero-glitch
 *    param-patch / structural-rebuild semantics.
 *  - `Tone.Player` (not ToneBufferSource) because mixer channels need
 *    seek/restart/playbackRate; one-shot sources can't.
 */
import * as Tone from "tone";
import type { EffectNode } from "./editor-types";
import {
  buildEffectNodes,
  isStructurallyEqual,
  patchStage,
  wireChain,
  type ChainStage,
} from "./chain-stages";

const RAMP_SEC = 0.05;

export interface MixChannelOptions {
  chain?: EffectNode[];
  /** Linear fader 0..~1.5 (default 1). */
  volume?: number;
  /** -1 (L) .. 1 (R). Default 0. */
  pan?: number;
  muted?: boolean;
}

export interface MixChannel {
  player: Tone.Player;
  /**
   * Strip entry point (pre-effects). The default player feeds it; arrangement
   * playback connects per-clip sources here so clips inherit the channel's
   * chain, pan, fader, and mute.
   */
  input: Tone.Gain;
  /** Post-fader, pre-master meter tap. */
  analyser: Tone.Analyser;
  setVolume: (v: number) => void;
  setPan: (p: number) => void;
  setMuted: (m: boolean) => void;
  /** Same semantics as RealtimeController.updateChain (patch or rebuild). */
  updateChain: (chain: EffectNode[]) => Promise<void>;
  dispose: () => void;
}

export interface MixBus {
  master: Tone.Gain;
  masterAnalyser: Tone.Analyser;
  setMasterVolume: (v: number) => void;
  addChannel: (buffer: AudioBuffer, opts?: MixChannelOptions) => Promise<MixChannel>;
  dispose: () => void;
}

export function createMixBus(): MixBus {
  const master = new Tone.Gain(1);
  const masterAnalyser = new Tone.Analyser("waveform", 512);
  master.connect(masterAnalyser);
  masterAnalyser.toDestination();

  const channels = new Set<MixChannel>();

  async function addChannel(
    buffer: AudioBuffer,
    opts: MixChannelOptions = {},
  ): Promise<MixChannel> {
    const toneBuffer = new Tone.ToneAudioBuffer();
    toneBuffer.set(buffer);
    const player = new Tone.Player(toneBuffer);
    const input = new Tone.Gain(1);
    const panner = new Tone.Panner(opts.pan ?? 0);
    const fader = new Tone.Gain(opts.volume ?? 1);
    const mute = new Tone.Gain(opts.muted ? 0 : 1);
    const analyser = new Tone.Analyser("waveform", 512);

    let currentChain: EffectNode[] = opts.chain ?? [];
    let built = await buildEffectNodes(currentChain);
    let stages: ChainStage[] = built.stages;

    const wire = () => {
      player.connect(input);
      wireChain(input, stages, panner);
      panner.connect(fader);
      fader.connect(mute);
      mute.connect(analyser);
      analyser.connect(master);
    };
    wire();

    // Serialize structural rebuilds; last submitted chain wins.
    let updating: Promise<void> = Promise.resolve();

    const channel: MixChannel = {
      player,
      input,
      analyser,
      setVolume: (v) => fader.gain.rampTo(Math.max(0, v), RAMP_SEC),
      setPan: (p) => panner.pan.rampTo(Math.max(-1, Math.min(1, p)), RAMP_SEC),
      setMuted: (m) => mute.gain.rampTo(m ? 0 : 1, RAMP_SEC),
      updateChain: (newChain) => {
        updating = updating.then(async () => {
          if (isStructurallyEqual(currentChain, newChain)) {
            let si = 0;
            for (const entry of newChain) {
              if (!entry.enabled || entry.kind === "trim" || entry.kind === "fade") continue;
              const stage = stages[si++];
              if (stage) patchStage(entry, stage);
            }
          } else {
            input.disconnect();
            for (const s of stages) s.output.disconnect();
            built.dispose();
            built = await buildEffectNodes(newChain);
            stages = built.stages;
            wireChain(input, stages, panner);
          }
          currentChain = newChain;
        });
        return updating;
      },
      dispose: () => {
        try { player.stop(); } catch { /* not started */ }
        player.dispose();
        input.dispose();
        built.dispose();
        panner.dispose();
        fader.dispose();
        mute.dispose();
        analyser.dispose();
        channels.delete(channel);
      },
    };
    channels.add(channel);
    return channel;
  }

  return {
    master,
    masterAnalyser,
    setMasterVolume: (v) => master.gain.rampTo(Math.max(0, v), RAMP_SEC),
    addChannel,
    dispose: () => {
      for (const ch of [...channels]) ch.dispose();
      master.dispose();
      masterAnalyser.dispose();
    },
  };
}
