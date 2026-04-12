"use client";

import type { DayActivity } from "@/lib/db/queries/sessions";

function getIntensity(count: number): string {
  if (count === 0) return "bg-muted";
  if (count === 1) return "bg-emerald-200 dark:bg-emerald-900";
  if (count <= 3) return "bg-emerald-400 dark:bg-emerald-700";
  if (count <= 5) return "bg-emerald-500 dark:bg-emerald-500";
  return "bg-emerald-600 dark:bg-emerald-400";
}

interface Props {
  data: DayActivity[];
}

export function ActivityHeatmap({ data }: Props) {
  // Build a map for quick lookup
  const activityMap = new Map(data.map((d) => [d.date, d]));

  // Generate last 52 weeks (364 days) of cells
  const today = new Date();
  const cells: { date: string; count: number; minutes: number }[] = [];

  for (let i = 363; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const activity = activityMap.get(key);
    cells.push({
      date: key,
      count: activity?.count ?? 0,
      minutes: activity?.minutes ?? 0,
    });
  }

  // Group into weeks (columns of 7)
  const weeks: typeof cells[] = [];
  // Pad start so the first cell aligns to the correct day of week
  const firstDay = new Date(cells[0].date).getDay(); // 0=Sun
  const padded = [
    ...Array.from({ length: firstDay }, () => ({ date: "", count: -1, minutes: 0 })),
    ...cells,
  ];

  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="space-y-2">
      {/* Month labels */}
      <div className="flex gap-[3px] pl-8 text-[10px] text-muted-foreground">
        {weeks.map((week, wi) => {
          // Show month label on first week that starts a new month
          const firstCell = week.find((c) => c.date);
          if (!firstCell?.date) return <div key={wi} className="w-[11px]" />;
          const day = new Date(firstCell.date).getDate();
          const month = new Date(firstCell.date).getMonth();
          return (
            <div key={wi} className="w-[11px] text-center">
              {day <= 7 ? months[month] : ""}
            </div>
          );
        })}
      </div>

      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] text-[10px] text-muted-foreground pr-1 w-6">
          <div className="h-[11px]" />
          <div className="h-[11px] leading-[11px]">Mon</div>
          <div className="h-[11px]" />
          <div className="h-[11px] leading-[11px]">Wed</div>
          <div className="h-[11px]" />
          <div className="h-[11px] leading-[11px]">Fri</div>
          <div className="h-[11px]" />
        </div>

        {/* Grid */}
        <div className="flex gap-[3px] overflow-x-auto">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell, di) => (
                <div
                  key={`${wi}-${di}`}
                  className={`size-[11px] rounded-sm ${cell.count < 0 ? "bg-transparent" : getIntensity(cell.count)}`}
                  title={
                    cell.date
                      ? `${cell.date}: ${cell.count} session${cell.count !== 1 ? "s" : ""}, ${cell.minutes} min`
                      : ""
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pl-8">
        <span>Less</span>
        <div className={`size-[11px] rounded-sm ${getIntensity(0)}`} />
        <div className={`size-[11px] rounded-sm ${getIntensity(1)}`} />
        <div className={`size-[11px] rounded-sm ${getIntensity(2)}`} />
        <div className={`size-[11px] rounded-sm ${getIntensity(5)}`} />
        <div className={`size-[11px] rounded-sm ${getIntensity(6)}`} />
        <span>More</span>
      </div>
    </div>
  );
}
