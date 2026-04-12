import { Badge } from "@/components/ui/badge";
import { Clock, Music } from "lucide-react";
import type { RecordingRow } from "@/lib/db/queries/recordings";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RecordingCard({ recording }: { recording: RecordingRow }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 hover:border-foreground/20 transition-colors">
      {/* Fake waveform */}
      <div className="h-16 rounded bg-muted flex items-end gap-px px-1 py-1">
        {Array.from({ length: 40 }, (_, i) => {
          const height = 20 + Math.sin(i * 0.8 + recording.id.charCodeAt(0)) * 30 +
            Math.cos(i * 1.5) * 25;
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-primary/30"
              style={{ height: `${Math.max(10, Math.min(100, height))}%` }}
            />
          );
        })}
      </div>

      <div>
        <h3 className="font-medium text-sm truncate">{recording.title}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDuration(recording.duration_sec)}
          </span>
          {recording.bpm && (
            <span className="flex items-center gap-1">
              <Music className="size-3" />
              {recording.bpm} BPM
            </span>
          )}
          <span>{formatDate(recording.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {recording.kit_id && (
          <Badge variant="secondary" className="text-xs capitalize">
            {recording.kit_id.replace(/-/g, " ")}
          </Badge>
        )}
        {recording.is_public && (
          <Badge variant="outline" className="text-[10px] px-1 py-0">public</Badge>
        )}
      </div>
    </div>
  );
}
