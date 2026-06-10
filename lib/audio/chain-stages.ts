/**
 * Effect-chain stage construction shared by every Tone.js consumer in the app
 * (sample-editor realtime/offline playback via tone-chain.ts, the master-bus
 * mixer channels, DJ decks).
 *
 * The contract: `buildEffectNodes` turns an `EffectNode[]` into ordered
 * ChainStages; `wireChain` connects them between a source and a destination;
 * `isStructurallyEqual` decides whether a new chain can be applied with
 * in-place `patchStage` calls (zero glitch) or needs a structural rebuild.
 * Extracted from tone-chain.ts unchanged.
 */
import * as Tone from "tone";
import type { EffectNode } from "./editor-types";

/**
 * A single stage in the effect chain. For most effects `input === output`
 * (one node). Composite effects (e.g. harmony's parallel pitch branches)
 * expose distinct input + output gain nodes with internal wiring between.
 */
export interface ChainStage {
  input: Tone.ToneAudioNode;
  output: Tone.ToneAudioNode;
}

/**
 * Build the effect-chain stages (not including the source or destination).
 * Returns the ordered list of stages + a disposer that releases all created
 * nodes (including internal nodes of composite stages).
 *
 * Call site is responsible for connecting source → first stage's input
 * and last stage's output → destination.
 */
