import { authenticateDevice } from "@/lib/api/auth-device";
import { createAdminClient } from "@/lib/supabase/admin";

// Pi calls this when loop engine state changes.
// Updates devices.loop_state, which triggers Supabase Postgres Changes → browser.
export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { tracks, bpm, master_length_ms, active_track } = body;

  if (!Array.isArray(tracks)) {
    return Response.json({ error: "Missing tracks array" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("devices")
    .update({
      loop_state: { tracks, bpm: bpm ?? null, master_length_ms: master_length_ms ?? 0, active_track: active_track ?? 1 },
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", device.id);

  if (error) {
    return Response.json({ error: "Failed to update loop state" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
