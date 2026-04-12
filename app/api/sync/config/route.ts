import { authenticateDevice } from "@/lib/api/auth-device";
import { createAdminClient } from "@/lib/supabase/admin";

// GET — pull latest config for this device
export async function GET(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!device.capabilities.config) {
    return Response.json({ error: "Device does not support config" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("device_configs")
    .select("*")
    .eq("device_id", device.id)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return Response.json({ config: null, version: 0 });
  }

  return Response.json({
    config: data.config_json,
    configYaml: data.config_yaml,
    version: data.version,
    source: data.source,
    updatedAt: data.created_at,
  });
}

// POST — push config from device
export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!device.capabilities.config) {
    return Response.json({ error: "Device does not support config" }, { status: 403 });
  }

  const body = await request.json();
  const { configYaml, configJson, version } = body;

  if (!configJson) {
    return Response.json({ error: "Missing configJson" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Check if server has a newer version from web
  const { data: latest } = await supabase
    .from("device_configs")
    .select("version, source")
    .eq("device_id", device.id)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const serverVersion = latest?.version ?? 0;
  const newVersion = Math.max(serverVersion, version ?? 0) + 1;

  // If server has a newer web-sourced version, web wins
  if (latest && latest.version > (version ?? 0) && latest.source === "web") {
    return Response.json({
      conflict: true,
      serverVersion: latest.version,
      message: "Server has a newer web-edited config. Pull first.",
    }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("device_configs")
    .insert({
      device_id: device.id,
      config_yaml: configYaml ?? null,
      config_json: configJson,
      version: newVersion,
      source: "device",
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: "Failed to save config" }, { status: 500 });
  }

  return Response.json({ version: data.version, saved: true });
}
