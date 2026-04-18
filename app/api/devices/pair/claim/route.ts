import { randomBytes, createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_CLAIM_ATTEMPTS, normalizePairingCode } from "@/lib/api/pairing";

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

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { pairingCode, name, deviceType = "pi_pro" } = body as {
    pairingCode?: unknown;
    name?: unknown;
    deviceType?: unknown;
  };

  const code =
    typeof pairingCode === "string" ? normalizePairingCode(pairingCode) : "";
  if (code.length !== 6) {
    return Response.json({ error: "Invalid pairing code" }, { status: 400 });
  }

  if (typeof deviceType !== "string" || !(deviceType in DEVICE_CAPABILITIES)) {
    return Response.json({ error: "Invalid device type" }, { status: 400 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: pairing } = await admin
    .from("device_pairings")
    .select("id, name_hint, device_id, expires_at, claim_attempts")
    .eq("pairing_code", code)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (!pairing) {
    return Response.json({ error: "Code not found or expired" }, { status: 404 });
  }

  if (pairing.device_id) {
    return Response.json({ error: "Code already claimed" }, { status: 409 });
  }

  if ((pairing.claim_attempts ?? 0) >= MAX_CLAIM_ATTEMPTS) {
    return Response.json(
      { error: "Too many claim attempts for this code" },
      { status: 429 }
    );
  }

  const finalName =
    typeof name === "string" && name.trim().length > 0
      ? name.trim().slice(0, 100)
      : (pairing.name_hint?.slice(0, 100) ?? "Ocarina");

  const rawKey = `ocarina_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const { data: device, error: deviceErr } = await admin
    .from("devices")
    .insert({
      user_id: user.id,
      name: finalName,
      device_type: deviceType,
      api_key_hash: keyHash,
      capabilities: DEVICE_CAPABILITIES[deviceType],
    })
    .select("id, name, device_type, capabilities")
    .single();

  if (deviceErr || !device) {
    await admin
      .from("device_pairings")
      .update({ claim_attempts: (pairing.claim_attempts ?? 0) + 1 })
      .eq("id", pairing.id);
    return Response.json({ error: "Failed to create device" }, { status: 500 });
  }

  const { error: updateErr } = await admin
    .from("device_pairings")
    .update({
      device_id: device.id,
      claimed_raw_key: rawKey,
      claim_attempts: (pairing.claim_attempts ?? 0) + 1,
    })
    .eq("id", pairing.id)
    .is("device_id", null);

  if (updateErr) {
    // Race: another claim completed first. Roll back the device we just made.
    await admin.from("devices").delete().eq("id", device.id);
    return Response.json({ error: "Code already claimed" }, { status: 409 });
  }

  return Response.json({ device });
}
