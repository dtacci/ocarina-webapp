import { createClient } from "@/lib/supabase/server";
import {
  getRecordingById,
  getPublicRecording,
} from "@/lib/db/queries/recordings";
import {
  getDefaultRender,
  getPublicDefaultRender,
  getRenderByHash,
  type TranscriptionRenderRow,
} from "@/lib/db/queries/transcription";
import { generateMidi } from "@/lib/transcription/derive/midi-gen";
import { PARSER_VERSION } from "@/lib/transcription/index";
import type { DerivedNote, DeriveParams } from "@/lib/transcription/types";

/**
 * Export a transcription render (doc §3.6, build order step 8).
 *
 *   GET ?format=musicxml          → the engraved MusicXML
 *   GET ?format=midi              → a standard MIDI file (regenerated from notes)
 *   GET ?format=…&hash=<sha256>   → a specific cached render (owner only)
 *
 * Defaults to the session's default render. Owners can export any cached render;
 * public viewers get the default render of a shared session.
 */

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "transcription";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const hash = url.searchParams.get("hash");
  if (format !== "musicxml" && format !== "midi") {
    return Response.json({ error: "format must be musicxml or midi" }, { status: 400 });
  }

  // Resolve access: owner first, then public share.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isOwner = false;
  let recording = null;
  if (user) {
    recording = await getRecordingById(id, user.id);
    if (recording) isOwner = true;
  }
  if (!recording) recording = await getPublicRecording(id);
  if (!recording || recording.recording_type !== "transcription_session") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let render: TranscriptionRenderRow | null;
  if (isOwner && hash) {
    render = await getRenderByHash(id, hash, PARSER_VERSION);
  } else if (isOwner) {
    render = await getDefaultRender(id);
  } else {
    render = await getPublicDefaultRender(id);
  }
  if (!render) {
    return Response.json({ error: "No render available" }, { status: 404 });
  }

  const baseName = slugify(recording.title ?? "transcription");

  if (format === "musicxml") {
    if (!render.musicxml) {
      return Response.json({ error: "No MusicXML" }, { status: 404 });
    }
    return new Response(render.musicxml, {
      headers: {
        "content-type": "application/vnd.recordare.musicxml+xml; charset=utf-8",
        "content-disposition": `attachment; filename="${baseName}.musicxml"`,
      },
    });
  }

  // MIDI: regenerate from the render's notes + params (cheap; lazy-cache is a
  // later optimization via midi_blob_url).
  const notation = render.notation_jsonb as { notes?: DerivedNote[] } | null;
  const notes = notation?.notes ?? [];
  const midi = generateMidi(notes, render.params_jsonb as DeriveParams);
  return new Response(Buffer.from(midi), {
    headers: {
      "content-type": "audio/midi",
      "content-disposition": `attachment; filename="${baseName}.mid"`,
    },
  });
}
