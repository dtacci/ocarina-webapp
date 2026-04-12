import { del } from "@vercel/blob";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getRecordingById,
  updateRecording,
  deleteRecording,
} from "@/lib/db/queries/recordings";

// PATCH /api/recordings/[id]
// Body: { title?, isPublic?, bpm? }
// Returns: updated recording row
const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isPublic: z.boolean().optional(),
  bpm: z.number().int().min(40).max(240).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { title, isPublic, bpm } = parsed.data;

  // Map camelCase input to snake_case DB columns
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (isPublic !== undefined) updates.is_public = isPublic;
  if (bpm !== undefined) updates.bpm = bpm;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await updateRecording(id, user.id, updates as Parameters<typeof updateRecording>[2]);
  if (!updated) {
    return Response.json({ error: "Recording not found or not authorized" }, { status: 404 });
  }

  return Response.json({ recording: updated });
}

// DELETE /api/recordings/[id]
// Deletes from DB first, then best-effort deletes from Vercel Blob
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;

  // Fetch first so we have the blob URL for cleanup
  const recording = await getRecordingById(id, user.id);
  if (!recording) {
    return Response.json({ error: "Recording not found or not authorized" }, { status: 404 });
  }

  // Delete from DB first (user can't see it anymore, even if blob cleanup fails)
  const deleted = await deleteRecording(id, user.id);
  if (!deleted) {
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }

  // Best-effort blob cleanup — don't fail the request if this errors
  try {
    await del(recording.blob_url);
  } catch {
    console.error(`[recordings/delete] Failed to delete blob: ${recording.blob_url}`);
  }

  return new Response(null, { status: 204 });
}
