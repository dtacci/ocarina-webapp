import { getKaraokeSong } from "@/lib/db/queries/karaoke";

// GET /api/karaoke/[id]/lyrics
// Proxies LRCLIB (https://lrclib.net) to avoid CORS.
// Returns LRC synced lyrics and/or plain text.
// Cached for 24h — lyrics don't change.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const song = await getKaraokeSong(decodeURIComponent(id));

  if (!song) {
    return Response.json({ found: false, syncedLyrics: null, plainLyrics: null }, { status: 404 });
  }

  // Build LRCLIB query params
  const qs = new URLSearchParams({
    artist_name: song.artist,
    track_name: song.title,
  });
  if (song.duration_sec) {
    qs.set("duration", String(song.duration_sec));
  }

  try {
    const lrclibRes = await fetch(`https://lrclib.net/api/get?${qs.toString()}`, {
      headers: { "User-Agent": "DigitalOcarina/1.0 (https://github.com/dtacci/digital-ocarina)" },
      // Next.js fetch cache — revalidate once per day
      next: { revalidate: 86400 },
    });

    if (!lrclibRes.ok) {
      return Response.json(
        { found: false, syncedLyrics: null, plainLyrics: null },
        { headers: { "Cache-Control": "public, max-age=3600" } }
      );
    }

    const data = await lrclibRes.json();

    return Response.json(
      {
        found: true,
        syncedLyrics: data.syncedLyrics ?? null,
        plainLyrics: data.plainLyrics ?? null,
        instrumental: data.instrumental ?? false,
        duration: data.duration ?? null,
      },
      { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600" } }
    );
  } catch {
    return Response.json(
      { found: false, syncedLyrics: null, plainLyrics: null },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  }
}
