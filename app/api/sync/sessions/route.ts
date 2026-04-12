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

  const savedIds: string[] = [];

  for (const s of sessions as Record<string, unknown>[]) {
    const sessionId = s.session_id as string | undefined;

    if (sessionId) {
      // Session was pre-created via /sessions/start — update in place
      const { data } = await supabase
        .from("sessions")
        .update({
          ended_at: s.ended_at ?? new Date().toISOString(),
          duration_sec: s.duration_sec ?? null,
          kit_id: s.kit_id ?? null,
          samples_played: s.samples_played ?? 0,
          loops_recorded: s.loops_recorded ?? 0,
          vibes_used: s.vibes_used ?? [],
          mode: s.mode ?? "looper",
          metadata: s.metadata ?? null,
        })
        .eq("id", sessionId)
        .eq("user_id", device.userId) // ownership check
        .select("id")
        .single();

      if (data) savedIds.push(data.id);
    } else {
      // Legacy path: session not pre-created (e.g. instrument mode), insert new row
      const { data } = await supabase
        .from("sessions")
        .insert({
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
        })
        .select("id")
        .single();

      if (data) savedIds.push(data.id);
    }
  }

  // Update device last_sync_at
  await supabase
    .from("devices")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", device.id);

  return Response.json({ saved: savedIds.length, ids: savedIds });
}
