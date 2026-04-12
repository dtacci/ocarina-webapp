import { authenticateDevice } from "@/lib/api/auth-device";
import { put } from "@vercel/blob";

export const maxDuration = 60;

// Accepts a raw binary audio file from the Pi (or any device).
// The file is streamed directly into Vercel Blob — no body buffering on the server.
// Pi sends: POST /api/sync/upload
//   Headers: x-api-key, x-file-name, content-type
//   Body:    raw WAV/MP3 bytes
// Returns:  { blobUrl: string }
export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!device.capabilities.sync) {
    return Response.json({ error: "Device does not support sync" }, { status: 403 });
  }

  const fileName = request.headers.get("x-file-name") ?? `recording-${Date.now()}.wav`;
  const contentType = request.headers.get("content-type") ?? "audio/wav";

  const validTypes = ["audio/wav", "audio/wave", "audio/mpeg", "audio/mp3", "audio/x-wav"];
  if (!validTypes.includes(contentType)) {
    return Response.json({ error: "Unsupported content-type" }, { status: 400 });
  }

  if (!request.body) {
    return Response.json({ error: "Empty body" }, { status: 400 });
  }

  const path = `${device.userId}/recordings/${Date.now()}-${fileName}`;

  const blob = await put(path, request.body, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });

  return Response.json({ blobUrl: blob.url });
}
