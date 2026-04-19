import { authenticateDevice } from "@/lib/api/auth-device";

/**
 * Pi forwards rich device telemetry here (notes played, FX changes, kit
 * switches, karaoke/madlibs phase, heartbeats). Each payload is rebroadcast on
 * the Supabase Realtime topic `device_telemetry_${deviceId}` for the Live
 * Console page (`/diagnostics/live`) to consume.
 *
 * Button presses stay on `device_input_${deviceId}` (see input-events/route.ts
 * and hooks/use-hardware-input.ts) — this endpoint handles everything else.
 *
 * Request body shape (discriminated by `type`):
 *   { type: "NOTE",      name: string, hz: number, confidence?: number, ts?: number }
 *   { type: "FX",        field: "mode"|"harmony"|"distort"|"reverb"|"reverb_level"|
 *                               "waveform"|"synth_harmony"|"synth_harmony_interval"|
 *                               "octave",
 *                         value: string|number|boolean,
 *                         ts?: number }
 *   { type: "HEARTBEAT", uptime_ms: number, ts?: number }
 *   { type: "KIT",       name: string, ts?: number }
 *   { type: "KARAOKE",   song?: { title: string; artist?: string },
 *                         playing: boolean, pitch_offset?: number, ts?: number }
 *   { type: "MADLIBS",   phase: "IDLE"|"PROMPTING"|"CONFIRMING"|"READING",
 *                         template?: string, ts?: number }
 */

const ALLOWED_TYPES = new Set(["NOTE", "FX", "HEARTBEAT"]);

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

  const type = typeof body.type === "string" ? body.type : undefined;
  if (!type || !ALLOWED_TYPES.has(type)) {
    return Response.json({ error: "Unknown telemetry type" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: "Realtime unavailable" }, { status: 500 });
  }

  const payload = { ...body, ts: typeof body.ts === "number" ? body.ts : Date.now() };

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
          topic: `device_telemetry_${device.id}`,
          event: type.toLowerCase(),
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
