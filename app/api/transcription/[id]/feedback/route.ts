import { createClient } from "@/lib/supabase/server";
import { getRecordingById } from "@/lib/db/queries/recordings";

/**
 * "This looks wrong" feedback (doc §6.1/§6.7). Stores a freeform note plus the
 * params snapshot for later debugging / an ML cleanup pass. Owner-scoped.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  const recording = await getRecordingById(id, user.id);
  if (!recording) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: { message?: string; params?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const { error } = await supabase.from("transcription_feedback").insert({
    session_id: id,
    user_id: user.id,
    message: message.slice(0, 2000),
    params_jsonb: body.params ?? null,
  });
  if (error) {
    return Response.json({ error: "Failed to save feedback" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
