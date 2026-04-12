import { authenticateDevice } from "@/lib/api/auth-device";

export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // last_seen_at already updated by authenticateDevice
  return Response.json({
    status: "ok",
    deviceId: device.id,
    serverTime: new Date().toISOString(),
  });
}
