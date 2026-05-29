import { createClient } from "@/lib/supabase/server";
import { ingestSession } from "@/lib/transcription/ingest";
import { generateOcrec } from "@/lib/transcription/fake-events";
import { getSong, SONG_NAMES } from "@/lib/transcription/songs";

// Parse + default-render runs inline (Pattern A); bounded and small for fake data.
export const maxDuration = 120;

/**
 * DEV-ONLY ingestion path for transcription sessions — the no-device entry point
 * for Phase 1 (doc §12). Generates (or accepts) a `.ocrec.jsonl`, then runs the
 * shared `ingestSession` pipeline. The real device will hit /api/sync/confirm
 * instead, which will call the same `ingestSession`.
 *
 * Auth: the signed-in user (their id owns the session). In production this route
 * should be disabled or admin-gated.
 *
 * Body (JSON):
 *   { song: "twinkle" }            // generate from the song library, or
 *   { jsonl: "<header>\n<event>…" } // ingest a raw .ocrec.jsonl string
 *   { title?: string }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { song?: string; jsonl?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let jsonl: string;
  let title = body.title;
  if (body.jsonl) {
    jsonl = body.jsonl;
  } else if (body.song) {
    const song = getSong(body.song);
    if (!song) {
      return Response.json(
        { error: `Unknown song "${body.song}". Available: ${SONG_NAMES.join(", ")}` },
        { status: 400 },
      );
    }
    jsonl = generateOcrec(song);
    title = title ?? song.name;
  } else {
    return Response.json(
      { error: "Provide either { song } or { jsonl }." },
      { status: 400 },
    );
  }

  try {
    const result = await ingestSession(jsonl, { userId: user.id, title });
    return Response.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    console.error("[transcription/ingest-dev]", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
