import { getDeezerTrack, deezerSongId } from "@/lib/deezer";
import {
  getSong,
  upsertSong,
  parseDeezerSongId,
  songRowToDto,
} from "@/lib/db/queries/songs";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 15;

/**
 * GET /api/songs/[id]
 *
 * Resolves a song to fresh, complete metadata: bpm + isrc (absent from search)
 * and a fresh 30s preview url (Deezer previews expire after a few hours), then
 * upserts the cache. Called right before client-side analysis. Falls back to a
 * cached row if Deezer is unreachable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deezerId = parseDeezerSongId(decodeURIComponent(id));
  if (deezerId == null) {
    return Response.json({ error: "Unsupported song id" }, { status: 400 });
  }

  const track = await getDeezerTrack(deezerId);
  if (!track) {
    const cached = await getSong(deezerSongId(deezerId));
    if (cached) {
      return Response.json({ song: songRowToDto(cached), fresh: false });
    }
    return Response.json({ error: "Song not found" }, { status: 404 });
  }

  const row = await upsertSong(track);
  return Response.json({ song: songRowToDto(row), fresh: true });
}
