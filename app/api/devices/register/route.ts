import { createClient } from "@/lib/supabase/server";
import { randomBytes, createHash } from "crypto";

const DEVICE_CAPABILITIES: Record<string, Record<string, boolean>> = {
  pi_pro: { sync: true, looper: true, karaoke: true, samples: true, config: true, realtime: true },
  mobile_app: { sync: true, looper: true, karaoke: true, samples: true, config: true, realtime: true },
  arduino_lite: { sync: true, looper: false, karaoke: false, samples: false, config: false, realtime: false },
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { name, deviceType } = body;

  if (!name || typeof name !== "string" || name.length > 100) {
    return Response.json({ error: "Invalid device name" }, { status: 400 });
  }

  const validTypes = ["pi_pro", "mobile_app", "arduino_lite"];
  if (!validTypes.includes(deviceType)) {
    return Response.json({ error: "Invalid device type" }, { status: 400 });
  }

  // Generate API key (shown once, stored as hash)
  const rawKey = `ocarina_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const capabilities = DEVICE_CAPABILITIES[deviceType] ?? {};

  const { data, error } = await supabase
    .from("devices")
    .insert({
      user_id: user.id,
      name,
      device_type: deviceType,
      api_key_hash: keyHash,
      capabilities,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: "Failed to register device" }, { status: 500 });
  }

  // Return the raw API key — only shown once
  return Response.json({ device: data, apiKey: rawKey });
}
