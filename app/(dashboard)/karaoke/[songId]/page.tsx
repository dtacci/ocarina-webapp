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

  // Fetch lyrics directly from LRCLIB — cached 24h, non-critical if fails
  let syncedLyrics: string | null = null;
  let plainLyrics: string | null = null;
  let instrumental = false;

  try {
    const qs = new URLSearchParams({ artist_name: song.artist, track_name: song.title });
    if (song.duration_sec) qs.set("duration", String(song.duration_sec));

    const res = await fetch(`https://lrclib.net/api/get?${qs.toString()}`, {
      headers: {
        "User-Agent": "DigitalOcarina/1.0 (https://github.com/dtacci/digital-ocarina)",
      },
      next: { revalidate: 86400 },
    });

    if (res.ok) {
      const data = await res.json();
      syncedLyrics = data.syncedLyrics ?? null;
      plainLyrics = data.plainLyrics ?? null;
      instrumental = data.instrumental ?? false;
    }
  } catch {
    // Lyrics are non-critical — karaoke still works without them
  }

  return (
    <KaraokeSession
      song={song}
      syncedLyrics={syncedLyrics}
      plainLyrics={plainLyrics}
      instrumental={instrumental}
    />
  );
}
