import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AuthenticatedDevice {
  id: string;
  userId: string;
  name: string;
  deviceType: string;
  capabilities: Record<string, boolean>;
}

/**
 * Validates a device API key from request headers.
 * Uses the service-role client so RLS doesn't block Pi requests
 * (Pi calls have no user session / cookies).
 * Returns the device if valid, null otherwise.
 */
export async function authenticateDevice(
  request: Request
): Promise<AuthenticatedDevice | null> {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) return null;

  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("devices")
    .select("id, user_id, name, device_type, capabilities")
    .eq("api_key_hash", keyHash)
    .single();

  if (error || !data) return null;

  // Update last_seen_at
  await supabase
    .from("devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    deviceType: data.device_type,
    capabilities: data.capabilities as Record<string, boolean>,
  };
}
