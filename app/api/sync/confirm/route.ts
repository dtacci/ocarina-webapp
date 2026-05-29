import { authenticateDevice } from "@/lib/api/auth-device";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestSession } from "@/lib/transcription/ingest";

// Transcription parse + default render runs inline (Pattern A); bounded and small.
export const maxDuration = 120;

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

  // Transcription session: the device uploaded a .ocrec.jsonl to Blob; run the
  // same parse + default-render pipeline the dev ingest route uses. The file is
  // already in Blob, so ingestSession reuses that URL rather than re-uploading.
  const isTranscription =
    fileType === "transcription" ||
    metadata?.recording_type === "transcription_session";
  if (isTranscription) {
    try {
      const res = await fetch(blobUrl);
      if (!res.ok) throw new Error(`Could not fetch ${blobUrl}`);
      const payload = new Uint8Array(await res.arrayBuffer());
      const result = await ingestSession(payload, {
        userId: device.userId,
        deviceId: device.id,
        title: metadata?.title,
        existingBlobUrl: blobUrl,
      });
      await supabase
        .from("devices")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", device.id);
      return Response.json({ recordingId: result.recordingId, transcription: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ingestion failed";
      console.error("[sync/confirm] transcription ingest failed:", message);
      return Response.json({ error: message }, { status: 500 });
    }
  }

  if (fileType === "recording") {
    const { title, duration_sec, sample_rate, bpm, kit_id, waveform_peaks, session_id, recording_type } = metadata ?? {};

    // Infer type if not provided: sessions produce stems, browser uploads stay 'upload'
    const resolvedType: string = recording_type ?? (session_id ? "stem" : "upload");

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
        session_id: session_id ?? null,
        recording_type: resolvedType,
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
