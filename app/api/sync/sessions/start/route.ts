import { authenticateDevice } from "@/lib/api/auth-device";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/sync/sessions/start
// Called by Pi at begin_session() so recordings can reference a real session ID
// immediately, rather than waiting for the end-of-session flush.
export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { kit_id, started_at } = body as {
    kit_id?: string | null;
    started_at?: string;
  };

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: device.userId,
      device_id: device.id,
      started_at: started_at ?? new Date().toISOString(),
      kit_id: kit_id ?? null,
      mode: "looper",
      samples_played: 0,
      loops_recorded: 0,
      vibes_used: [],
    })
    .select("id")
    .single();

  if (error || !data) {
    return Response.json({ error: "Failed to create session" }, { status: 500 });
  }

  return Response.json({ session_id: data.id });
}
