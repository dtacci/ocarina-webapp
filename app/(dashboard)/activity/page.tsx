import Link from "next/link";
import { Activity, FolderArchive, Play } from "lucide-react";

import {
  getRecentSessionsWithRecordings,
  getActivityHeatmap,
  getSessionStats,
} from "@/lib/db/queries/sessions";
import {
  listMyCaptures,
  getCapturesHeatmap,
  getCapturesCount,
} from "@/lib/db/queries/monitor-captures";
import { ActivityHeatmap } from "@/components/activity/activity-heatmap";
import { SessionCard } from "@/components/activity/session-card";
import { StatsCards } from "@/components/activity/stats-cards";

export default async function ActivityPage() {
  const [
    sessions,
    sessionHeatmap,
    sessionStats,
    captureHeatmap,
    capturesCount,
    recentCaptures,
  ] = await Promise.all([
    getRecentSessionsWithRecordings(20),
    getActivityHeatmap(),
    getSessionStats(),
    getCapturesHeatmap(),
    getCapturesCount(),
    listMyCaptures(10),
  ]);

  const mergedHeatmap = mergeHeatmaps(sessionHeatmap, captureHeatmap);
  const stats = { ...sessionStats, captures: capturesCount };

  const hasSessions = sessions.length > 0;
  const hasCaptures = recentCaptures.length > 0;
  const hasAnything = hasSessions || hasCaptures;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-muted-foreground">
          Your creative session history, debug captures, and contribution heatmap.
        </p>
      </div>

      <StatsCards stats={stats} />

      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium mb-3">Creative Activity</h2>
        <ActivityHeatmap data={mergedHeatmap} />
      </div>

      {hasSessions && (
        <div>
          <h2 className="text-sm font-medium uppercase text-muted-foreground tracking-wider mb-3">
            Recent Sessions
          </h2>
          <div className="space-y-4">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </div>
      )}

      {hasCaptures && (
        <div>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            <FolderArchive className="size-3.5" />
            Recent Captures
          </h2>
          <div className="space-y-2">
            {recentCaptures.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3"
              >
                <Link
                  href={`/monitor/captures/${c.id}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                    <span>{new Date(c.created_at).toLocaleString()}</span>
                    <span>{c.event_count} events</span>
                    <span>{Math.round(c.duration_ms / 1000)}s</span>
                    <span className="font-mono">{c.source}</span>
                  </div>
                </Link>
                <Link
                  href={`/monitor/captures/${c.id}`}
                  className="flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-500/15"
                >
                  <Play className="size-3" />
                  Replay
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasAnything && (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <Activity className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs text-muted-foreground">
              Connect your Ocarina and start playing, or open Monitor and capture a session.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function mergeHeatmaps<T extends { date: string; count: number; minutes: number }>(
  a: T[],
  b: T[]
): T[] {
  const map = new Map<string, { count: number; minutes: number }>();
  for (const row of [...a, ...b]) {
    const existing = map.get(row.date) ?? { count: 0, minutes: 0 };
    existing.count += row.count;
    existing.minutes += row.minutes;
    map.set(row.date, existing);
  }
  return Array.from(map.entries())
    .sort(([d1], [d2]) => d1.localeCompare(d2))
    .map(([date, v]) => ({ date, ...v } as T));
}
