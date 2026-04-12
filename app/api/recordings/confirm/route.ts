import { createClient } from "@/lib/supabase/server";

// Confirms a browser-uploaded recording — writes metadata + peaks to DB.
// Body: { blobUrl, metadata: { title, duration_sec, waveform_peaks } }
// Returns: { recording }
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { blobUrl, metadata } = body;

  if (!blobUrl) {
    return Response.json({ error: "Missing blobUrl" }, { status: 400 });
  }

  const { title, duration_sec, waveform_peaks, bpm, kit_id } = metadata ?? {};

  const { data, error } = await supabase
    .from("recordings")
    .insert({
      user_id: user.id,
      title: title ?? "Untitled Recording",
      blob_url: blobUrl,
      duration_sec: duration_sec ?? 0,
      waveform_peaks: waveform_peaks ?? null,
      bpm: bpm ?? null,
      kit_id: kit_id ?? null,
      is_public: false,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: "Failed to save recording" }, { status: 500 });
  }

  return Response.json({ recording: data });
}
