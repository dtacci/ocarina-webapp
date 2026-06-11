import { authenticateDevice } from "@/lib/api/auth-device";
import { hasMlConsent } from "@/lib/events/log";

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
    // Pi toggles its InteractionLogger off this flag (docs/EVENTS.md).
    interactions_enabled: await hasMlConsent(device.userId),
  });
}
