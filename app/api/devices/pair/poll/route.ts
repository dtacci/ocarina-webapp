import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePairingCode } from "@/lib/api/pairing";

// Pi polls this endpoint with its pairing code + device fingerprint.
// The fingerprint check prevents an attacker who guesses a code from stealing
// the API key before the real Pi picks it up.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = normalizePairingCode(url.searchParams.get("code") ?? "");
  const fingerprint = url.searchParams.get("fingerprint") ?? "";

  if (code.length !== 6 || fingerprint.length < 8) {
    return Response.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: pairing } = await admin
    .from("device_pairings")
    .select("id, device_id, device_fingerprint, claimed_raw_key, expires_at")
    .eq("pairing_code", code)
    .maybeSingle();

  if (!pairing || pairing.device_fingerprint !== fingerprint) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (pairing.expires_at < nowIso) {
    return Response.json({ error: "Pairing expired" }, { status: 410 });
  }

  if (!pairing.device_id || !pairing.claimed_raw_key) {
    // Not yet claimed — Pi should keep polling.
    return Response.json({ status: "pending" });
  }

  const rawKey = pairing.claimed_raw_key;

  // One-shot: clear the raw key so a later caller can't re-read it.
  const { error: clearErr, data: cleared } = await admin
    .from("device_pairings")
    .update({ claimed_raw_key: null })
    .eq("id", pairing.id)
    .not("claimed_raw_key", "is", null)
    .select("id")
    .maybeSingle();

  if (clearErr || !cleared) {
    // Another concurrent poll already consumed it.
    return Response.json({ error: "Key already consumed" }, { status: 410 });
  }

  // Fetch device details for display on the Pi (name, deviceId).
  const { data: device } = await admin
    .from("devices")
    .select("id, name, device_type")
    .eq("id", pairing.device_id)
    .single();

  return Response.json({
    status: "paired",
    apiKey: rawKey,
    device,
  });
}
