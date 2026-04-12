import { authenticateDevice } from "@/lib/api/auth-device";
import { createAdminClient } from "@/lib/supabase/admin";

// POST — upload session data from device
export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sessions } = body;

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return Response.json({ error: "Missing sessions array" }, { status: 400 });
  }

  if (sessions.length > 100) {
    return Response.json({ error: "Max 100 sessions per batch" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const rows = sessions.map((s: Record<string, unknown>) => ({
    user_id: device.userId,
    device_id: device.id,
    started_at: s.started_at,
    ended_at: s.ended_at ?? null,
    duration_sec: s.duration_sec ?? null,
    kit_id: s.kit_id ?? null,
    samples_played: s.samples_played ?? 0,
    loops_recorded: s.loops_recorded ?? 0,
    vibes_used: s.vibes_used ?? [],
    mode: s.mode ?? "instrument",
    metadata: s.metadata ?? null,
  }));

  const { data, error } = await supabase
    .from("sessions")
    .insert(rows)
    .select("id");

  if (error) {
    return Response.json({ error: "Failed to save sessions" }, { status: 500 });
  }

  // Update device last_sync_at
  await supabase
    .from("devices")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", device.id);

  return Response.json({
    saved: data?.length ?? 0,
    ids: data?.map((d) => d.id) ?? [],
  });
}
