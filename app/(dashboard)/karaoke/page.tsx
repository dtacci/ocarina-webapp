import { Suspense } from "react";
import { getKaraokeSongs, type KaraokeFilters } from "@/lib/db/queries/karaoke";
import { getUserKaraokeData } from "@/lib/db/queries/karaoke-user-data";
import { createClient } from "@/lib/supabase/server";
import { SongCard } from "@/components/karaoke/song-card";
import { KaraokeFilters as Filters } from "@/components/karaoke/karaoke-filters";
import { Pagination } from "@/components/samples/pagination";
import { Badge } from "@/components/ui/badge";
import { Mic } from "lucide-react";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function KaraokePage({ searchParams }: Props) {
  const params = await searchParams;

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp.user?.id;

  const favOnly = params.fav === "1";

  const filters: KaraokeFilters = {
    decade: typeof params.decade === "string" ? params.decade : undefined,
    genre: typeof params.genre === "string" ? params.genre : undefined,
    search: typeof params.q === "string" ? params.q : undefined,
    page: typeof params.page === "string" ? parseInt(params.page) : 1,
    perPage: 24,
    favoritedBy: favOnly && userId ? userId : undefined,
  };

  const { songs, total } = await getKaraokeSongs(filters);
  const totalPages = Math.ceil(total / (filters.perPage ?? 24));

  const userData = userId
    ? await getUserKaraokeData(userId, songs.map((s) => s.id))
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Karaoke</h1>
          <p className="text-muted-foreground">
            Browse {total > 0 ? total.toLocaleString() : ""} songs — filter by decade, genre, or search.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {total.toLocaleString()} songs
        </Badge>
      </div>

      <Suspense>
        <Filters signedIn={!!userId} />
      </Suspense>

      {songs.length > 0 ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {songs.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                initialFavorite={userData?.get(song.id)?.isFavorite ?? false}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <Suspense>
              <Pagination page={filters.page ?? 1} totalPages={totalPages} total={total} />
            </Suspense>
          )}
        </>
      ) : (
        <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <Mic className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">No songs found</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your filters or search terms
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