export async function buildEffectNodes(chain: EffectNode[]): Promise<{
  stages: ChainStage[];
  dispose: () => void;
}> {
  const stages: ChainStage[] = [];
  const owned: Tone.ToneAudioNode[] = [];
  const own = <T extends Tone.ToneAudioNode>(n: T): T => {
    owned.push(n);
    return n;
  };
  const single = (n: Tone.ToneAudioNode): ChainStage => ({ input: n, output: n });

  for (const node of chain) {
    if (!node.enabled) continue;

    switch (node.kind) {
      case "filter": {
        const filterType =
          node.mode === "hp" ? "highpass" : node.mode === "lp" ? "lowpass" : "bandpass";
        const filter = own(new Tone.Filter({
          type: filterType,
          frequency: node.freq,
          Q: node.q,
        }));
        stages.push(single(filter));
        break;
      }
      case "pitch": {
        const pitch = own(new Tone.PitchShift({ pitch: node.semitones }));
        stages.push(single(pitch));
        break;
      }
      case "reverb": {
        const reverb = own(new Tone.Reverb({ decay: node.decaySec, wet: node.wet }));
        // Reverb IR is generated async — must resolve before audio is routed.
        await reverb.ready;
        stages.push(single(reverb));
        break;
      }
      case "delay": {
        const delay = own(new Tone.FeedbackDelay({
          delayTime: node.timeSec,
          feedback: node.feedback,
          wet: node.wet,
        }));
        stages.push(single(delay));
        break;
      }
      case "harmony": {
        // Composite: input gain fans out to dry + 1-2 pitch-shifted voices,
        // each voice gain-summed into the output. Voice gain is wet/N so
        // the harmonies don't dominate the dry as more voices are added.
        //
        // PitchShift quality knobs:
        // - windowSize 0.25s: smoother on sustained tones (default 0.1 alias-buzzes
        //   on held notes; ocarina samples are mostly sustained).
        // - tiny delayTime offsets per voice (~7 ms apart) avoid phase-aligned
        //   overlap that makes stacked voices sound like one detuned blob.
        const inputGain = own(new Tone.Gain(1));
        const outputGain = own(new Tone.Gain(1));
        const dryGain = own(new Tone.Gain(1 - node.wet));
        inputGain.connect(dryGain);
        dryGain.connect(outputGain);

        const voices: number[] = [];
        if (node.voice1Semitones !== 0) voices.push(node.voice1Semitones);
        if (node.voice2Semitones !== 0) voices.push(node.voice2Semitones);

        if (voices.length > 0) {
          const voiceLevel = node.wet / voices.length;
          voices.forEach((semitones, idx) => {
            const shift = own(new Tone.PitchShift({
              pitch: semitones,
              windowSize: 0.25,
              delayTime: 0.007 * idx,
              feedback: 0,
              wet: 1,
            }));
            const voiceGain = own(new Tone.Gain(voiceLevel));
            inputGain.connect(shift);
            shift.connect(voiceGain);
            voiceGain.connect(outputGain);
          });
        }
        stages.push({ input: inputGain, output: outputGain });
        break;
      }
      case "gain": {
        const gain = own(new Tone.Gain(node.db, "decibels"));
        stages.push(single(gain));
        break;
      }
      case "compressor": {
        const comp = own(new Tone.Compressor({
          threshold: node.threshold,
          ratio: node.ratio,
          attack: node.attack,
          release: node.release,
          knee: node.knee,
        }));
        if (node.makeup !== 0) {
          const makeup = own(new Tone.Gain(node.makeup, "decibels"));
          comp.connect(makeup);
          stages.push({ input: comp, output: makeup });
        } else {
          stages.push(single(comp));
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
    stages,
    dispose: () => {
      for (const n of owned) n.dispose();
    },
  };
}

/** Chain source through an ordered list of stages into a destination. */
export function wireChain(
  source: Tone.ToneAudioNode,
  stages: ChainStage[],
  destination: Tone.ToneAudioNode,
): void {
  if (stages.length === 0) {
    source.connect(destination);
    return;
  }
  source.connect(stages[0].input);
  for (let i = 0; i < stages.length - 1; i++) {
    stages[i].output.connect(stages[i + 1].input);
  }
  stages[stages.length - 1].output.connect(destination);
}

/**
 * Returns true when `a` and `b` have the same chain topology — same length,
 * same kinds in same positions, same enabled flags — meaning we can patch
 * params in place rather than rebuild the graph.
 *
 * Harmony is the exception: its voice counts (voice1/voice2 == 0 toggles a
 * voice on/off) change the internal node count, so any harmony param change
 * forces a structural rebuild.
 */
export function isStructurallyEqual(a: EffectNode[], b: EffectNode[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].kind !== b[i].kind) return false;
    if (a[i].enabled !== b[i].enabled) return false;
    if (a[i].kind === "harmony" && b[i].kind === "harmony") {
      // Harmony is composite (multi-node, parallel branches). Any param
      // change forces a structural rebuild — there's no in-place patch.
      const ah = a[i] as Extract<EffectNode, { kind: "harmony" }>;
      const bh = b[i] as Extract<EffectNode, { kind: "harmony" }>;
      if (
        ah.voice1Semitones !== bh.voice1Semitones ||
        ah.voice2Semitones !== bh.voice2Semitones ||
        Math.abs(ah.wet - bh.wet) > 0.001
      ) {
        return false;
      }
    }
    // Compressor's `makeup !== 0` toggles an extra Gain node — structural.
    if (a[i].kind === "compressor" && b[i].kind === "compressor") {
      const am = (a[i] as Extract<EffectNode, { kind: "compressor" }>).makeup;
      const bm = (b[i] as Extract<EffectNode, { kind: "compressor" }>).makeup;
      if ((am === 0) !== (bm === 0)) return false;
    }
    // Filter mode swap (hp/lp/bp) requires re-creating the BiquadFilter type.
    if (a[i].kind === "filter" && b[i].kind === "filter") {
      const am = (a[i] as Extract<EffectNode, { kind: "filter" }>).mode;
      const bm = (b[i] as Extract<EffectNode, { kind: "filter" }>).mode;
      if (am !== bm) return false;
    }
  }
  return true;
}

/**
 * Patch a single stage's Tone nodes in place from a new EffectNode entry.
 * Only called after isStructurallyEqual — caller must ensure positions/kinds/
 * enabled flags match. Skips disabled entries (their stage doesn't exist).
 *
 * Reverb decay change requires async IR regeneration — we set wet/decay
 * directly; the underlying Tone.Reverb handles re-generating the IR.
 */
export function patchStage(node: EffectNode, stage: ChainStage): void {
  if (!node.enabled) return;
  switch (node.kind) {
    case "filter": {
      const filter = stage.input as Tone.Filter;
      filter.frequency.value = node.freq;
      filter.Q.value = node.q;
      break;
    }
    case "pitch": {
      const pitch = stage.input as Tone.PitchShift;
      pitch.pitch = node.semitones;
      break;
    }
    case "reverb": {
      const reverb = stage.input as Tone.Reverb;
      reverb.wet.value = node.wet;
      // Decay change triggers Tone to regenerate the IR async; we don't
      // wait — the new IR fades in over the next few hundred ms. The
      // `decay` property is typed as `Time` (string|number) so coerce.
      const currentDecay = Number(reverb.decay);
      if (!Number.isFinite(currentDecay) || Math.abs(currentDecay - node.decaySec) > 0.01) {
        reverb.decay = node.decaySec;
      }
      break;
    }
    case "delay": {
      const delay = stage.input as Tone.FeedbackDelay;
      delay.delayTime.value = node.timeSec;
      delay.feedback.value = node.feedback;
      delay.wet.value = node.wet;
      break;
    }
    case "gain": {
      const gain = stage.input as Tone.Gain;
      // Gain stored in dB on the chain entry; node was created with
      // ("decibels"), so .gain is also dB-scaled.
      gain.gain.value = Tone.dbToGain(node.db);
      break;
    }
    case "compressor": {
      // First node is the Compressor; if makeup != 0 there's a Gain after it.
      const comp = stage.input as Tone.Compressor;
      comp.threshold.value = node.threshold;
      comp.ratio.value = node.ratio;
      comp.attack.value = node.attack;
      comp.release.value = node.release;
      comp.knee.value = node.knee;
      if (node.makeup !== 0 && stage.input !== stage.output) {
        const makeup = stage.output as Tone.Gain;
        makeup.gain.value = Tone.dbToGain(node.makeup);
      }
      break;
    }
    case "harmony":
      // Harmony voice counts already filtered out by isStructurallyEqual;
      // pure semitone/wet patches not supported in place yet — those still
      // rebuild. (Not worth the bookkeeping for a small UX win.)
      break;
    case "trim":
    case "fade":
      // Source-level params; require source restart to take effect.
      break;
  }
}
