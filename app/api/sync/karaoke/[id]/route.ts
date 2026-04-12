import { z } from "zod";
import { authenticateDevice } from "@/lib/api/auth-device";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  midi_blob_url: z.string().url().optional(),
  wav_blob_url: z.string().url().optional(),
}).refine((d) => d.midi_blob_url || d.wav_blob_url, {
  message: "At least one of midi_blob_url or wav_blob_url is required",
});

// PATCH /api/sync/karaoke/[id]
// Called by Pi batch script to store audio blob URLs for karaoke songs.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const device = await authenticateDevice(request);
  if (!device) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const songId = decodeURIComponent(id);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("karaoke_songs")
    .update({
      ...(parsed.data.midi_blob_url ? { midi_blob_url: parsed.data.midi_blob_url } : {}),
      ...(parsed.data.wav_blob_url  ? { wav_blob_url:  parsed.data.wav_blob_url }  : {}),
      available: true,
    })
    .eq("id", songId);

  if (error) return Response.json({ error: "Update failed" }, { status: 500 });
  return Response.json({ ok: true });
}
