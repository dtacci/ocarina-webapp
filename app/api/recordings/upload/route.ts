import { createClient } from "@/lib/supabase/server";
import { put } from "@vercel/blob";

export const maxDuration = 60;

// Browser recording upload — auth via Supabase session (not API key).
// Body: raw audio bytes. Headers: content-type, x-file-name.
// Returns: { blobUrl: string }
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const fileName = request.headers.get("x-file-name") ?? `recording-${Date.now()}.wav`;
  const contentType = request.headers.get("content-type") ?? "audio/wav";

  const validTypes = ["audio/wav", "audio/wave", "audio/mpeg", "audio/mp3", "audio/x-wav", "audio/m4a", "audio/x-m4a"];
  if (!validTypes.includes(contentType)) {
    return Response.json({ error: "Unsupported content-type" }, { status: 400 });
  }

  if (!request.body) {
    return Response.json({ error: "Empty body" }, { status: 400 });
  }

  const path = `${user.id}/recordings/${Date.now()}-${fileName}`;

  const blob = await put(path, request.body, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });

  return Response.json({ blobUrl: blob.url });
}
