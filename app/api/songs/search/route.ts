import { randomUUID } from "crypto";

import { searchDeezer, deezerSongId } from "@/lib/deezer";
import { cacheSongsFromSearch } from "@/lib/db/queries/songs";
import { logInteraction } from "@/lib/events/log";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 15;

/**
 * GET /api/songs/search?q=<query>
 *
 * Auth'd server-side proxy over Deezer's public search (Deezer sends no CORS
 * headers, so the browser can't call it directly). Warms the songs cache and
 * logs the lookup for the flywheel. bpm/isrc aren't in the search payload —
 * they're filled on selection via GET /api/songs/[id].
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length > 200) {
    return Response.json({ error: "Invalid query" }, { status: 400 });
  }

  let tracks;
  try {
    tracks = await searchDeezer(q);
  } catch (err) {
    console.error("deezer search failed:", err);
    return Response.json({ error: "Search failed" }, { status: 502 });
  }

  // Warm the catalog (fire-and-forget; insert-if-new so enriched rows survive).
  void cacheSongsFromSearch(tracks);

  const queryId = randomUUID();
  void logInteraction(
    { userId: user.id, source: "web" },
    {
      eventType: "song_search_executed",
      queryId,
      payload: {
        query_text: q,
        result_count: tracks.length,
        results: tracks.map((t) => ({
          song_id: deezerSongId(t.deezerId),
          title: t.title,
          artist: t.artist,
        })),
      },
    },
  );

  return Response.json({
    queryId,
    results: tracks.map((t) => ({
      id: deezerSongId(t.deezerId),
      title: t.title,
      artist: t.artist,
      album: t.album,
      albumArtUrl: t.albumArtUrl,
      previewUrl: t.previewUrl,
      durationSec: t.durationSec,
    })),
  });
}
