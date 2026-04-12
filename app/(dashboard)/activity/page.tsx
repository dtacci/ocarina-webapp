import { getRecentSessions, getActivityHeatmap, getSessionStats } from "@/lib/db/queries/sessions";
import { ActivityHeatmap } from "@/components/activity/activity-heatmap";
import { SessionCard } from "@/components/activity/session-card";
import { StatsCards } from "@/components/activity/stats-cards";
import { Activity } from "lucide-react";

export default async function ActivityPage() {
  const [sessions, heatmapData, stats] = await Promise.all([
    getRecentSessions(20),
    getActivityHeatmap(),
    getSessionStats(),
  ]);

  const hasActivity = sessions.length > 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-muted-foreground">
          Your creative session history and contribution heatmap.
        </p>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Heatmap */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium mb-3">Creative Activity</h2>
        <ActivityHeatmap data={heatmapData} />
      </div>

      {/* Session timeline */}
      {hasActivity ? (
        <div>
          <h2 className="text-sm font-medium uppercase text-muted-foreground tracking-wider mb-3">
            Recent Sessions
          </h2>
          <div className="space-y-2">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <Activity className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">No sessions yet</p>
            <p className="text-xs text-muted-foreground">
              Connect your Ocarina and start playing to see your activity here
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
