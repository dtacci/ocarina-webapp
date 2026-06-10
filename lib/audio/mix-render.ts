/**
 * Offline mixdown of a track-editor mix: every stem looped through its
 * channel strip (EffectNode chain → pan → fader, mute/solo respected),
 * summed into a master gain — the same topology as live playback in
 * mix-engine.ts, rendered inside Tone.Offline for WAV export.
 */
import * as Tone from "tone";
import { buildEffectNodes, wireChain } from "./chain-stages";
import type { MixStem } from "./mix-engine";
import type { SessionMixDoc } from "./mix-types";

export async function renderMixdown(
  stems: MixStem[],
  doc: SessionMixDoc,
  /** Render length; defaults to the longest stem (one full master loop). */
  durationSec?: number,
): Promise<AudioBuffer> {
  const length = Math.max(
    0.1,
    durationSec ?? stems.reduce((m, s) => Math.max(m, s.buffer.duration), 0),
  );
  const sampleRate = stems[0]?.buffer.sampleRate ?? 44100;

  const anySolo = doc.channels.some((c) => c.soloed);

  const rendered = await Tone.Offline(
    async () => {
      const master = new Tone.Gain(doc.master.volume ?? 1);
      master.connect(Tone.getDestination());

      for (const stem of stems) {
        const spec = doc.channels.find((c) => c.recordingId === stem.recordingId);
        const muted = (spec?.muted ?? false) || (anySolo && !spec?.soloed);
        if (muted) continue;

        const tb = new Tone.ToneAudioBuffer();
        tb.set(stem.buffer);
        const source = new Tone.ToneBufferSource(tb);
        source.loop = true;

        const panner = new Tone.Panner(spec?.pan ?? 0);
        const fader = new Tone.Gain(spec?.volume ?? 1);
        const { stages } = await buildEffectNodes(spec?.chain ?? []);
        wireChain(source, stages, panner);
        panner.connect(fader);
        fader.connect(master);

        source.start(0, 0, length);
      }
    },
    length,
    2,
    sampleRate,
  );

  return rendered.get()!;
}
