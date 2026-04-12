import { zipSync } from "fflate";
import { createClient } from "@/lib/supabase/server";

// GET /api/sessions/[id]/export
// Downloads all recordings in a session as a ZIP file.
// Stems → track_01.wav, track_02.wav … Master → session_mix.mp3
// Partial failures (blob fetch errors) are silently skipped so the user
// still gets a useful ZIP if one track is unavailable.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id: sessionId } = await params;

  // Fetch all recordings belonging to this session (ownership enforced by user_id)
  const { data: recordings, error } = await supabase
    .from("recordings")
    .select("id, blob_url, recording_type, created_at, title")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !recordings || recordings.length === 0) {
    return Response.json({ error: "Session not found or no recordings" }, { status: 404 });
  }

  // Separate master from stems
  const master = recordings.find((r) => r.recording_type === "master");
  const stems = recordings.filter((r) => r.recording_type !== "master");

  if (stems.length === 0 && !master) {
    return Response.json({ error: "No audio files in session" }, { status: 404 });
  }

  // Fetch all blobs in parallel — tolerate individual failures
  const fetchResults = await Promise.allSettled(
    recordings.map(async (rec) => {
      const resp = await fetch(rec.blob_url);
      if (!resp.ok) throw new Error(`${resp.status} for ${rec.blob_url}`);
      return { rec, buf: new Uint8Array(await resp.arrayBuffer()) };
    })
  );

  // Build the files map for fflate — skip any that failed
  const files: Record<string, Uint8Array> = {};
  let stemIdx = 0;
  let successCount = 0;

  for (const result of fetchResults) {
    if (result.status !== "fulfilled") {
      console.error("[sessions/export] blob fetch failed:", (result as PromiseRejectedResult).reason);
      continue;
    }
    const { rec, buf } = result.value;
    let filename: string;
    if (rec.recording_type === "master") {
      filename = "session_mix.mp3";
    } else {
      stemIdx++;
      const ext = rec.blob_url.split(".").pop()?.toLowerCase() ?? "wav";
      filename = `track_${String(stemIdx).padStart(2, "0")}.${ext}`;
    }
    files[filename] = buf;
    successCount++;
  }

  if (successCount === 0) {
    return Response.json({ error: "No audio files could be fetched" }, { status: 404 });
  }

  // Build ZIP synchronously (files are already in memory from the fetches above)
  const zipped = zipSync(files, { level: 0 }); // level 0 = store only (audio is already compressed)

  // Filename for the download: use the date of the earliest recording in the session
  const earliestDate = new Date(recordings[0].created_at).toISOString().slice(0, 10);
  const zipFilename = `ocarina-session-${earliestDate}.zip`;

  return new Response(Buffer.from(zipped), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFilename}"`,
      "Content-Length": String(zipped.length),
    },
  });
}
