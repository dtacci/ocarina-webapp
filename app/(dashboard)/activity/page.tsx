import { Activity } from "lucide-react";

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-muted-foreground">
          Your creative session history and contribution heatmap.
        </p>
      </div>
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <Activity className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">No activity yet</p>
          <p className="text-xs text-muted-foreground">
            Session timeline and GitHub-style heatmap will appear here
          </p>
        </div>
      </div>
    </div>
  );
}
