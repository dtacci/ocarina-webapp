import Link from "next/link";
import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { KaraokeSongRow } from "@/lib/db/queries/karaoke";
import { KaraokeFavoriteButton } from "./karaoke-favorite-button";

const sourceColors: Record<string, string> = {
  midi: "bg-blue-500",
  wav: "bg-emerald-500",
  both: "bg-violet-500",
};

interface Props {
  song: KaraokeSongRow;
  initialFavorite?: boolean;
}

export function SongCard({ song, initialFavorite = false }: Props) {
  const isPlayable = !!(song.midi_blob_url || song.wav_blob_url);

  return (
    <Link
      href={`/karaoke/${encodeURIComponent(song.id)}`}
      className={[
        "group flex items-start gap-3 rounded-lg border p-3 transition-all",
        isPlayable
          ? "hover:border-primary/40 hover:bg-muted/30"
          : "opacity-60 hover:opacity-100 hover:border-foreground/20",
      ].join(" ")}
    >
      {/* Icon — play arrow for playable, muted state for catalog-only */}
      <div className={[
        "flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors",
        isPlayable ? "bg-muted group-hover:bg-primary/10" : "bg-muted/50",
      ].join(" ")}>
        <Play className={[
          "size-4 transition-colors ml-0.5",
          isPlayable
            ? "text-muted-foreground group-hover:text-primary"
            : "text-muted-foreground/40",
        ].join(" ")} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {song.title}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            {song.duration_sec && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {Math.floor(song.duration_sec / 60)}:{String(song.duration_sec % 60).padStart(2, "0")}
              </span>
            )}
            <KaraokeFavoriteButton
              songId={song.id}
              initialFavorite={initialFavorite}
            />
          </div>
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
