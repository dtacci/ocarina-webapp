import { z } from "zod";
import { authenticateDevice } from "@/lib/api/auth-device";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  mp3_blob_url: z.string().url(),
});

// PATCH /api/sync/samples/[id]/preview
// Called by Pi batch script to store the Vercel Blob URL of a generated MP3 preview.
// Uses device auth (API key) since this is called by the Pi script, not a browser session.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const device = await authenticateDevice(request);
  if (!device) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const sampleId = decodeURIComponent(id);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("samples")
    .update({ mp3_blob_url: parsed.data.mp3_blob_url })
    .eq("id", sampleId);

  if (error) {
    return Response.json({ error: "Failed to update sample" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
