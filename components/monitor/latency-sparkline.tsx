"use client";

interface Props {
  samples: (number | null)[];
  /** Width in px. Height is fixed at 16. */
  width?: number;
}

/**
 * Pure-SVG sparkline of the last ~30 teensyLatencyMs polls. null samples
 * (failed polls) render as a small red tick at the baseline. Y-axis auto-
 * scales to the visible window so blips stand out at any latency floor.
 */
export function LatencySparkline({ samples, width = 90 }: Props) {
  if (samples.length === 0) return null;
  const height = 16;
  const pad = 1;

  const numeric = samples.map((s) => (typeof s === "number" ? s : null));
  const values = numeric.filter((s): s is number => s !== null);
  if (values.length === 0) {
    // All-failed window — render as a flat red line so the user knows.
    return (
      <svg width={width} height={height} className="shrink-0">
        <line
          x1={0}
          y1={height - pad}
          x2={width}
          y2={height - pad}
          stroke="rgb(248 113 113)"
          strokeWidth={1}
        />
      </svg>
    );
  }

  const max = Math.max(...values, 5); // floor of 5ms so a flat-zero window has visible amplitude
  const min = 0;
  const range = max - min;
  const step = numeric.length > 1 ? (width - pad * 2) / (numeric.length - 1) : 0;

  const ptY = (v: number) => {
    const norm = range > 0 ? (v - min) / range : 0;
    return height - pad - norm * (height - pad * 2);
  };

  // Build a polyline using `null` to break the line on failed samples.
  const segments: string[][] = [[]];
  numeric.forEach((v, i) => {
    if (v === null) {
      if (segments[segments.length - 1].length > 0) segments.push([]);
      return;
    }
    const x = pad + i * step;
    const y = ptY(v);
    segments[segments.length - 1].push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });

  return (
    <svg
      width={width}
      height={height}
      className="shrink-0"
      role="img"
      aria-label={`latency sparkline (last ${samples.length} samples, max ${Math.round(max)}ms)`}
    >
      {segments.map((seg, i) =>
        seg.length >= 2 ? (
          <polyline
            key={i}
            points={seg.join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.7}
          />
        ) : null
      )}
      {/* Failed-sample ticks at baseline */}
      {numeric.map((v, i) =>
        v === null ? (
          <line
            key={`fail-${i}`}
            x1={pad + i * step}
            y1={height - pad}
            x2={pad + i * step}
            y2={height - pad - 3}
            stroke="rgb(248 113 113)"
            strokeWidth={1}
          />
        ) : null
      )}
      {/* Highlight the latest point */}
      {(() => {
        const lastIdx = numeric.length - 1;
        const lastV = numeric[lastIdx];
        if (lastV === null) return null;
        return (
          <circle
            cx={pad + lastIdx * step}
            cy={ptY(lastV)}
            r={1.6}
            fill="currentColor"
          />
        );
      })()}
    </svg>
  );
}
