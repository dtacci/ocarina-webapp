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
  /**
   * The first (or only) source. Kept for state reads; callers should use
   * `onNaturalEnd` rather than `source.onended` so loop mode stays silent
   * (the first source ends mid-loop as part of the ping-pong crossfade).
   */
  source: Tone.ToneBufferSource;
  /** Analyser node wired post-chain for peak metering. */
  analyser: Tone.Analyser;
  /**
   * Fires when non-loop playback finishes naturally (source.onended).
   * Never fires when `loop: true` was passed to `playRealtime`.
   */
  onNaturalEnd: (cb: () => void) => void;
}

/**
 * Loop-boundary crossfade duration, in seconds. Always-on, inaudible,
 * eliminates clicks at loop seams. When the loop region is too short to
 * accommodate two of these (< 30 ms), we fall back to a hard loop.
 */
const LOOP_XFADE_SEC = 0.015;

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
      case "compressor": {
        const comp = new Tone.Compressor({
          threshold: node.threshold,
          ratio: node.ratio,
          attack: node.attack,
          release: node.release,
          knee: node.knee,
        });
        nodes.push(comp);
        if (node.makeup !== 0) {
          nodes.push(new Tone.Gain(node.makeup, "decibels"));
        }
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
 *
 * Loop mode uses a ping-pong of scheduled sources with a 15 ms crossfade at
 * each seam — the single Tone.ToneBufferSource.loop flag doesn't support
 * per-loop fade, so we schedule an alternating source (loopDur - XFADE)
 * seconds after each one starts, each with fadeIn/fadeOut = XFADE. On very
 * short loops (< 30 ms) we fall back to a hard loop.
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
  const trimStart = trim?.enabled ? trim.startSec : 0;
  const trimEnd = trim?.enabled ? trim.endSec : buffer.duration;
  const offset = startAt ?? trimStart;
  const loopDuration = Math.max(0.001, trimEnd - trimStart);
  const userFadeInSec = fade?.enabled ? Math.max(0, fade.inMs / 1000) : 0;
  const userFadeOutSec = fade?.enabled ? Math.max(0, fade.outMs / 1000) : 0;
  const userFadeCurve: "linear" | "exponential" =
    fade?.enabled && fade.curve === "exp" ? "exponential" : "linear";

  const analyser = new Tone.Analyser("waveform", 512);
  const destination = Tone.getDestination();

  let disposeEffects: () => void = () => {};
  let chainHead: Tone.ToneAudioNode = analyser;
  if (bypass) {
    // A|B = A: straight through, skip all effects.
    analyser.connect(destination);
  } else {
    const built = await buildEffectNodes(chain);
    disposeEffects = built.dispose;
    if (built.nodes.length > 0) {
      // Wire built nodes in series, last → analyser. Each scheduled source
      // then only needs to connect to chainHead (the first node or analyser).
      for (let i = 0; i < built.nodes.length - 1; i++) {
        built.nodes[i].connect(built.nodes[i + 1]);
      }
      built.nodes[built.nodes.length - 1].connect(analyser);
      chainHead = built.nodes[0];
    }
    analyser.connect(destination);
  }

  // Track every scheduled/active source so stop() can tear them all down.
  const activeSources = new Set<Tone.ToneBufferSource>();
  let naturalEndCallback: (() => void) | null = null;
  let stopped = false;
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  function makeSource(
    startAudioTime: number,
    playOffset: number,
    playDuration: number,
    fadeInSec: number,
    fadeOutSec: number,
    curve: "linear" | "exponential",
  ): Tone.ToneBufferSource {
    const s = new Tone.ToneBufferSource(sourceBuffer);
    s.fadeIn = fadeInSec;
    s.fadeOut = fadeOutSec;
    s.curve = curve;
    s.connect(chainHead);
    s.start(startAudioTime, playOffset, playDuration);
    activeSources.add(s);
    return s;
  }

  // First (primary) source — playhead reads from this one for state.
  let primarySource: Tone.ToneBufferSource;

  if (!loop) {
    // Single-shot playback.
    const duration = Math.max(0.001, trimEnd - offset);
    primarySource = makeSource(
      Tone.now(),
      offset,
      duration,
      userFadeInSec,
      userFadeOutSec,
      userFadeCurve,
    );
    primarySource.onended = () => {
      activeSources.delete(primarySource);
      try {
        primarySource.dispose();
      } catch {
        // already disposed
      }
      naturalEndCallback?.();
    };
  } else if (loopDuration < LOOP_XFADE_SEC * 2) {
    // Loop region too short to crossfade — fall back to a hard loop.
    const s = new Tone.ToneBufferSource(sourceBuffer);
    s.fadeIn = userFadeInSec;
    s.fadeOut = userFadeOutSec;
    s.curve = userFadeCurve;
    s.loop = true;
    s.loopStart = trimStart;
    s.loopEnd = trimEnd;
    s.connect(chainHead);
    s.start(Tone.now(), offset);
    activeSources.add(s);
    primarySource = s;
  } else {
    // Loop with crossfade: alternating sources with 15 ms overlap at seams.
    // Each source plays `loopDuration + XFADE` seconds (slightly past the
    // loop end so the out-fade tail overlaps the next source's in-fade).
    // Sources start every `loopDuration - XFADE` seconds.
    const xfade = LOOP_XFADE_SEC;
    const stride = loopDuration - xfade;

    // Source N=0 starts at offset (which may be mid-loop) and plays until
    // trimEnd + XFADE; subsequent sources always start at trimStart.
    const firstPlayOffset = offset;
    const firstPlayDur = Math.max(0.001, trimEnd - firstPlayOffset) + xfade;
    primarySource = makeSource(
      Tone.now(),
      firstPlayOffset,
      firstPlayDur,
      // Use the user's fade-in on the first source; subsequent seams get XFADE.
      userFadeInSec,
      xfade,
      userFadeCurve,
    );
    primarySource.onended = () => {
      activeSources.delete(primarySource);
      try {
        primarySource.dispose();
      } catch {
        // already disposed
      }
    };

    // Schedule the second source (N=1) to start `stride` seconds after N=0's
    // start — which is when the next seam begins. For subsequent sources we
    // use startOfPreviousLoop + stride, so each seam lines up.
    const secondStartAudio =
      Tone.now() + Math.max(0.001, firstPlayOffset === trimStart ? stride : trimEnd - firstPlayOffset - xfade);

    function scheduleNext(startAudioTime: number) {
      if (stopped) return;
      const s = makeSource(
        startAudioTime,
        trimStart,
        loopDuration + xfade,
        xfade,
        xfade,
        "linear",
      );
      s.onended = () => {
        activeSources.delete(s);
        try {
          s.dispose();
        } catch {
          // already disposed
        }
      };
      // Queue the creation of the source AFTER this one. We do this a few ms
      // ahead of its intended audio start so there's always a primed source
      // ready to go. setTimeout precision doesn't affect audio quality —
      // audio start times are sample-accurate (Tone.now()-based).
      const nextAudioTime = startAudioTime + stride;
      const msAhead = Math.max(0, (nextAudioTime - Tone.now() - xfade * 3) * 1000);
      const t = setTimeout(() => {
        pendingTimers.delete(t);
        scheduleNext(nextAudioTime);
      }, msAhead);
      pendingTimers.add(t);
    }

    scheduleNext(secondStartAudio);
  }

  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const t of pendingTimers) clearTimeout(t);
    pendingTimers.clear();
    for (const s of activeSources) {
      try {
        s.stop();
      } catch {
        // already stopped — ignore
      }
      try {
        s.dispose();
      } catch {
        // already disposed — ignore
      }
    }
    activeSources.clear();
    analyser.dispose();
    disposeEffects();
    sourceBuffer.dispose();
  };

  return {
    source: primarySource,
    analyser,
    stop,
    onNaturalEnd: (cb) => {
      naturalEndCallback = cb;
    },
  };
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
