/**
 * Kit audition — a quick kick / snare / c-hat / o-hat riff so a kit can be
 * judged from the picker without loading it into the engine.
 *
 * Keeps its own small AudioContext (auditioning must not glitch a playing
 * DrumEngine) and caches decoded one-shots per kit id.
 */
import type { KitManifest, SynthVoiceKind } from "./drum-kit-manifest";
import { synthesize } from "./drum-engine";

const RIFF: { voice: string; at: number }[] = [
  { voice: "kick", at: 0 },
  { voice: "c-hat", at: 0.16 },
  { voice: "snare", at: 0.32 },
  { voice: "c-hat", at: 0.48 },
  { voice: "kick", at: 0.64 },
  { voice: "o-hat", at: 0.8 },
];

let ctx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>(); // `${kitId}/${voice}`

async function ensureCtx(): Promise<AudioContext> {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") await ctx.resume();
  return ctx;
}

export async function auditionKit(kit: KitManifest): Promise<void> {
  const ac = await ensureCtx();

  if (kit.kind === "synth") {
    const t0 = ac.currentTime + 0.03;
    for (const { voice, at } of RIFF) {
      synthesize(ac, ac.destination, voice as SynthVoiceKind, t0 + at, 0.8);
    }
    return;
  }

  const needed = [...new Set(RIFF.map((r) => r.voice))];
  await Promise.all(
    needed.map(async (voice) => {
      const key = `${kit.id}/${voice}`;
      if (bufferCache.has(key)) return;
      const file = kit.voices.find((v) => v.name === voice)?.file;
      if (!file) return;
      try {
        const res = await fetch(file);
        if (!res.ok) return;
        bufferCache.set(key, await ac.decodeAudioData(await res.arrayBuffer()));
      } catch {
        /* missing voice — riff just skips it */
      }
    }),
  );

  const t0 = ac.currentTime + 0.03;
  for (const { voice, at } of RIFF) {
    const buffer = bufferCache.get(`${kit.id}/${voice}`);
    if (!buffer) continue;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const g = ac.createGain();
    g.gain.value = 0.8;
    src.connect(g).connect(ac.destination);
    src.start(t0 + at);
  }
}
