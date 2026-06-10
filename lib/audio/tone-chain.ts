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
import {
  buildEffectNodes,
  isStructurallyEqual,
  patchStage,
  wireChain,
  type ChainStage,
} from "./chain-stages";

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
  /**
   * Push a new chain into the live graph without restarting playback.
   * - If the topology is identical (same kinds, same positions, same
   *   enabled flags), patches each stage's params in place — zero glitch.
   * - Otherwise tears down the effect graph and rebuilds it; sources keep
   *   playing and reconnect to the new chain head. Brief click possible.
   * - Returns the await-able promise for callers that need to know when
   *   async work (e.g. reverb IR regen) completes.
   */
  updateChain: (newChain: EffectNode[]) => Promise<void>;
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
  analyser.connect(destination);

  // Track every scheduled/active source so stop() can tear them all down,
  // and so updateChain() can re-route them onto a freshly-built effect graph.
  const activeSources = new Set<Tone.ToneBufferSource>();

  // Mutable chain state — rebuilt by updateChain on structural changes.
  let currentChain: EffectNode[] = chain;
  let currentStages: ChainStage[] = [];
  let disposeEffects: () => void = () => {};
  let chainHead: Tone.ToneAudioNode = analyser;

  /**
   * Wire a freshly-built stages list between any active sources and the
   * analyser. Mutates chainHead. Caller must have disposed the previous
   * graph + disconnected sources from the old chainHead first.
   */
  function installStages(stages: ChainStage[]) {
    currentStages = stages;
    if (stages.length === 0) {
      chainHead = analyser;
    } else {
      for (let i = 0; i < stages.length - 1; i++) {
        stages[i].output.connect(stages[i + 1].input);
      }
      stages[stages.length - 1].output.connect(analyser);
      chainHead = stages[0].input;
    }
    // Reconnect any in-flight sources to the new chain head.
    for (const s of activeSources) {
      try {
        s.connect(chainHead);
      } catch {
        // already disposed or already connected — fine
      }
    }
  }

  if (!bypass) {
    const built = await buildEffectNodes(chain);
    disposeEffects = built.dispose;
    installStages(built.stages);
  }
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

  /**
   * Live-update the effect chain without restarting playback. Bypass mode
   * (`A` switch) is locked at play start — it only affects whether effects
   * exist at all; toggle the switch to swap.
   *
   * Serialized: if a structural rebuild is already in flight, the latest
   * pending chain is stored and applied once the rebuild settles. Last
   * caller always wins.
   */
  let rebuildInFlight = false;
  let pendingChain: EffectNode[] | null = null;
  const updateChain = async (newChain: EffectNode[]): Promise<void> => {
    if (stopped || bypass) {
      currentChain = newChain;
      return;
    }
    if (rebuildInFlight) {
      pendingChain = newChain;
      return;
    }

    if (isStructurallyEqual(currentChain, newChain)) {
      // Pure param updates — patch each stage in place. Walk both chains in
      // parallel; only enabled entries occupy a stage slot.
      let stageIdx = 0;
      for (let i = 0; i < newChain.length; i++) {
        const entry = newChain[i];
        if (!entry.enabled) continue;
        // trim/fade don't occupy stage slots (handled at source level).
        if (entry.kind === "trim" || entry.kind === "fade") continue;
        const stage = currentStages[stageIdx];
        if (stage) patchStage(entry, stage);
        stageIdx++;
      }
      currentChain = newChain;
      return;
    }

    // Structural rebuild: disconnect sources from old chainHead, dispose old
    // graph, build new one, reconnect sources via installStages.
    rebuildInFlight = true;
    try {
      for (const s of activeSources) {
        try {
          s.disconnect();
        } catch {
          // already disconnected — fine
        }
      }
      try {
        // Disconnect the old chain tail from the analyser too.
        if (currentStages.length > 0) {
          currentStages[currentStages.length - 1].output.disconnect(analyser);
        }
      } catch {
        // already disconnected — fine
      }
      disposeEffects();
      currentStages = [];
      chainHead = analyser;

      const built = await buildEffectNodes(newChain);
      if (stopped) {
        // Playback stopped while we were async-building — discard.
        built.dispose();
        return;
      }
      disposeEffects = built.dispose;
      installStages(built.stages);
      currentChain = newChain;
    } finally {
      rebuildInFlight = false;
    }

    // If something else came in while we were rebuilding, apply it now.
    if (pendingChain) {
      const next = pendingChain;
      pendingChain = null;
      void updateChain(next);
    }
  };

  return {
    source: primarySource,
    analyser,
    stop,
    onNaturalEnd: (cb) => {
      naturalEndCallback = cb;
    },
    updateChain,
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

      const { stages } = await buildEffectNodes(chain);
      wireChain(source, stages, Tone.getDestination());

      // Inside Tone.Offline, time 0 is the start of the render.
      source.start(0, trimStart, duration);
    },
    duration,
    channels,
    sampleRate,
  );

  return rendered.get()!;
}
