import { getDeezerTrack } from "@/lib/deezer";
import { parseDeezerSongId } from "@/lib/db/queries/songs";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 15;

/**
 * GET /api/songs/[id]/preview
 *
 * Same-origin proxy for a song's 30s preview mp3. Deezer's preview CDN doesn't
 * grant CORS, so the browser can't fetch the bytes directly to run Web Audio
 * analysis — we stream them through here. Resolves a fresh preview url first
 * (they expire after a few hours).
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
  if (!track?.previewUrl) {
    return Response.json({ error: "No preview available" }, { status: 404 });
  }

  const upstream = await fetch(track.previewUrl);
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: "Preview fetch failed" }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "audio/mpeg",
      // Previews expire upstream; cache briefly so a re-analyze doesn't refetch.
      "Cache-Control": "private, max-age=1800",
    },
  });
}
