import { Badge } from "@/components/ui/badge";
import { Music } from "lucide-react";
import type { KaraokeSongRow } from "@/lib/db/queries/karaoke";

const sourceColors: Record<string, string> = {
  midi: "bg-blue-500",
  wav: "bg-emerald-500",
  both: "bg-violet-500",
};

export function SongCard({ song }: { song: KaraokeSongRow }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3 hover:border-foreground/20 transition-colors">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Music className="size-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium truncate">{song.title}</h3>
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
    </div>
  );
}
