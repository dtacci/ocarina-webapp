"use client";

interface Props {
  ms: number;
  variant?: "idle" | "active" | "warn";
  className?: string;
}

function format(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function TimecodeDisplay({ ms, variant = "idle", className }: Props) {
  const color =
    variant === "warn"
      ? "var(--wb-oxide)"
      : variant === "active"
      ? "var(--wb-amber)"
      : "var(--muted-foreground)";
  return (
    <span
      className={[
        "font-mono tabular-nums text-lg tracking-tight select-none",
        className ?? "",
      ].join(" ")}
      style={{ color }}
      aria-live="off"
    >
      {format(ms)}
    </span>
  );
}
