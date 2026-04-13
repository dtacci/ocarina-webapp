/**
 * Encode an AudioBuffer as a PCM16 WAV (RIFF/WAVE, LE samples).
 * Supports mono + stereo (interleaved). Pure function, no dependencies.
 *
 * Layout:
 *   [RIFF header 12 bytes][fmt chunk 24 bytes][data chunk header 8 bytes][PCM samples]
 *   total = 44 bytes header + numFrames * numChannels * 2
 */
export function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2; // PCM16
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const totalSize = 44 + dataSize;

  const out = new ArrayBuffer(totalSize);
  const view = new DataView(out);

  // "RIFF"
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, "WAVE");
  // "fmt " subchunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  // "data" subchunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave + convert Float32 samples to Int16 LE
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      const int = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, int, true);
      offset += 2;
    }
  }

  return out;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
