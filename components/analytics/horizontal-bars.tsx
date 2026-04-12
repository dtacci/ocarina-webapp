import { cn } from "@/lib/utils";

interface Item {
  label: string;
  value: number;
  sublabel?: string;
}

interface Props {
  title: string;
  items: Item[];
  emptyText?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export function HorizontalBars({
  title,
  items,
  emptyText = "No data yet.",
  valueFormatter = (v) => v.toLocaleString(),
  className,
}: Props) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium">{item.label}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {valueFormatter(item.value)}
                  {item.sublabel && (
                    <span className="ml-1 text-muted-foreground/70">
                      {item.sublabel}
                    </span>
                  )}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all"
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
