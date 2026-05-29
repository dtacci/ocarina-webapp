/**
 * Builds a tiny activity-heatmap SVG summarizing a capture's button activity
 * — a 4×3 grid of tiles, one per Pi-REST button (1..12), colored by press
 * count. Persisted as a separate Blob at save time and rendered inline in
 * library / recent / replay views so you can scan the library visually.
 *
 * Layout matches the chromatic order the configurator uses, so a "tracks_left"
 * profile's activity pattern looks different from a chromatic player's at a
 * glance.
 */

import type { LogEntry } from "@/components/diagnostics/live-event-log";

const COLS = 4;
const ROWS = 3;
const TILE = 19;
const GAP = 1;
const PAD = 1;
const VIEW_W = PAD * 2 + COLS * TILE + (COLS - 1) * GAP; // 80
const VIEW_H = PAD * 2 + ROWS * TILE + (ROWS - 1) * GAP; // 60

/**
 * Pi-REST button events synthesize a "pin" from the 1..12 number — buttons
 * 1..8 map to Teensy pins 34..41 via NOTE_BUTTONS, buttons 9..12 fall back to
 * the raw number. Invert here so the thumbnail tiles match the configurator
 * grid.
 */
function pinToButton(pin: number): number | null {
  if (pin >= 34 && pin <= 41) return pin - 33; // 34→1 .. 41→8
  if (pin >= 9 && pin <= 12) return pin;       // 9..12 stay
  return null;
}

function countButtonPresses(events: LogEntry[]): number[] {
  const counts = new Array<number>(12).fill(0);
  for (const e of events) {
    if (e.kind !== "button") continue;
    const m = e.text.match(/^pin\s+(\d+)\s+(press|down)/);
    if (!m) continue;
    const btn = pinToButton(Number(m[1]));
    if (btn === null || btn < 1 || btn > 12) continue;
    counts[btn - 1] += 1;
  }
  return counts;
}

export interface ThumbnailMeta {
  totalPresses: number;
  perButton: number[]; // length 12, 0-indexed
}

export function buildCaptureThumbnailSvg(events: LogEntry[]): {
  svg: string;
  meta: ThumbnailMeta;
} {
  const counts = countButtonPresses(events);
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);

  const tiles: string[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const idx = row * COLS + col;
      const x = PAD + col * (TILE + GAP);
      const y = PAD + row * (TILE + GAP);
      const c = counts[idx];
      // Compressive curve so a single hit still registers visibly while a
      // mash doesn't saturate the grid into uniformity.
      const norm = max > 0 ? Math.sqrt(c / max) : 0;
      const alpha = 0.06 + 0.94 * norm;
      const fill = c > 0 ? `rgba(217,119,6,${alpha.toFixed(2)})` : "rgba(255,255,255,0.04)";
      tiles.push(
        `<rect x="${x}" y="${y}" width="${TILE}" height="${TILE}" rx="2" fill="${fill}"/>`
      );
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}">` +
    `<rect width="${VIEW_W}" height="${VIEW_H}" fill="rgb(28,25,23)"/>` +
    tiles.join("") +
    `</svg>`;

  return { svg, meta: { totalPresses: total, perButton: counts } };
}
