import { authenticateDevice } from "@/lib/api/auth-device";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST — web app queues a command for the Pi
// Body: { deviceId, command, params }
//
// Special kind: { command: "sim_key", params: { key: "w", event: "down"|"up" } }
// — simulates a hardware/keyboard button press on the device. Used by the Live
// Console page to drive the same code path as a physical button. Rate-limited
// to 20 sim_key events per device per second.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { deviceId, command, params } = await request.json();
  if (!deviceId || !command) {
    return Response.json({ error: "Missing deviceId or command" }, { status: 400 });
  }

  // Verify the user owns this device
  const { data: device } = await supabase
    .from("devices")
    .select("id")
    .eq("id", deviceId)
    .eq("user_id", user.id)
    .single();

  if (!device) {
    return Response.json({ error: "Device not found" }, { status: 404 });
  }

  if (command === "sim_key") {
    const key = params?.key;
    const event = params?.event;
    if (typeof key !== "string" || key.length === 0 || key.length > 4) {
      return Response.json({ error: "sim_key requires a short `key` string" }, { status: 400 });
    }
    if (event !== "down" && event !== "up" && event !== "tap") {
      return Response.json(
        { error: "sim_key `event` must be 'down' | 'up' | 'tap'" },
        { status: 400 }
      );
    }

    // 20/sec rate limit per device
    const admin = createAdminClient();
    const oneSecondAgo = new Date(Date.now() - 1000).toISOString();
    const { count } = await admin
      .from("device_commands")
      .select("id", { count: "exact", head: true })
      .eq("device_id", deviceId)
      .eq("command", "sim_key")
      .gte("created_at", oneSecondAgo);
    if ((count ?? 0) >= 20) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
  }

  const { data, error } = await supabase
    .from("device_commands")
    .insert({ device_id: deviceId, command, params: params ?? {} })
    .select("id")
    .single();

  if (error) {
    return Response.json({ error: "Failed to queue command" }, { status: 500 });
  }

  return Response.json({ commandId: data.id });
}

// GET — Pi polls for pending commands (API key auth)
// Uses admin client so RLS doesn't block Pi requests (no user session).
export async function GET(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("device_commands")
    .select("id, command, params, created_at")
    .eq("device_id", device.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    return Response.json({ error: "Failed to fetch commands" }, { status: 500 });
  }

  // Mark all returned commands as consumed
  if (data && data.length > 0) {
    const ids = data.map((c) => c.id);
    await supabase
      .from("device_commands")
      .update({ status: "consumed", consumed_at: new Date().toISOString() })
      .in("id", ids);
  }

  return Response.json({ commands: data ?? [] });
}
