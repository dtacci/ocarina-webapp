import Link from "next/link";
import { Activity, FolderArchive, MessageSquare, Play } from "lucide-react";

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
import { listRecentCommentsOnMyCaptures } from "@/lib/db/queries/capture-comments";
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
    recentComments,
  ] = await Promise.all([
    getRecentSessionsWithRecordings(20),
    getActivityHeatmap(),
    getSessionStats(),
    getCapturesHeatmap(),
    getCapturesCount(),
    listMyCaptures(10),
    listRecentCommentsOnMyCaptures(10),
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
                    {c.loop_event_count > 0 && (
                      <span className="text-blue-300/80">{c.loop_event_count} loop</span>
                    )}
                  </div>
                  {c.notes && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/90 italic whitespace-pre-wrap">
                      {c.notes}
                    </p>
                  )}
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

      {recentComments.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="size-3.5" />
            Recent Comments
          </h2>
          <div className="space-y-2">
            {recentComments.map((c) => (
              <Link
                key={c.id}
                href={`/monitor/captures/${c.capture_id}`}
                className="flex flex-wrap items-start gap-3 rounded-xl border bg-card px-4 py-3 hover:border-foreground/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/90">
                      {c.author_display_name ?? `user ${c.author_id.slice(0, 6)}`}
                    </span>
                    <span>on</span>
                    <span className="font-medium text-foreground/90">
                      {c.capture_name || "(unnamed)"}
                    </span>
                    <span>·</span>
                    <span>{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-foreground/90">
                    {c.body}
                  </p>
                </div>
              </Link>
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
