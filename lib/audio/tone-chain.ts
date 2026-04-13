/**
 * Builds a Tone.js effect graph from the editor's EffectNode[] chain.
 *
 * Two entry points:
 *   - `playRealtime` — creates a one-shot ToneBufferSource, starts playback,
 *     returns a controller with `.stop()` that cleans up all nodes.
 *   - `renderOffline` — runs the same graph in Tone.Offline and returns
 *     a native AudioBuffer suitable for WAV encoding.
 *
 * Trim + fade + loop are applied at the source level (ToneBufferSource args);
 * filter/pitch/reverb/gain are standalone Tone nodes chained in order.
 * A|B bypass routes source → destination directly, skipping everything.
 *
 * Reverb quirk: `Tone.Reverb.ready` is an async Promise that must resolve
 * before playback starts (IR is generated on-the-fly). We await it inside
 * both entry points.
 */
import * as Tone from "tone";
import type { EffectNode } from "./editor-types";

export interface RealtimeController {
  /** Stop playback and dispose all nodes. Safe to call multiple times. */
  stop: () => void;
  /** Underlying source, exposed for state reads (e.g. `source.state`). */
  source: Tone.ToneBufferSource;
  /** Analyser node wired post-chain for peak metering. */
  analyser: Tone.Analyser;
}

export interface PlayOptions {
  /** Loop the trimmed region. Default false. */
  loop?: boolean;
  /** Skip all effects (A|B bypass). Default false. */
  bypass?: boolean;
  /** Start position within the buffer, in seconds. Default 0 (or trim.startSec). */
  startAt?: number;
}

function toneBufferFromAudio(buffer: AudioBuffer): Tone.ToneAudioBuffer {
  const tb = new Tone.ToneAudioBuffer();
  tb.set(buffer);
  return tb;
}

function findNode<K extends EffectNode["kind"]>(
  chain: EffectNode[],
  kind: K,
): Extract<EffectNode, { kind: K }> | undefined {
  return chain.find((n) => n.kind === kind) as Extract<EffectNode, { kind: K }> | undefined;
}

/**
 * Build the effect-chain nodes (not including the source or destination).
 * Returns the ordered list of nodes + a disposer that releases them.
 *
 * Call site is responsible for connecting source → first node and
 * last node → destination.
 */
async function buildEffectNodes(chain: EffectNode[]): Promise<{
  nodes: Tone.ToneAudioNode[];
  dispose: () => void;
}> {
  const nodes: Tone.ToneAudioNode[] = [];

  for (const node of chain) {
    if (!node.enabled) continue;

    switch (node.kind) {
      case "filter": {
        const filterType =
          node.mode === "hp" ? "highpass" : node.mode === "lp" ? "lowpass" : "bandpass";
        const filter = new Tone.Filter({
          type: filterType,
          frequency: node.freq,
          Q: node.q,
        });
        nodes.push(filter);
        break;
      }
      case "pitch": {
        const pitch = new Tone.PitchShift({ pitch: node.semitones });
        nodes.push(pitch);
        break;
      }
      case "reverb": {
        const reverb = new Tone.Reverb({ decay: node.decaySec, wet: node.wet });
        // Reverb IR is generated async — must resolve before audio is routed.
        await reverb.ready;
        nodes.push(reverb);
        break;
      }
      case "gain": {
        const gain = new Tone.Gain(node.db, "decibels");
        nodes.push(gain);
        break;
      }
      // trim + fade are handled at source level, not as nodes
      case "trim":
      case "fade":
        break;
    }
  }

  return {
    nodes,
    dispose: () => {
      for (const n of nodes) n.dispose();
    },
  };
}

/** Chain source through an ordered node list into a destination. */
function wireChain(
  source: Tone.ToneAudioNode,
  nodes: Tone.ToneAudioNode[],
  destination: Tone.ToneAudioNode,
): void {
  if (nodes.length === 0) {
    source.connect(destination);
    return;
  }
  source.connect(nodes[0]);
  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i].connect(nodes[i + 1]);
  }
  nodes[nodes.length - 1].connect(destination);
}

/**
 * Start realtime playback of `buffer` through the effect chain.
 * Returns a controller; call `.stop()` to cease playback and free nodes.
 */
export async function playRealtime(
  buffer: AudioBuffer,
  chain: EffectNode[],
  options: PlayOptions = {},
): Promise<RealtimeController> {
  // Ensure the audio context is running (browsers block it until user gesture).
  await Tone.start();

  const trim = findNode(chain, "trim");
  const fade = findNode(chain, "fade");
  const { loop = false, bypass = false, startAt } = options;

  const sourceBuffer = toneBufferFromAudio(buffer);
  const source = new Tone.ToneBufferSource(sourceBuffer);

  const trimStart = trim?.enabled ? trim.startSec : 0;
  const trimEnd = trim?.enabled ? trim.endSec : buffer.duration;
  const offset = startAt ?? trimStart;
  const duration = Math.max(0.001, trimEnd - offset);

  if (fade?.enabled) {
    source.fadeIn = Math.max(0, fade.inMs / 1000);
    source.fadeOut = Math.max(0, fade.outMs / 1000);
    source.curve = fade.curve === "exp" ? "exponential" : "linear";
  }

  if (loop) {
    source.loop = true;
    source.loopStart = trimStart;
    source.loopEnd = trimEnd;
  }

  const analyser = new Tone.Analyser("waveform", 512);
  const destination = Tone.getDestination();

  let disposeEffects: () => void = () => {};

  if (bypass) {
    // A|B = A: straight through, skip all effects.
    wireChain(source, [], analyser);
  } else {
    const built = await buildEffectNodes(chain);
    disposeEffects = built.dispose;
    wireChain(source, built.nodes, analyser);
  }
  analyser.connect(destination);

  source.start(Tone.now(), offset, duration);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      source.stop();
    } catch {
      // already stopped — ignore
    }
    source.dispose();
    analyser.dispose();
    disposeEffects();
    sourceBuffer.dispose();
  };

  // Auto-clean when playback ends naturally (non-loop).
  source.onended = () => {
    if (!loop) stop();
  };

  return { source, analyser, stop };
}

/**
 * Offline-render the chain into a native AudioBuffer.
 * Used by the save flow: render → encode WAV → upload.
 */
export async function renderOffline(
  buffer: AudioBuffer,
  chain: EffectNode[],
): Promise<AudioBuffer> {
  const trim = findNode(chain, "trim");
  const fade = findNode(chain, "fade");

  const trimStart = trim?.enabled ? trim.startSec : 0;
  const trimEnd = trim?.enabled ? trim.endSec : buffer.duration;
  const duration = Math.max(0.001, trimEnd - trimStart);

  const channels = Math.max(1, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;

  const rendered = await Tone.Offline(
    async () => {
      const sourceBuffer = toneBufferFromAudio(buffer);
      const source = new Tone.ToneBufferSource(sourceBuffer);

      if (fade?.enabled) {
        source.fadeIn = Math.max(0, fade.inMs / 1000);
        source.fadeOut = Math.max(0, fade.outMs / 1000);
        source.curve = fade.curve === "exp" ? "exponential" : "linear";
      }

      const { nodes } = await buildEffectNodes(chain);
      wireChain(source, nodes, Tone.getDestination());

      // Inside Tone.Offline, time 0 is the start of the render.
      source.start(0, trimStart, duration);
    },
    duration,
    channels,
    sampleRate,
  );

  return rendered.get()!;
}
