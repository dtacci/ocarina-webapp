export interface LrcLine {
  time: number;   // seconds
  text: string;   // lyric text, or "♪" for instrumental passage
  isInstrumental?: boolean;
}

// Parse LRC format: [mm:ss.xx] text
// Also handles [mm:ss:xx] (colon separator) used by some sources
const LRC_TIME_RE = /^\[(\d{1,2}):(\d{2})[.:](\d{1,3})\]\s*(.*)/;

export function parseLrc(lrc: string | null | undefined): LrcLine[] {
  if (!lrc) return [];

  const lines: LrcLine[] = [];

  for (const raw of lrc.split("\n")) {
    const m = LRC_TIME_RE.exec(raw.trim());
    if (!m) continue;

    const mm = parseInt(m[1], 10);
    const ss = parseInt(m[2], 10);
    // Normalise fractional seconds — could be .xx (hundredths) or .xxx (milliseconds)
    const frac = m[3].length <= 2
      ? parseInt(m[3], 10) / 100
      : parseInt(m[3], 10) / 1000;

    const time = mm * 60 + ss + frac;
    const text = m[4].trim();

    // Skip metadata tags like [ar:Artist], [ti:Title], [by:Editor]
    if (!text || /^\[/.test(text)) continue;

    lines.push({ time, text });
  }

  lines.sort((a, b) => a.time - b.time);

  // Insert ♪ placeholder for instrumental gaps > 4 seconds
  const withGaps: LrcLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    withGaps.push(lines[i]);
    if (i < lines.length - 1) {
      const gap = lines[i + 1].time - lines[i].time;
      if (gap > 4) {
        withGaps.push({
          time: lines[i].time + gap / 2,
          text: "♪ ♪ ♪",
          isInstrumental: true,
        });
      }
    }
  }

  return withGaps;
}

export function findCurrentLine(lines: LrcLine[], currentTime: number): number {
  if (lines.length === 0 || currentTime < lines[0].time) return -1;
  let lo = 0, hi = lines.length - 1, result = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= currentTime) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}
