import { authenticateDevice } from "@/lib/api/auth-device";
import { put } from "@vercel/blob";

export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!device.capabilities.sync) {
    return Response.json({ error: "Device does not support sync" }, { status: 403 });
  }

  const body = await request.json();
  const { fileName, fileType, contentType } = body;

  if (!fileName || !fileType || !contentType) {
    return Response.json({ error: "Missing fileName, fileType, or contentType" }, { status: 400 });
  }

  const validTypes = ["recording", "sample", "config"];
  if (!validTypes.includes(fileType)) {
    return Response.json({ error: "Invalid fileType" }, { status: 400 });
  }

  // Generate a unique path in Vercel Blob
  const path = `${device.userId}/${fileType}s/${Date.now()}-${fileName}`;

  // For client uploads, return a presigned URL
  // The Pi will upload directly to Blob using this URL
  const blob = await put(path, new Blob([]), {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });

  return Response.json({
    uploadUrl: blob.url,
    blobUrl: blob.url,
    path,
  });
}
