import { cn } from "@/lib/utils";

interface Day {
  date: string;
  count: number;
  minutes: number;
}

interface Props {
  days: Day[];
  className?: string;
}

export function DailySessions({ days, className }: Props) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-medium">Sessions per day</h3>
        <span className="text-xs text-muted-foreground">
          {days.length} days
        </span>
      </div>
      <div className="flex items-end gap-px h-20">
        {days.map((d) => (
          <div
            key={d.date}
            className={cn(
              "flex-1 rounded-sm transition-colors min-w-[2px]",
              d.count === 0 ? "bg-muted" : "bg-primary/70 hover:bg-primary"
            )}
            style={{
              height:
                d.count === 0 ? "2px" : `${Math.max(4, (d.count / max) * 100)}%`,
            }}
            title={`${d.date}: ${d.count} session${d.count === 1 ? "" : "s"}, ${d.minutes}m`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}
