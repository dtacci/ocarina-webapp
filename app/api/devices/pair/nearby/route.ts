import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/api/pairing";

// Returns unclaimed pairing rows announced from the same public IP as the
// requester in the last ~10 min. Lets the "Nearby Ocarinas" UI one-click a Pi
// on the same network.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ip = getClientIp(request);
  if (!ip) {
    return Response.json({ pairings: [] });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data } = await admin
    .from("device_pairings")
    .select("pairing_code, name_hint, hardware_version, created_at")
    .eq("announce_ip", ip)
    .is("device_id", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(5);

  return Response.json({
    pairings: (data ?? []).map((row) => ({
      pairingCode: row.pairing_code,
      nameHint: row.name_hint,
      hardwareVersion: row.hardware_version,
      createdAt: row.created_at,
    })),
  });
}
