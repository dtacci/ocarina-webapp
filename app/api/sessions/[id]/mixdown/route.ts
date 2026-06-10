import { createClient } from "@/lib/supabase/server";
import { put } from "@vercel/blob";

export const maxDuration = 120;

/**
 * Track editor — save a rendered mixdown as a new recording.
 *
 * The client has already run the offline render (Tone.Offline) and encoded
 * PCM16 WAV — same division of labor as the sample editor's save flow.
 *
 * Body: multipart/form-data
 *   - wav:           Blob (audio/wav)
 *   - name:          string?  (recording title; default "Mixdown")
 *   - durationSec:   string   (number)
 *   - sampleRate:    string   (number)
 *   - waveformPeaks: string?  (JSON number[200])
 *
 * Returns: { id: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // The session must hold at least one of the caller's recordings.
  const { data: sessionRecs } = await supabase
    .from("recordings")
    .select("id,bpm")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .limit(1);
  const parent = sessionRecs?.[0];
  if (!parent) return Response.json({ error: "Session not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  const wav = form.get("wav");
  if (!(wav instanceof Blob)) {
    return Response.json({ error: "Missing wav blob" }, { status: 400 });
  }
  const durationSec = Number(form.get("durationSec"));
  const sampleRate = Number(form.get("sampleRate"));
  if (!Number.isFinite(durationSec) || !Number.isFinite(sampleRate)) {
    return Response.json({ error: "durationSec and sampleRate required" }, { status: 400 });
  }
  const name = (form.get("name") as string | null)?.trim() || "Mixdown";
  let peaks: number[] | null = null;
  try {
    const raw = form.get("waveformPeaks");
    if (typeof raw === "string") peaks = JSON.parse(raw);
  } catch {
    /* peaks are optional */
  }

  const blob = await put(
    `${user.id}/mixdowns/${Date.now()}-${sessionId.slice(0, 8)}.wav`,
    wav,
    { access: "public", contentType: "audio/wav", addRandomSuffix: true },
  );

  const { data, error } = await supabase
    .from("recordings")
    .insert({
      user_id: user.id,
      title: name,
      blob_url: blob.url,
      duration_sec: durationSec,
      sample_rate: sampleRate,
      bpm: parent.bpm,
      waveform_peaks: peaks,
      session_id: sessionId,
      recording_type: "master",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[mixdown] insert failed:", error.message);
    return Response.json({ error: `Failed to save: ${error.message}` }, { status: 500 });
  }
  return Response.json({ id: data.id });
}
