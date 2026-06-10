/**
 * Offline mixdown of a track-editor mix: every stem looped through its
 * channel strip (EffectNode chain → pan → fader, mute/solo respected),
 * summed into a master gain — the same topology as live playback in
 * mix-engine.ts, rendered inside Tone.Offline for WAV export.
 */
import * as Tone from "tone";
import { buildEffectNodes, wireChain } from "./chain-stages";
import type { MixStem } from "./mix-engine";
import {
  arrangementLengthSec,
  type Arrangement,
  type SessionMixDoc,
} from "./mix-types";

export async function renderMixdown(
  stems: MixStem[],
  doc: SessionMixDoc,
  /**
   * When set, render the clip timeline instead of looping whole stems;
   * length comes from the arrangement.
   */
  arrangement?: Arrangement | null,
): Promise<AudioBuffer> {
  const length = Math.max(
    0.1,
    arrangement
      ? arrangementLengthSec(arrangement)
      : stems.reduce((m, s) => Math.max(m, s.buffer.duration), 0),
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

        const panner = new Tone.Panner(spec?.pan ?? 0);
        const fader = new Tone.Gain(spec?.volume ?? 1);
        const { stages } = await buildEffectNodes(spec?.chain ?? []);
        const head = new Tone.Gain(1);
        wireChain(head, stages, panner);
        panner.connect(fader);
        fader.connect(master);

        const clips = arrangement
          ? arrangement.lanes.find((l) => l.recordingId === stem.recordingId)?.clips ?? []
          : [{ recordingId: stem.recordingId, startSec: 0, offsetSec: 0, durationSec: length }];

        for (const clip of clips) {
          const tb = new Tone.ToneAudioBuffer();
          tb.set(stem.buffer);
          const source = new Tone.ToneBufferSource(tb);
          if (!arrangement) source.loop = true; // whole-stem mode loops to fill
          source.fadeIn = 0.005;
          source.fadeOut = 0.005;
          source.connect(head);
          source.start(clip.startSec, clip.offsetSec, clip.durationSec);
        }
      }
    },
    length,
    2,
    sampleRate,
  );

  return rendered.get()!;
}
