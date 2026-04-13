/**
 * Compute a WaveSurfer-compatible peak array from audio data.
 *
 * Two entry points:
 *   - `computePeaksFromBuffer(AudioBuffer, n?)` — synchronous, primary API
 *   - `computePeaksFromFile(File, n?)` — async convenience that decodes first
 *
 * The returned array is normalized to [0..1] (RMS per chunk divided by the
 * track's peak RMS), rounded to 4 decimals. 200 points is what the DB and
 * WaveSurfer v7 expect for the initial paints in the sample library.
 */

export function computePeaksFromBuffer(
  buffer: AudioBuffer,
  nPoints = 200,
): number[] {
  const channelData = buffer.getChannelData(0);
  const chunkSize = Math.max(1, Math.floor(channelData.length / nPoints));
  const peaks: number[] = [];

  for (let i = 0; i < nPoints; i++) {
    let sum = 0;
    const start = i * chunkSize;
    const end = Math.min(channelData.length, start + chunkSize);
    for (let j = start; j < end; j++) {
      sum += channelData[j] ** 2;
    }
    peaks.push(Math.sqrt(sum / Math.max(1, end - start)));
  }

  const max = Math.max(...peaks, 0.001);
  return peaks.map((p) => Math.round((p / max) * 10000) / 10000);
}

export async function computePeaksFromFile(
  file: File,
  nPoints = 200,
): Promise<number[]> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const decoded = await ctx.decodeAudioData(arrayBuffer);
  return computePeaksFromBuffer(decoded, nPoints);
}
