/**
 * Finds the nearest zero-crossing in an AudioBuffer around a target time.
 * Used for snap-to-zero when the user holds Shift while dragging a trim handle,
 * which eliminates clicks at the cut points.
 *
 * Scans both directions from the target sample and returns whichever crossing
 * is closest in samples. Falls back to the target time if no crossing is found
 * within the search window (rare — most audio has frequent crossings).
 */
export function findNearestZeroCrossing(
  buffer: AudioBuffer,
  channelIndex: number,
  targetSec: number,
  searchWindowSec = 0.05,
): number {
  const channel = Math.min(channelIndex, buffer.numberOfChannels - 1);
  const data = buffer.getChannelData(channel);
  const sampleRate = buffer.sampleRate;

  const targetSample = Math.round(targetSec * sampleRate);
  const windowSamples = Math.round(searchWindowSec * sampleRate);
  const end = Math.min(data.length - 1, targetSample + windowSamples);
  const start = Math.max(1, targetSample - windowSamples);

  let bestIdx = -1;
  let bestDistance = Infinity;

  for (let i = start; i < end; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    // Sign change between adjacent samples = zero crossing at/between i-1 and i.
    if ((prev >= 0 && curr < 0) || (prev <= 0 && curr > 0)) {
      const d = Math.abs(i - targetSample);
      if (d < bestDistance) {
        bestDistance = d;
        bestIdx = i;
      }
    }
  }

  if (bestIdx === -1) return targetSec;
  return bestIdx / sampleRate;
}
