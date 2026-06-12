import { createClient } from "@/lib/supabase/server";
import { put } from "@vercel/blob";

export const maxDuration = 120;

/**
 * DJ mode — save a live master-bus recording as a new (session-less)
 * recording. The client captures via MediaRecorder, decodes, and re-encodes
 * PCM16 WAV — same division of labor as the track editor's mixdown save
 * (app/api/sessions/[id]/mixdown), minus the session parentage.
 *
 * Also used by the drum machine's "save loop" (offline pattern render) —
 * the optional bpm tag is what makes DJ beat-loops work on the result.
 *
 * Body: multipart/form-data
 *   - wav:           Blob (audio/wav)
 *   - name:          string?  (recording title; default "DJ mix")
 *   - durationSec:   string   (number)
 *   - sampleRate:    string   (number)
 *   - waveformPeaks: string?  (JSON number[])
 *   - bpm:           string?  (number)
 *
 * Returns: { id: string }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

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
  const name = (form.get("name") as string | null)?.trim() || "DJ mix";
  const bpmRaw = Number(form.get("bpm"));
  const bpm = Number.isFinite(bpmRaw) && bpmRaw > 0 ? Math.round(bpmRaw) : null;
  let peaks: number[] | null = null;
  try {
    const raw = form.get("waveformPeaks");
    if (typeof raw === "string") peaks = JSON.parse(raw);
  } catch {
    /* peaks are optional */
  }

  const blob = await put(`${user.id}/dj-mixes/${Date.now()}.wav`, wav, {
    access: "public",
    contentType: "audio/wav",
    addRandomSuffix: true,
  });

  const { data, error } = await supabase
    .from("recordings")
    .insert({
      user_id: user.id,
      title: name,
      blob_url: blob.url,
      duration_sec: durationSec,
      sample_rate: sampleRate,
      bpm,
      waveform_peaks: peaks,
      session_id: null,
      recording_type: "master",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[dj-recording] insert failed:", error.message);
    return Response.json({ error: `Failed to save: ${error.message}` }, { status: 500 });
  }
  return Response.json({ id: data.id });
}
