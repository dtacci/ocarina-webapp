import { Music, Repeat, Timer, Disc3, FolderArchive } from "lucide-react";

interface Stats {
  totalSessions: number;
  totalMinutes: number;
  samplesPlayed: number;
  loopsRecorded: number;
  /** Optional — added by the activity page when captures are integrated. */
  captures?: number;
}

const statItems = [
  { key: "totalSessions" as const, label: "Sessions", icon: Disc3 },
  { key: "totalMinutes" as const, label: "Minutes Played", icon: Timer },
  { key: "samplesPlayed" as const, label: "Samples Played", icon: Music },
  { key: "loopsRecorded" as const, label: "Loops Recorded", icon: Repeat },
  { key: "captures" as const, label: "Captures Saved", icon: FolderArchive },
];

export function StatsCards({ stats }: { stats: Stats }) {
  // Hide the captures card when there are none — keeps the row tidy until the
  // user actually uses /monitor's capture feature.
  const items = statItems.filter((it) =>
    it.key === "captures" ? (stats.captures ?? 0) > 0 : true
  );
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      {items.map(({ key, label, icon: Icon }) => (
        <div key={key} className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Icon className="size-3.5" />
            <span className="text-xs">{label}</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {(stats[key] ?? 0).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
