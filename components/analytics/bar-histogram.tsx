import { cn } from "@/lib/utils";

interface Props {
  title: string;
  values: number[];
  labels: string[];
  emphasize?: (index: number, value: number) => boolean;
  className?: string;
}

export function BarHistogram({
  title,
  values,
  labels,
  emphasize,
  className,
}: Props) {
  const max = Math.max(1, ...values);
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      <div className="flex items-end gap-1 h-24">
        {values.map((v, i) => {
          const height = `${(v / max) * 100}%`;
          const highlight = emphasize?.(i, v) ?? false;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="relative w-full flex-1 flex items-end">
                <div
                  className={cn(
                    "w-full rounded-t-sm transition-all",
                    v === 0
                      ? "bg-muted"
                      : highlight
                        ? "bg-primary"
                        : "bg-foreground/30"
                  )}
                  style={{ height: v === 0 ? "2px" : height }}
                  title={`${labels[i]}: ${v.toLocaleString()}`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-2">
        {labels.map((label, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[10px] text-muted-foreground truncate"
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
