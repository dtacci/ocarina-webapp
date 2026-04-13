/**
 * Renders the sample's identity as a miniature waveform — used as cover art
 * in drafts list + samples grid. Mirrors top/bottom for a symmetric look.
 * Amber bars for user-owned, ink for drafts/system.
 */
type Tone = "amber" | "ink";

interface Props {
  peaks: number[] | null | undefined;
  width?: number;
  height?: number;
  bars?: number;
  tone?: Tone;
  className?: string;
}

export function SampleCover({
  peaks,
  width = 96,
  height = 48,
  bars = 32,
  tone = "ink",
  className,
}: Props) {
  const color =
    tone === "amber" ? "var(--wb-amber)" : "var(--ink-500)";

  // No peaks yet? Render flat baseline — keeps layout stable.
  const safePeaks = peaks && peaks.length > 0 ? peaks : new Array(bars).fill(0.05);
  const step = safePeaks.length / bars;
  const barWidth = width / bars;
  const gap = Math.max(1, Math.floor(barWidth * 0.3));
  const drawWidth = Math.max(1, barWidth - gap);
  const centerY = height / 2;
  const maxHalf = height / 2 - 1;

  const sampled = Array.from({ length: bars }, (_, i) => {
    const idx = Math.floor(i * step);
    const v = Math.abs(safePeaks[idx] ?? 0);
    return Math.min(1, v);
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      className={className}
      preserveAspectRatio="none"
    >
      {sampled.map((v, i) => {
        const h = Math.max(1, v * maxHalf);
        const x = i * barWidth;
        return (
          <rect
            key={i}
            x={x}
            y={centerY - h}
            width={drawWidth}
            height={h * 2}
            fill={color}
            rx={0.5}
          />
        );
      })}
    </svg>
  );
}
