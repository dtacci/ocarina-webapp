import { authenticateDevice } from "@/lib/api/auth-device";

/**
 * Pi firmware calls this when a hardware button or rotary encoder fires.
 * Publishes the event on the Supabase Realtime broadcast channel
 * `device_input_${deviceId}`. No DB write — these events are ephemeral.
 *
 * Browser consumers subscribe via `useHardwareInput(deviceId)` in
 * hooks/use-hardware-input.ts.
 *
 * Request body shape:
 *   {
 *     button?: number,         // 1-8
 *     event?: "press" | "release",
 *     rotary?: number,         // +1 / -1 for encoder clicks
 *     ts?: number              // Pi-side timestamp (ms since epoch)
 *   }
 *
 * At least one of `button` or `rotary` is required.
 */
export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const button = typeof body.button === "number" ? body.button : undefined;
  const rotary = typeof body.rotary === "number" ? body.rotary : undefined;
  const event = body.event === "press" || body.event === "release" ? body.event : undefined;
  const ts = typeof body.ts === "number" ? body.ts : Date.now();

  if (button === undefined && rotary === undefined) {
    return Response.json({ error: "Need button or rotary" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: "Realtime unavailable" }, { status: 500 });
  }

  const payload = { button, event, rotary, ts };

  const resp = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `device_input_${device.id}`,
          event: "hw",
          payload,
          private: false,
        },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return Response.json(
      { error: "Broadcast failed", detail: text.slice(0, 200) },
      { status: 502 }
    );
  }

  return Response.json({ ok: true });
}
