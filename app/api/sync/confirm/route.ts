import { authenticateDevice } from "@/lib/api/auth-device";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { fileType, blobUrl, metadata } = body;

  if (!fileType || !blobUrl) {
    return Response.json({ error: "Missing fileType or blobUrl" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (fileType === "recording") {
    const { title, duration_sec, sample_rate, bpm, kit_id, waveform_peaks } = metadata ?? {};
    const { data, error } = await supabase
      .from("recordings")
      .insert({
        user_id: device.userId,
        device_id: device.id,
        title: title ?? "Untitled Recording",
        blob_url: blobUrl,
        duration_sec: duration_sec ?? 0,
        sample_rate: sample_rate ?? 44100,
        bpm: bpm ?? null,
        kit_id: kit_id ?? null,
        waveform_peaks: waveform_peaks ?? null,
        is_public: false,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: "Failed to save recording" }, { status: 500 });
    }

    // Update device last_sync_at
    await supabase
      .from("devices")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", device.id);

    return Response.json({ recording: data });
  }

  return Response.json({ error: "Unsupported fileType" }, { status: 400 });
}
