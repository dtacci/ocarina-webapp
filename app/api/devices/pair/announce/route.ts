import { createAdminClient } from "@/lib/supabase/admin";
import {
  ANNOUNCE_RATE_LIMIT_PER_HOUR,
  PAIRING_TTL_MIN,
  generatePairingCode,
  getClientIp,
} from "@/lib/api/pairing";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { deviceFingerprint, nameHint, hardwareVersion } = body as {
    deviceFingerprint?: unknown;
    nameHint?: unknown;
    hardwareVersion?: unknown;
  };

  if (
    !deviceFingerprint ||
    typeof deviceFingerprint !== "string" ||
    deviceFingerprint.length < 8 ||
    deviceFingerprint.length > 128
  ) {
    return Response.json({ error: "Invalid deviceFingerprint" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const supabase = createAdminClient();
  const now = new Date();
  const ttlMs = PAIRING_TTL_MIN * 60 * 1000;
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  // Idempotent: if this Pi already has an unclaimed pending row, reuse it.
  const { data: existing } = await supabase
    .from("device_pairings")
    .select("id, pairing_code, expires_at, device_id")
    .eq("device_fingerprint", deviceFingerprint)
    .is("device_id", null)
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return Response.json({
      pairingCode: existing.pairing_code,
      expiresAt: existing.expires_at,
    });
  }

  // Rate limit: cap announce rows per IP per hour.
  if (ip) {
    const { count } = await supabase
      .from("device_pairings")
      .select("id", { count: "exact", head: true })
      .eq("announce_ip", ip)
      .gt("created_at", hourAgo);

    if ((count ?? 0) >= ANNOUNCE_RATE_LIMIT_PER_HOUR) {
      return Response.json(
        { error: "Too many pairing attempts from this network" },
        { status: 429 }
      );
    }
  }

  // Generate a unique 6-digit code. Retry a handful of times on collision
  // against active pairings; a full sweep of the numeric space is astronomically unlikely.
  let pairingCode: string | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generatePairingCode();
    const { data: collision } = await supabase
      .from("device_pairings")
      .select("id")
      .eq("pairing_code", candidate)
      .gt("expires_at", now.toISOString())
      .maybeSingle();
    if (!collision) {
      pairingCode = candidate;
      break;
    }
  }
  if (!pairingCode) {
    return Response.json({ error: "Could not allocate pairing code" }, { status: 503 });
  }

  const { error } = await supabase.from("device_pairings").insert({
    pairing_code: pairingCode,
    device_fingerprint: deviceFingerprint,
    name_hint: typeof nameHint === "string" ? nameHint.slice(0, 100) : null,
    hardware_version: typeof hardwareVersion === "string" ? hardwareVersion.slice(0, 50) : null,
    announce_ip: ip,
    expires_at: expiresAt,
  });

  if (error) {
    return Response.json({ error: "Failed to create pairing" }, { status: 500 });
  }

  return Response.json({ pairingCode, expiresAt });
}
