import Link from "next/link";
import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { KaraokeSongRow } from "@/lib/db/queries/karaoke";

const sourceColors: Record<string, string> = {
  midi: "bg-blue-500",
  wav: "bg-emerald-500",
  both: "bg-violet-500",
};

export function SongCard({ song }: { song: KaraokeSongRow }) {
  return (
    <Link
      href={`/karaoke/${encodeURIComponent(song.id)}`}
      className="group flex items-start gap-3 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/30 transition-all"
    >
      {/* Icon — shows play arrow on hover */}
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
        <Play className="size-4 text-muted-foreground group-hover:text-primary transition-colors ml-0.5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {song.title}
          </h3>
          {song.duration_sec && (
            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
              {Math.floor(song.duration_sec / 60)}:{String(song.duration_sec % 60).padStart(2, "0")}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {song.decade && song.decade !== "unknown" && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {song.decade}
            </Badge>
          )}
          {song.genre?.slice(0, 2).map((g) => (
            <Badge key={g} variant="outline" className="text-[10px] px-1 py-0">
              {g}
            </Badge>
          ))}
          <span
            className={`inline-block size-1.5 rounded-full ${sourceColors[song.source] ?? "bg-gray-400"}`}
            title={`Source: ${song.source}`}
          />
        </div>
      </div>
    </Link>
  );
}
