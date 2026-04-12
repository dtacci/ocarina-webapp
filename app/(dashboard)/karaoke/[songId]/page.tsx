import { notFound } from "next/navigation";
import { getKaraokeSong } from "@/lib/db/queries/karaoke";
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
  const song = await getKaraokeSong(decodeURIComponent(songId));
  if (!song) notFound();

  // Lyrics are fetched client-side to avoid blocking the initial render on the
  // LRCLIB external API call. The client hits /api/karaoke/[id]/lyrics which
  // has a 24h cache, so repeat visits are instant.
  return <KaraokeSession song={song} />;
}
