/**
 * Offline render of a drum pattern → an exactly-bar-aligned AudioBuffer,
 * ready to save as a loop master (recordings row) for the DJ decks and the
 * track mixer. Same voice triggering as DrumEngine, minus the live scheduler.
 *
 * The render length is exact (bars × 4 beats) so the loop seams cleanly;
 * voices ringing past the end are folded back onto the loop start instead of
 * being cut — the tail of beat 16 is heard under beat 1, like a real loop.
 */
import type { KitManifest, SynthVoiceKind } from "./drum-kit-manifest";
import { synthesize, VELOCITY_GAIN, type Pattern } from "./drum-engine";

const STEPS = 16;

export interface RenderPatternOptions {
  pattern: Pattern;
  mutes: boolean[];
  kit: KitManifest;
  bpm: number;
  /** Pattern repetitions (the pattern is one bar of 16ths). */
  bars: number;
  sampleRate?: number;
}

export async function renderPatternLoop({
  pattern,
  mutes,
  kit,
  bpm,
  bars,
  sampleRate = 44100,
}: RenderPatternOptions): Promise<AudioBuffer> {
  const sixteenth = 60 / bpm / 4;
  const loopSec = bars * STEPS * sixteenth;
  const TAIL_SEC = 1.5; // rendered past the end, folded back below
  const ctx = new OfflineAudioContext(
    2,
    Math.ceil((loopSec + TAIL_SEC) * sampleRate),
    sampleRate,
  );

  // Decode sample voices in the offline context; synth voices need nothing.
  const buffers = new Map<string, AudioBuffer>();
  if (kit.kind === "sample") {
    await Promise.all(
      kit.voices.map(async (v) => {
        try {
          const res = await fetch(v.file);
          if (!res.ok) return;
          buffers.set(v.name, await ctx.decodeAudioData(await res.arrayBuffer()));
        } catch {
          /* voice falls back to synth below */
        }
      }),
    );
  }

  for (let bar = 0; bar < bars; bar++) {
    for (let stepIdx = 0; stepIdx < STEPS; stepIdx++) {
      const when = (bar * STEPS + stepIdx) * sixteenth;
      for (let v = 0; v < pattern.length; v++) {
        if (mutes[v]) continue;
        const step = pattern[v]?.[stepIdx];
        if (!step?.on) continue;
        const gain = VELOCITY_GAIN[step.velocity];
        const name = kit.voices[v]?.name ?? "";
        const buffer = buffers.get(name);
        if (buffer) {
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          const g = ctx.createGain();
          g.gain.value = gain;
          src.connect(g).connect(ctx.destination);
          src.start(when);
        } else {
          synthesize(ctx, ctx.destination, name as SynthVoiceKind, when, gain);
        }
      }
    }
  }

  const rendered = await ctx.startRendering();

  // Fold the tail back onto the start: out[i] = body[i] + tail[i].
  const loopFrames = Math.round(loopSec * sampleRate);
  const out = new AudioBuffer({ numberOfChannels: 2, length: loopFrames, sampleRate });
  for (let ch = 0; ch < 2; ch++) {
    const src = rendered.getChannelData(ch);
    const dst = out.getChannelData(ch);
    dst.set(src.subarray(0, loopFrames));
    const tailFrames = Math.min(rendered.length - loopFrames, loopFrames);
    for (let i = 0; i < tailFrames; i++) {
      dst[i] = Math.max(-1, Math.min(1, dst[i] + src[loopFrames + i]));
    }
  }
  return out;
}
