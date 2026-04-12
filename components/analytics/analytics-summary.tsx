import { Disc3, Timer, Music, BarChart2 } from "lucide-react";

interface Props {
  totalSessions: number;
  totalMinutes: number;
  avgMinutesPerSession: number;
  rangeDays: number;
}

export function AnalyticsSummary({
  totalSessions,
  totalMinutes,
  avgMinutesPerSession,
  rangeDays,
}: Props) {
  const items = [
    {
      icon: Disc3,
      label: `Sessions (last ${rangeDays}d)`,
      value: totalSessions.toLocaleString(),
    },
    {
      icon: Timer,
      label: "Minutes played",
      value: totalMinutes.toLocaleString(),
    },
    {
      icon: Music,
      label: "Avg session length",
      value: `${avgMinutesPerSession}m`,
    },
    {
      icon: BarChart2,
      label: "Sessions / day",
      value: (totalSessions / Math.max(rangeDays, 1)).toFixed(1),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Icon className="size-3.5" />
            <span className="text-xs">{label}</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        </div>
      ))}
    </div>
  );
}
