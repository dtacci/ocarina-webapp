import { Badge } from "@/components/ui/badge";
import { Music, Repeat, Clock } from "lucide-react";
import type { SessionRow } from "@/lib/db/queries/sessions";

const modeColors: Record<string, string> = {
  instrument: "bg-violet-500",
  karaoke: "bg-pink-500",
  madlibs: "bg-amber-500",
  looper: "bg-emerald-500",
};

function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SessionCard({ session }: { session: SessionRow }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div className={`mt-0.5 size-2.5 rounded-full shrink-0 ${modeColors[session.mode] ?? "bg-gray-500"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium capitalize">{session.mode} session</span>
          <span className="text-xs text-muted-foreground">{formatDate(session.started_at)}</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDuration(session.duration_sec)}
          </span>
          {session.samples_played > 0 && (
            <span className="flex items-center gap-1">
              <Music className="size-3" />
              {session.samples_played} samples
            </span>
          )}
          {session.loops_recorded > 0 && (
            <span className="flex items-center gap-1">
              <Repeat className="size-3" />
              {session.loops_recorded} loops
            </span>
          )}
        </div>

        {session.vibes_used && session.vibes_used.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {session.vibes_used.slice(0, 5).map((v) => (
              <Badge key={v} variant="outline" className="text-[10px] px-1 py-0">
                {v}
              </Badge>
            ))}
            {session.vibes_used.length > 5 && (
              <span className="text-[10px] text-muted-foreground">
                +{session.vibes_used.length - 5}
              </span>
            )}
          </div>
        )}
      </div>

      {session.kit_id && (
        <Badge variant="secondary" className="shrink-0 text-xs">
          {session.kit_id}
        </Badge>
      )}
    </div>
  );
}
