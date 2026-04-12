import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

function sinePath(width: number, height: number, cycles: number, phase = 0) {
  const mid = height / 2;
  const amplitude = height / 3;
  const step = 2;
  const points: string[] = [];
  for (let x = 0; x <= width; x += step) {
    const theta = (x / width) * Math.PI * 2 * cycles + phase;
    const y = mid + Math.sin(theta) * amplitude;
    points.push(`${x === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(2)}`);
  }
  return points.join(" ");
}

export function SineVisualizer({ className }: Props) {
  const width = 900;
  const height = 240;

  const primary = sinePath(width, height, 2.25);
  const echo = sinePath(width, height, 4, Math.PI / 3);
  const ghost = sinePath(width, height, 1.25, Math.PI);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("auth-sine w-full h-full", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="sine-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.75 0.18 65)" stopOpacity="0.05" />
          <stop offset="35%" stopColor="oklch(0.75 0.18 65)" stopOpacity="0.85" />
          <stop offset="65%" stopColor="oklch(0.75 0.18 65)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="oklch(0.75 0.18 65)" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="sine-grad-echo" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.55 0.12 260)" stopOpacity="0" />
          <stop offset="50%" stopColor="oklch(0.55 0.12 260)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="oklch(0.55 0.12 260)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Ghost wave — lowest contrast, longest wavelength */}
      <path
        d={ghost}
        fill="none"
        stroke="oklch(1 0 0 / 0.06)"
        strokeWidth={1.25}
        strokeLinecap="round"
      />
      {/* Echo wave — cool counterpoint */}
      <path
        d={echo}
        fill="none"
        stroke="url(#sine-grad-echo)"
        strokeWidth={1}
        strokeLinecap="round"
      />
      {/* Primary wave — amber, drawn on load */}
      <path
        d={primary}
        fill="none"
        stroke="url(#sine-grad)"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </svg>
  );
}
