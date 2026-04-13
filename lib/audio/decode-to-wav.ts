import { encodeWav } from "./wav-encoder";

export interface DecodedToWav {
  wavBlob: Blob;
  audioBuffer: AudioBuffer;
  durationSec: number;
}

export async function blobToWav(
  blob: Blob,
  audioCtx?: AudioContext,
): Promise<DecodedToWav> {
  const ctx = audioCtx ?? new AudioContext();
  const ownsCtx = !audioCtx;

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const wavArrayBuffer = encodeWav(audioBuffer);
    const wavBlob = new Blob([wavArrayBuffer], { type: "audio/wav" });
    return {
      wavBlob,
      audioBuffer,
      durationSec: audioBuffer.duration,
    };
  } finally {
    if (ownsCtx) {
      await ctx.close().catch(() => undefined);
    }
  }
}
