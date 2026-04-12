import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { deviceId, config } = await request.json();

  if (!deviceId || !config) {
    return Response.json({ error: "Missing deviceId or config" }, { status: 400 });
  }

  // Verify device belongs to user
  const { data: device } = await supabase
    .from("devices")
    .select("id")
    .eq("id", deviceId)
    .eq("user_id", user.id)
    .single();

  if (!device) {
    return Response.json({ error: "Device not found" }, { status: 404 });
  }

  // Get current version
  const { data: latest } = await supabase
    .from("device_configs")
    .select("version")
    .eq("device_id", deviceId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const newVersion = (latest?.version ?? 0) + 1;

  const { error } = await supabase.from("device_configs").insert({
    device_id: deviceId,
    config_json: config,
    config_yaml: null,
    version: newVersion,
    source: "web",
  });

  if (error) {
    return Response.json({ error: "Failed to save config" }, { status: 500 });
  }

  return Response.json({ version: newVersion, saved: true });
}
