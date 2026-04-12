import { notFound } from "next/navigation";
import { getKaraokeSong } from "@/lib/db/queries/karaoke";
import { getUserKaraokeState } from "@/lib/db/queries/karaoke-user-data";
import { createClient } from "@/lib/supabase/server";
import { KaraokeSession } from "@/components/karaoke/karaoke-session";

interface Props {
  params: Promise<{ songId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { songId } = await params;
  const song = await getKaraokeSong(decodeURIComponent(songId));
  if (!song) return {};
  return {
    title: `${song.title} — ${song.artist} | Karaoke`,
  };
}

export default async function KaraokeSongPage({ params }: Props) {
  const { songId } = await params;
  const decodedId = decodeURIComponent(songId);

  const supabase = await createClient();
  const [song, userResp] = await Promise.all([
    getKaraokeSong(decodedId),
    supabase.auth.getUser(),
  ]);
  if (!song) notFound();

  const userId = userResp.data.user?.id;
  const userState = userId
    ? await getUserKaraokeState(userId, song.id)
    : { isFavorite: false };

  // Lyrics are fetched client-side to avoid blocking the initial render on the
  // LRCLIB external API call. The client hits /api/karaoke/[id]/lyrics which
  // has a 24h cache, so repeat visits are instant.
  return <KaraokeSession song={song} initialFavorite={userState.isFavorite} />;
}
