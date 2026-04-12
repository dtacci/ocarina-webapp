import { cn } from "@/lib/utils";

const MODE_COLORS: Record<string, string> = {
  instrument: "bg-amber-500",
  karaoke: "bg-violet-500",
  madlibs: "bg-emerald-500",
  looper: "bg-sky-500",
};

const MODE_LABELS: Record<string, string> = {
  instrument: "Instrument",
  karaoke: "Karaoke",
  madlibs: "Madlibs",
  looper: "Looper",
};

interface Props {
  counts: Record<string, number>;
  className?: string;
}

export function ModeBreakdown({ counts, className }: Props) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, c]) => sum + c, 0);

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <h3 className="text-sm font-medium mb-3">Mode breakdown</h3>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground">No sessions in range.</p>
      ) : (
        <>
          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
            {entries.map(([mode, count]) => (
              <div
                key={mode}
                className={cn(MODE_COLORS[mode] ?? "bg-gray-500")}
                style={{ width: `${(count / total) * 100}%` }}
                title={`${MODE_LABELS[mode] ?? mode}: ${count.toLocaleString()}`}
              />
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {entries.map(([mode, count]) => (
              <div key={mode} className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "inline-block size-2 rounded-full",
                    MODE_COLORS[mode] ?? "bg-gray-500"
                  )}
                />
                <span className="flex-1 truncate">
                  {MODE_LABELS[mode] ?? mode}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {count.toLocaleString()}
                </span>
                <span className="text-muted-foreground/70 tabular-nums w-10 text-right">
                  {((count / total) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
